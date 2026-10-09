# Co-operative Bank B2B integration

This application exposes the following JSON endpoints for Co-operative Bank M-Pesa STK Push:

- `POST /api/coop/validate` validates a unit short code before payment.
- `POST /api/coop/advise` records a cleared payment and sends tenant and landlord notifications.

Both Co-operative Bank endpoints use the plain JSON request and response format in the B2B specification. They do not use AES encryption or expect a base64-encoded request or response. Configure those bank callbacks as `Content-Type: application/json` and do not enable payload decryption for the Co-op URLs. The separate `/api/sbm/ipn` endpoint is for SBM's encrypted IPN protocol.

## SBM IPN (separate integration)

The SBM callback remains available at `POST /api/sbm/ipn`. Each landlord can configure its receiving account and IPN credentials in **Payments → Edit Payment Details**. The callback also accepts the server-only `SBM_IPN_USERNAME`, `SBM_IPN_PASSWORD`, `SBM_SECRET_KEY`, and optional `SBM_ACCOUNT_NUMBER` environment variables. Never put credentials in client-side code or source control. Run [`db/add_sbm_ipn_settings.sql`](../db/add_sbm_ipn_settings.sql) in Supabase before enabling the SBM option. Do not send Co-op callbacks to the SBM endpoint.

The current SBM crypto helper expects a standard-base64 request body containing AES ciphertext. It currently accepts raw AES keys (16, 24, or 32 bytes), and attempts AES-ECB or AES-CBC with a zero IV. Those are provisional compatibility assumptions, not a confirmed SBM protocol. The callback logs a sanitized reason when the body is not valid base64 or its decoded ciphertext length is not a multiple of AES's 16-byte block size. Confirm key encoding, cipher mode, IV handling, payload envelope, padding, and response format with SBM before production.

Before production testing, request from SBM:

- Sandbox IPN username, IPN password, encryption key, and the receiving account number to configure.
- The exact request body format: raw base64 ciphertext or a JSON wrapper, and the required `Content-Type`.
- AES variant and key handling: AES-128/192/256, ECB or CBC, PKCS#7/PKCS#5 padding, key as UTF-8/base64/hex, and any key derivation rules.
- For CBC, how the 16-byte IV is provided (fixed, separate field/header, or prefixed to ciphertext).
- Whether the response must be encrypted; if yes, the exact cipher/key/IV/padding and expected response JSON fields and HTTP status.
- One sanitized known-good encrypted sandbox request plus the expected decrypted response, and confirmation of which payment fields carry the tenant short code and bank transaction reference.
- Any source-IP allowlisting or TLS certificate requirements for the callback URL.

The AES block-length error means the bytes passed to AES decryption are not a whole number of 16-byte blocks. Common causes include decrypting a JSON/error body instead of ciphertext, an incorrect base64/envelope format, or using the wrong IV/cipher framing. Share the sanitized HTTP request/response and SBM's crypto specification to identify which case applies; do not send real passwords or production encryption keys by email.

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
