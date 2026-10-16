import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateHeaderAll,
  candidateCredentials,
  collectUnitCodeCandidates,
  isRecord,
  recordCoopPayment,
  requiredString,
  resolveTenantFromUnitCodes,
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

    // The spec documents Currency as empty on advice, so only a stated non-KES currency is rejected.
    if (currency && currency !== 'KES') {
      return response(messageID, '400', 'Invalid parameters', {}, 400);
    }

    const credentials = await candidateCredentials();
    const matches = authenticateHeaderAll({ connectionID, connectionPassword, messageID, serviceName }, institutionCode, credentials);
    if (matches.length === 0) {
      return response(messageID, '401', 'Unauthorized', {}, 401);
    }
    if (matches.length > 1) {
      console.warn('[coop/advise] credentials are configured for more than one organization', {
        messageID,
        organizations: matches.map((match) => match.organizationId ?? 'env'),
      });
    }

    const { data: existingPayment, error: existingPaymentError } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('coop_payment_reference', bankReference)
      .maybeSingle();
    if (existingPaymentError) {
      throw existingPaymentError;
    }
    if (existingPayment) {
      return response(messageID, '402', 'Duplicate transaction', {}, 402);
    }

    let matched: { credential: CoopCredentials; tenant: TenantPaymentContext; candidate: UnitCodeCandidate } | null = null;
    let lastReason = 'unit_not_found';
    let lastPropertyOrg: string | null = null;
    for (const credential of matches) {
      const lookup = await resolveTenantFromUnitCodes(codeCandidates, credential.organizationId);
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
      unitCode,
    });

    // The spec requires the advice response to echo the request values, so prefer what the
    // bank sent and fall back to our own resolved values.
    const requestTransactionReference = requiredString(requestBody.TransactionReferenceCode) ?? bankReference;
    const requestAccountName = requiredString(requestBody.AccountName) ?? tenant.tenantName;
    const requestTotalAmount = requiredString(requestBody.TotalAmount) ?? amount.toFixed(2);

    return response(messageID, '200', 'Payment successfully received', {
      TransactionReferenceCode: requestTransactionReference,
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
