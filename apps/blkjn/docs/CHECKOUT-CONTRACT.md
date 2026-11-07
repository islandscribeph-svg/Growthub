# BLKJN checkout contract

This is the Phase 1 contract for the personal Make worker. Live purchase, request intake, and fulfillment are off until the matching variables are set to `true` through secure setup. Do not commit the values.

## Environment

| Name | Required for | Notes |
|---|---|---|
| `BLKJN_DATABASE_URL` | Orders, requests, claims | Postgres connection string for the BLKJN database. Not the Growthub database. |
| `BLKJN_MODE` | Staging | `test` allows test orders. Anything else is treated as `live`. |
| `BLKJN_PURCHASE_LIVE` | Live orders | Default false. Live mode without this returns `purchase_disabled`. |
| `BLKJN_REQUEST_INTAKE_LIVE` | Public request form | Default false. The endpoint writes nothing. |
| `BLKJN_FULFILLMENT_LIVE` | Customer email and file download | Default false. No message is sent. |
| `BLKJN_MAX_QUANTITY` | Quotes | Positive integer. Unset rejects orders. |
| `BLKJN_QUOTE_TTL_MINUTES` | Orders | Unset rejects orders. |
| `BLKJN_PAYMENT_WINDOW_HOURS` | Auto-approval | Unset forces `NEEDS_REVIEW`. This is not a 24-hour rule. |
| `BLKJN_CLOCK_SKEW_MINUTES` | Auto-approval | Unset forces review. |
| `BLKJN_MIN_CONFIDENCE` | Auto-approval | Decimal such as `0.9`. Unset forces review. |
| `BLKJN_RECEIPT_MAX_BYTES` | Uploads | Unset rejects uploads. |
| `BLKJN_STORAGE_DRIVER` | Receipt bytes | `s3` in production. `local-test` works only with `BLKJN_MODE=test`. |
| `BLKJN_STORAGE_ROOT` | local-test only | Directory path. Not production storage. |
| `BLKJN_S3_ENDPOINT` | s3 | BLKJN-owned endpoint. |
| `BLKJN_S3_BUCKET` | s3 | Private bucket. |
| `BLKJN_S3_ACCESS_KEY` | s3 | Secret. |
| `BLKJN_S3_SECRET_KEY` | s3 | Secret. |
| `BLKJN_S3_REGION` | s3 | Optional. Defaults to `auto` for S3-compatible endpoints. |
| `BLKJN_MAKE_SIGNING_SECRET` | Make calls | HMAC secret. Make sends `X-BLKJN-Timestamp` and `X-BLKJN-Signature`. |
| `BLKJN_RECIPIENT_NAME` | Auto-approval | Exact name after space and case normalization. |
| `BLKJN_GCASH_IDENTIFIER` | GCash match | Full identifier. Never commit it. |
| `BLKJN_GOTYME_IDENTITY` | GoTyme match | Configured bank identity. |
| `BLKJN_GOTYME_SUFFIX` | GoTyme match | Account suffix only. |
| `BLKJN_GCASH_QR_CONFIGURED` | QR display | `true` only after the real image is wired. |
| `BLKJN_GOTYME_QR_CONFIGURED` | QR display | `true` only after the real image is wired. |
| `BLKJN_REQUEST_RATE_PER_HOUR` | Request intake | Required before intake can be enabled. |
| `BLKJN_DOWNLOAD_TTL_MINUTES` | Grants | Required before a test grant is stored. |
| `BLKJN_DOWNLOAD_MAX_COUNT` | Grants | Required before a test grant is stored. |
| `BLKJN_DELIVERABLE_ROOT` | File bytes | Private directory of release workbooks. Not public. |

Apply `db/001_init.sql` before the first order. The app also runs that SQL from `migrate`.

## HTTP

Public JSON routes:

- `GET /api/blkjn/capabilities/` returns checkout `unavailable`, `disabled`, `test`, or `live`, plus QR flags and missing env names. It does not create anything.
- `POST /api/blkjn/orders/` body `{ buyerEmail, paymentMethod, lines: [{ sku, quantity }] }`. There is no payment date field. Client amounts and any `buyerPaymentClaimedAt` value are ignored. `201` returns `orderId`, `publicRef`, `accessToken`, and `totalCentavos`. `403 purchase_disabled` or `503 configuration_unavailable` saves nothing.
- `POST /api/blkjn/orders/{orderId}/receipts/` multipart `receipt` and `idempotencyKey`, header `Authorization: Bearer {accessToken}`. Durable success returns the pending receipt copy and `bankSettlementVerified: false`.
- `POST /api/blkjn/requests/` is `403 request_collection_disabled` until intake is explicitly enabled.

Make routes require `X-BLKJN-Timestamp` (ISO time, within five minutes) and `X-BLKJN-Signature` = hex HMAC-SHA256 of `timestamp + "." + rawBody` using `BLKJN_MAKE_SIGNING_SECRET`. GET outbox signs an empty body.

- `GET /api/blkjn/make/outbox/` lists pending events.
- `POST /api/blkjn/make/extractions/` body `{ orderId, idempotencyKey, extraction }`. Extraction is the allowlisted object only. The worker must not send tool calls. The response `outcome` is `AUTO_APPROVED_RECEIPT`, `NEEDS_REVIEW`, or `DUPLICATE_REFERENCE_REJECTED`. `meansBankSettlement` is false.
- `POST /api/blkjn/make/audit/` body `{ eventId, ok }`. A failed audit does not change the payment decision.
- `POST /api/blkjn/make/deliveries/` body `{ orderId, idempotencyKey, outcome, providerMessageId }`. `outcome` is `accepted`, `uncertain`, or `failed`. The same idempotency key returns the stored result and does not send again. An uncertain delivery can be reconciled to delivered only with the same provider message id. A different id returns `409 reconcile_required`. This route returns `403 fulfillment_disabled` while `BLKJN_FULFILLMENT_LIVE` is not `true`.
- `GET /api/blkjn/downloads/{token}?sku={sku}` returns the private workbook only when fulfillment is live, the grant matches the SKU, and `{BLKJN_DELIVERABLE_ROOT}/{sku}.xlsx` exists. Otherwise it returns `503` or `403` and no file.

The payment timestamp is not an order field. Make's extraction supplies `parsed_payment_timestamp` and `timestamp_timezone`. Auto-approval requires `Asia/Manila` and a `+08:00` timestamp that falls between the server order `created_at` and the server receipt `created_at`, inside `BLKJN_PAYMENT_WINDOW_HOURS` and `BLKJN_CLOCK_SKEW_MINUTES`. Missing or ambiguous timestamps are `NEEDS_REVIEW`.

Outbox topics: `receipt.submitted`, `receipt.duplicate_rejected`, `request.received`.

Sheet cells that start with `=`, `+`, `-`, `@`, or a tab are prefixed with a single quote in outbox payloads. Do not put receipt URLs or tokens in the sheet. The private object key is an identifier, not a public link.

## Worker sequence

1. Poll the outbox with a signed GET.
2. For `receipt.submitted`, fetch the private object with a short-lived server credential that is not in this repo, run extraction outside the web process, and POST the allowlisted extraction.
3. Append the neutralized payload to the BLKJN-owned sheet. Then POST the audit ack.
4. For `receipt.duplicate_rejected`, send the polite template only after the fulfillment switch and the BLKJN sender are approved. Until then, leave the event pending.
5. Do not deliver files from Make. Download grants stay behind `BLKJN_FULFILLMENT_LIVE` and `BLKJN_DELIVERABLE_ROOT`.

## Still blocked

QR image files, the BLKJN database, S3 credentials, sheet ID, sender, OCR provider, and deliverable workbook files are not provisioned here. When `BLKJN_STORAGE_DRIVER=s3` and the endpoint, bucket, access key, secret, and receipt size limit are set, receipt bytes are uploaded with the AWS SDK to a private `receipts/{orderId}/{object}` key. A read for a different order does not call storage. Missing credentials leave storage unset and uploads return `503`. The payment time is read only from receipt extraction and compared with the server order and receipt-submission timestamps in Asia/Manila.
