import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateHeader,
  candidateCredentials,
  findTenantByUnitCode,
  isRecord,
  requiredString,
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
    const payload: unknown = await request.json();
    if (!isRecord(payload)) {
      return response(messageID, '400', 'Invalid parameters', {}, 400);
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
    // The paybill account number the tenant entered is the unit short code.
    // Co-op may carry it in AccountNumber or DocumentReferenceNumber; accept either.
    const unitCode = requiredString(requestBody.AccountNumber) ??
      requiredString(requestBody.DocumentReferenceNumber) ??
      requiredString(requestBody.TransactionReferenceCode);
    const transactionReference = requiredString(requestBody.TransactionReferenceCode);
    const transactionDate = requiredString(requestBody.TransactionDate);
    const institutionCode = requiredString(requestBody.InstitutionCode);

    if (!messageID || !connectionID || !connectionPassword || !serviceName || !unitCode || !transactionDate || !institutionCode || Number.isNaN(Date.parse(transactionDate))) {
      return response(messageID, '400', 'Invalid parameters', {}, 400);
    }

    const credentials = await candidateCredentials();
    const credential = authenticateHeader({ connectionID, connectionPassword, messageID, serviceName }, institutionCode, credentials);
    if (!credential) {
      return response(messageID, '401', 'Unauthorized', {}, 401);
    }

    const tenant = await findTenantByUnitCode(unitCode, credential.organizationId);
    if (!tenant) {
      return response(messageID, '404', 'Unit code not found', {}, 404);
    }

    return response(messageID, '200', 'Successfully validated customer', {
      TransactionReferenceCode: transactionReference ?? unitCode,
      TransactionDate: transactionDate,
      TotalAmount: 0,
      Currency: 'KES',
      AdditionalInfo: tenant.tenantName,
      AccountNumber: unitCode,
      AccountName: tenant.tenantName,
      InstitutionCode: credential.institutionCode,
      InstitutionName: credential.institutionName,
    }, 200);
  } catch (error) {
    console.error('[coop/validate] error', error);
    return response(messageID, '405', 'Server error', {}, 405);
  }
}
