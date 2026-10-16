import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateHeaderAll,
  candidateCredentials,
  collectUnitCodeCandidates,
  isRecord,
  requiredString,
  resolveTenantFromUnitCodes,
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
      console.warn('[coop/validate] body is not valid JSON', { error: (parseError as Error).message });
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
    // The spec sends the tenant identifier only in TransactionReferenceCode; older
    // partner builds used the account fields, so they remain as fallbacks.
    const codeCandidates = collectUnitCodeCandidates(requestBody, [
      'TransactionReferenceCode',
      'AccountNumber',
      'DocumentReferenceNumber',
    ]);
    const transactionReference = requiredString(requestBody.TransactionReferenceCode);
    const transactionDate = requiredString(requestBody.TransactionDate);
    const institutionCode = requiredString(requestBody.InstitutionCode);

    if (!messageID || !connectionID || !connectionPassword || !serviceName || codeCandidates.length === 0 || !transactionDate || !institutionCode || Number.isNaN(Date.parse(transactionDate))) {
      return response(messageID, '400', 'Invalid parameters', {}, 400);
    }

    const credentials = await candidateCredentials();
    const matches = authenticateHeaderAll({ connectionID, connectionPassword, messageID, serviceName }, institutionCode, credentials);
    if (matches.length === 0) {
      return response(messageID, '401', 'Unauthorized', {}, 401);
    }
    if (matches.length > 1) {
      console.warn('[coop/validate] credentials are configured for more than one organization', {
        messageID,
        organizations: matches.map((match) => match.organizationId ?? 'env'),
      });
    }

    let lastReason = 'unit_not_found';
    let lastPropertyOrg: string | null = null;
    for (const credential of matches) {
      const lookup = await resolveTenantFromUnitCodes(codeCandidates, credential.organizationId);
      if (lookup.status !== 'found') {
        lastReason = lookup.status;
        lastPropertyOrg = lookup.status === 'organization_mismatch' ? lookup.propertyOrganizationId : null;
        continue;
      }

      const tenant = lookup.tenant;
      const unitCode = lookup.candidate.value;
      console.log('[coop/validate] matched', { messageID, field: lookup.candidate.field, unitCode, tenantName: tenant.tenantName });

      return response(messageID, '200', 'Successfully validated customer', {
        TransactionReferenceCode: transactionReference ?? unitCode,
        TransactionDate: transactionDate,
        TotalAmount: 0,
        Currency: 'KES',
        AdditionalInfo: tenant.tenantName,
        AccountNumber: unitCode,
        AccountName: tenant.tenantName,
        InstitutionCode: institutionCode,
        InstitutionName: credential.institutionName,
      }, 200);
    }

    console.warn('[coop/validate] rejected', {
      messageID,
      reason: lastReason,
      tried: codeCandidates.map((candidate) => `${candidate.field}=${candidate.value}`),
      institutionCode,
      organizationsTried: matches.map((match) => match.organizationId ?? 'env'),
      ...(lastPropertyOrg ? { propertyOrganizationId: lastPropertyOrg } : {}),
    });
    return response(messageID, '404', 'Unit code not found', {}, 404);
  } catch (error) {
    console.error('[coop/validate] error', error);
    return response(messageID, '405', 'Server error', {}, 405);
  }
}
