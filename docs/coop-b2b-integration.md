# Co-operative Bank B2B integration

This application exposes the following JSON endpoints for Co-operative Bank M-Pesa STK Push:

- `POST /api/coop/validate` validates a unit short code before payment.
- `POST /api/coop/advise` records a cleared payment and sends tenant and landlord notifications.

The unit `short_code` is the account number. A successful validation response returns the assigned tenant's full name in both `AccountName` and `AdditionalInfo`.

## Configuration

Run [`db/add_coop_b2b_settings.sql`](../db/add_coop_b2b_settings.sql). Each landlord then sets the Co-operative Bank Paybill connected to their receiving bank account in **Payments → Payment Settings**. Tenants see that Paybill and use their assigned unit short code as the payment account number.

Configure the bank callback credentials securely in the deployment environment using `COOP_CONNECTION_ID`, `COOP_CONNECTION_PASSWORD`, `COOP_SERVICE_NAME`, `COOP_INSTITUTION_CODE`, and optionally `COOP_INSTITUTION_NAME`.

The incoming `connectionID`, `connectionPassword`, `serviceName`, and request `InstitutionCode` must all match configured values. Do not expose these values to clients or commit them to source control.

## Callback behavior

`/api/coop/advise` accepts `DocumentReferenceNumber` as the unit code and `PaymentReferenceCode` (or `TransactionReferenceCode` when the former is absent) as the bank transaction identity. The payment reference is unique, so repeat advice requests return HTTP/status code `402` and do not record a second payment.

Successful advice is recorded as a `rent` payment in KES, updates the tenant's outstanding bills using the existing payment workflow, and creates notifications for the tenant and landlord. Validation and advice return the supplied `messageID` in their response header.
