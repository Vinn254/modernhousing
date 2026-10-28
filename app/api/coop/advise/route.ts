import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateHeaderAll,
  authMismatchReport,
  candidateCredentials,
  collectUnitCodeCandidates,
  isRecord,
  recordCoopPayment,
  requiredString,
  withOrganization,
  lookupUnitTenant,
  supabaseAdmin,
  type CoopCredentials,
  type TenantPaymentContext,
  type UnitCodeCandidate,
} from '../../../../lib/coopB2b';

function response(messageID: string, statusCode: string, statusDescription: string, body: Record<string, unknown>, status: number) {
  return NextResponse.json({
    header: { messageID, statusCode, statusDescription },
    response: body,
  }, { status });
}

export async function GET() {
  // The bank's connectivity probe opens the callback URL in a browser, and a
  // bare 405 reads as "service unreachable" on their side.
  return NextResponse.json({
    service: 'coop-b2b-advise',
    status: 'reachable',
    note: 'Connectivity check OK. B2B messages must be sent via POST.',
  });
}

export async function POST(request: NextRequest) {
  let messageID = '';

  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch (parseError) {
      console.warn('[coop/advise] body is not valid JSON', { error: (parseError as Error).message });
      return response('', '400', 'Invalid parameters', {}, 400);
    }
    if (!isRecord(payload)) {
      return response('', '400', 'Invalid parameters', {}, 400);
    }

    const header = payload.header;
    const requestBody = payload.request;
    if (!isRecord(header) || !isRecord(requestBody)) {
      return response(messageID, '400', 'Invalid parameters', {}, 400);
    }

    messageID = requiredString(header.messageID) ?? '';
    const connectionID = requiredString(header.connectionID);
    const connectionPassword = requiredString(header.connectionPassword);
    const serviceName = requiredString(header.serviceName);
    const bankReference = requiredString(requestBody.PaymentReferenceCode) ?? requiredString(requestBody.TransactionReferenceCode);
    const transactionDate = requiredString(requestBody.TransactionDate);
    const paymentDate = requiredString(requestBody.PaymentDate);
    const codeCandidates = collectUnitCodeCandidates(requestBody, [
      'DocumentReferenceNumber',
      'AccountNumber',
      'AdditionalInfo',
      'TransactionReferenceCode',
    ]);
    const institutionCode = requiredString(requestBody.InstitutionCode);
    const currency = requiredString(requestBody.Currency);
    const amount = Number(requestBody.PaymentAmount ?? requestBody.TotalAmount);

    if (
      !messageID || !connectionID || !connectionPassword || !serviceName || !bankReference || !transactionDate ||
      !paymentDate || codeCandidates.length === 0 || !institutionCode || !Number.isFinite(amount) || amount <= 0 ||
      Number.isNaN(Date.parse(transactionDate)) || Number.isNaN(Date.parse(paymentDate))
    ) {
      return response(messageID, '400', 'Invalid parameters', {}, 400);
    }

    // The bank's duplicate checker runs against TransactionReferenceCode only on
    // this leg, so that is the value we test for repeats and store as the Co-op
    // reference, even when a PaymentReferenceCode also arrives.
    const transactionReference = requiredString(requestBody.TransactionReferenceCode) ?? bankReference;

    // The spec documents Currency as empty on advice, so only a stated non-KES currency is rejected.
    if (currency && currency !== 'KES') {
      return response(messageID, '400', 'Invalid parameters', {}, 400);
    }

    const credentials = await candidateCredentials();
    const matches = authenticateHeaderAll({ connectionID, connectionPassword, messageID, serviceName }, institutionCode, credentials);
    if (matches.length === 0) {
      console.warn('[coop/advise] unauthorized', {
        messageID,
        report: authMismatchReport({ connectionID, connectionPassword, messageID, serviceName }, institutionCode, credentials),
      });
      return response(messageID, '401', 'Unauthorized', {}, 401);
    }
    if (matches.length > 1) {
      console.warn('[coop/advise] credentials are configured for more than one organization', {
        messageID,
        organizations: matches.map((match) => match.organizationId ?? 'env'),
      });
    }

    // The duplicate check and the customer lookup are independent, so they run
    // together: the bank's reply gateway closes the connection while a cold
    // function is still answering these queries one after another.
    const [duplicateResult, unitLookup] = await Promise.all([
      supabaseAdmin
        .from('payments')
        .select('id')
        .eq('coop_payment_reference', transactionReference)
        .maybeSingle(),
      lookupUnitTenant(codeCandidates),
    ]);

    const { data: existingPayment, error: existingPaymentError } = duplicateResult;
    if (existingPaymentError) {
      throw existingPaymentError;
    }
    if (existingPayment) {
      return response(messageID, '402', 'Duplicate transaction', {}, 402);
    }

    let matched: { credential: CoopCredentials; tenant: TenantPaymentContext; candidate: UnitCodeCandidate } | null = null;
    let lastReason: string = unitLookup.status;
    let lastPropertyOrg: string | null = null;
    for (const credential of matches) {
      const lookup = withOrganization(unitLookup, credential.organizationId);
      if (lookup.status === 'found') {
        matched = { credential, tenant: lookup.tenant, candidate: lookup.candidate };
        break;
      }
      lastReason = lookup.status;
      lastPropertyOrg = lookup.status === 'organization_mismatch' ? lookup.propertyOrganizationId : null;
    }

    if (!matched) {
      console.warn('[coop/advise] rejected', {
        messageID,
        reason: lastReason,
        tried: codeCandidates.map((candidate) => `${candidate.field}=${candidate.value}`),
        bankReference,
        organizationsTried: matches.map((match) => match.organizationId ?? 'env'),
        ...(lastPropertyOrg ? { propertyOrganizationId: lastPropertyOrg } : {}),
      });
      return response(messageID, '404', 'Unit code not found', {}, 404);
    }

    const credential = matched.credential;
    const tenant = matched.tenant;
    const unitCode = matched.candidate.value;
    console.log('[coop/advise] matched', { messageID, field: matched.candidate.field, unitCode, bankReference, amount });

    await recordCoopPayment({
      tenant,
      amount,
      paymentDate: new Date(paymentDate),
      bankReference,
      transactionReference,
      unitCode,
    });

    // The spec requires the advice response to echo the request values, so prefer what the
    // bank sent and fall back to our own resolved values.
    const requestAccountName = requiredString(requestBody.AccountName) ?? tenant.tenantName;
    const requestTotalAmount = requiredString(requestBody.TotalAmount) ?? amount.toFixed(2);

    return response(messageID, '200', 'Payment successfully received', {
      TransactionReferenceCode: transactionReference,
      TransactionDate: transactionDate,
      TransactionAmount: amount.toFixed(2),
      AccountNumber: unitCode,
      AccountName: requestAccountName,
      InstitutionCode: institutionCode,
      InstitutionName: requiredString(requestBody.InstitutionName) ?? credential.institutionName,
      Currency: currency ?? 'KES',
      AdditionalInfo: unitCode,
      TotalAmount: requestTotalAmount,
    }, 200);
  } catch (error) {
    console.error('[coop/advise] error', error);
    return response(messageID, '405', 'Server error', {}, 405);
  }
}
