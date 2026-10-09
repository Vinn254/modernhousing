# Co-operative Bank B2B integration

This application exposes the following JSON endpoints for Co-operative Bank M-Pesa STK Push:

- `POST /api/coop/validate` validates a unit short code before payment.
- `POST /api/coop/advise` records a cleared payment and sends tenant and landlord notifications.

Both endpoints use the plain JSON request and response format in Co-operative Bank's B2B specification. They do not use AES encryption or expect a base64-encoded request or response. Configure the bank callback as `Content-Type: application/json` and do not enable payload decryption for these URLs. The separate `/api/sbm/ipn` endpoint is for SBM's encrypted IPN protocol and is not the Co-operative Bank callback.

The unit `short_code` is the account number. A successful validation response returns the assigned tenant's full name in both `AccountName` and `AdditionalInfo`.

## Configuration

Run [`db/add_coop_b2b_settings.sql`](../db/add_coop_b2b_settings.sql). Each landlord sets their own Paybill and Co-operative Bank B2B credentials in **Payments → Edit Payment Details**. These values are stored per organization, so configuring Sarah Odongo's IMMENSUS details does not configure any other landlord.

For Sarah Odongo, enter:

- Institution Code: `21000892`
- Institution and Service Name: `IMMENSUS`
- The Connection ID and Connection Password issued for Sarah's Co-operative Bank integration

The incoming `connectionID`, `connectionPassword`, `serviceName`, and request `InstitutionCode` must all match configured values. Do not expose these values to clients or commit them to source control.

## Callback behavior

`/api/coop/advise` accepts `DocumentReferenceNumber` as the unit code and `PaymentReferenceCode` (or `TransactionReferenceCode` when the former is absent) as the bank transaction identity. The payment reference is unique, so repeat advice requests return HTTP/status code `402` and do not record a second payment.

Successful advice is recorded as a `rent` payment in KES and creates notifications for both the tenant and the landlord, so the payment appears in each side's payment history and notification bell automatically. Only rent is handled for now; bills are not touched by this flow. Validation and advice return the supplied `messageID` in their response header.
