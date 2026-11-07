# BLKJN Make contract

This file is the executable Phase 1 contract. The shapes below are the ones the server writes and reads. Synthetic examples and curl vectors live in `apps/blkjn/docs/make-fixtures.json`. Those vectors use the fixture secret `test-signing-secret` and the host `https://blkjn.example`. Neither is a deployment secret or a live host. `src/checkout/make-contract.test.ts` re-signs every vector with `signBody`. `src/checkout/make-contract.integration.test.ts` runs the same extraction object and the same route handlers against the test database.

Live purchase, request intake, and fulfillment stay false. No scenario should be activated from this document.

## Signing

Headers, both required:

| Header | Value |
|---|---|
| `X-BLKJN-Timestamp` | ISO-8601 timestamp that `Date.parse` accepts. Use `YYYY-MM-DDTHH:mm:ss.sssZ`. |
| `X-BLKJN-Signature` | Lowercase hex HMAC-SHA256. |

The signed bytes are the UTF-8 string `timestamp + "." + rawBody`.

- POST signs the exact body bytes that are sent. Do not parse the JSON and stringify it again. Key order and spaces are part of the signature.
- GET `/api/blkjn/make/outbox/` signs an empty string. Do not sign `{}`.
- The server accepts the signature only when `abs(Date.now() - Date.parse(timestamp))` is at most `300000` milliseconds. The frozen `2026-11-08T00:00:00.000Z` vectors are for offline checks. A live call must use a fresh timestamp and a newly computed signature.
- A mismatch or a stale timestamp returns `401` `{ "error": "invalid_signature" }`.
- Missing `BLKJN_DATABASE_URL` or `BLKJN_MAKE_SIGNING_SECRET` returns `503` `{ "error": "configuration_unavailable" }` before the signature check.

The fixture file contains one curl per route. Copy the `--data` string unchanged when reproducing a vector.

## Outbox envelope

`GET /api/blkjn/make/outbox/` returns at most 20 events ordered by `created_at` ascending:

```json
{
  "ok": true,
  "events": [
    {
      "eventId": "receipt.submitted:{orderId}:{idempotencyKey}",
      "topic": "receipt.submitted",
      "status": "pending",
      "createdAt": "2026-11-07T15:55:00.000Z",
      "attemptCount": 0,
      "payload": {}
    }
  ]
}
```

`createdAt` is UTC ISO. A row is included only when its status is `pending`, or its status is `leased` and `lease_until` is already in the past. `mail_accepted`, `mail_uncertain`, and `audited` rows are omitted.

Topics the server writes:

| Topic | When | Payload keys |
|---|---|---|
| `receipt.submitted` | A new receipt object was stored. | `orderId`, `publicRef`, `receiptId`, `idempotencyKey`, `objectKey`, `contentSha256`, `contentType`, `submittedAt`, `orderCreatedAt`, `currency`, `totalCentavos`, `paymentMethod`, `lines` |
| `receipt.duplicate_rejected` | The reference is already claimed by another order. | `orderId`, `orderRef`, `subject`, `body` |
| `request.received` | Request intake is live and the form was stored. | `requestId`, `name`, `email`, `message`, `replyTo` |
| `fulfillment.held` | Receipt criteria matched while `BLKJN_FULFILLMENT_LIVE` is not `true`. | `orderId`, `orderRef`, `reason` |
| `fulfillment.requested` | Receipt criteria matched while fulfillment is live and download TTL and count are set. | `orderId`, `orderRef`, `buyerEmail`, `grants` |

`lines[]` keys are `sku`, `title`, `quantity`, `unitCentavos`, `lineCentavos`. `currency` is `PHP`. `paymentMethod` is `gcash` or `gotyme`. `totalCentavos` is the server quote, in centavos. There is no buyer email on `receipt.submitted` and no payment-time field on the order.

`grants[]` keys are `sku`, `token`, `downloadPath`, `expiresAt`, `remainingCount`. `downloadPath` is a path such as `/api/blkjn/downloads/{token}?sku=BLKJN-P01`. The host is whatever origin Make is configured to call. The server does not put a host in the payload. `fulfillment.held` has `reason: "fulfillment_disabled"` and no `grants` and no `buyerEmail`.

`subject` and `body` on `receipt.duplicate_rejected` are the exact strings from `duplicateReferenceMessage`. The fixture copies them. String fields that a sheet might store are neutralized first: a value that starts with `=`, `+`, `-`, `@`, tab, or carriage return is prefixed with `'`.

Event ids:

- `receipt.submitted:{orderId}:{idempotencyKey}`
- `receipt.duplicate:{orderId}:{idempotencyKey}`
- `request.received:{requestId}`
- `fulfillment.{orderId}`

## Lease, retry, and audit

1. GET the outbox.
2. `POST /api/blkjn/make/outbox/claim/` with `{ "eventId": "...", "leaseSeconds": 120 }`. `leaseSeconds` is optional, integer, minimum 30, maximum 300. Omitted means 120.
3. Success is `{ "ok": true, "duplicate": false, "leaseSeconds": 120, "event": { ...same envelope, "status": "leased", "attemptCount": 1 } }`. `attemptCount` increases by one on every successful claim.
4. A second claim before `lease_until` returns `409` `{ "error": "lease_held" }`.
5. After the lease expires, GET shows the event again with `status: "leased"`. Claim succeeds and increments `attemptCount`.
6. Do the side effect once per `eventId`. Sheet rows must use `eventId` as their key so a retry updates the same row.
7. `POST /api/blkjn/make/audit/` with `{ "eventId": "...", "ok": true }` marks `pending` or `leased` events `audited` and returns `{ "ok": true, "duplicate": false, "status": "audited", "paymentDecisionChanged": false }`. A later audit returns `duplicate: true` and the same `paymentDecisionChanged: false`.
8. `{ "ok": false }` clears the lease and sets the status back to `pending`. Response: `{ "ok": true, "duplicate": false, "status": "pending", "retry": true, "paymentDecisionChanged": false }`. The payment decision is unchanged.
9. Unknown `eventId` returns `404` `{ "error": "event_not_found" }`.
10. `ok: true` on topic `request.received` returns `409` `{ "error": "use_request_send_ack" }`. Use the request-send route instead. `ok: false` still releases that lease.
11. Claim of an `audited`, `mail_accepted`, or `mail_uncertain` event returns `{ "ok": true, "duplicate": true, "status": "<current status>" }` and does not hand the payload out again.

`paymentDecisionChanged` is always false on this route. Audit does not approve, reject, or settle a payment.

While fulfillment is off, claim `fulfillment.held` and `receipt.duplicate_rejected`, write the sheet row, and audit `ok: true`. Do not send email. Audited held events are not rewritten into `fulfillment.requested` later. Only a new approval that happens while fulfillment is live emits grants.

## Private receipt bytes

`POST /api/blkjn/make/receipt-objects/`

```json
{ "orderId": "uuid", "objectKey": "receipts/{orderId}/{objectUuid}" }
```

Success:

```json
{ "ok": true, "contentType": "image/png", "sha256": "64 lowercase hex chars", "bytesBase64": "base64 of the object bytes" }
```

`contentType` is `image/png`, `image/jpeg`, or `application/pdf`. `sha256` equals `contentSha256` from `receipt.submitted`. Decode `bytesBase64` and hash it before OCR. A key that is not stored for that order returns `404` `{ "error": "object_not_found" }`. The route does not return a public URL. Missing storage configuration returns `503`.

## Extraction

`POST /api/blkjn/make/extractions/`

```json
{
  "orderId": "uuid",
  "idempotencyKey": "extract-1",
  "extraction": {
    "schema_version": "1",
    "provider": "gcash",
    "currency": "PHP",
    "amount_centavos": 9900,
    "reference_raw": "001234",
    "recipient_name": "TEST RECIPIENT",
    "recipient_identifier": "TEST-GCASH-0000",
    "payment_timestamp_raw": "2026-11-07T23:50:00+08:00",
    "parsed_payment_timestamp": "2026-11-07T23:50:00+08:00",
    "timestamp_timezone": "Asia/Manila",
    "transaction_status": "completed",
    "field_confidence": {
      "amount_centavos": 0.99,
      "reference_raw": 0.99,
      "recipient_name": 0.99,
      "recipient_identifier": 0.99,
      "parsed_payment_timestamp": 0.99,
      "transaction_status": 0.99
    },
    "missing_fields": []
  }
}
```

`provider` is `gcash` or `gotyme`. `amount_centavos` is an integer. `parsed_payment_timestamp` and `timestamp_timezone` may be JSON `null`. `field_confidence` is an object of numbers. `missing_fields` is an array of strings. Unknown extraction keys are dropped. A missing required key returns `400` and one of `malformed_extraction`, `bad_schema`, `bad_provider`, `bad_currency`, `bad_amount`, `bad_string`, `bad_timestamp`, `bad_timezone`, `bad_confidence`, `bad_missing_fields`.

The payment time is this `parsed_payment_timestamp` only. There is no customer payment-time field. Auto-approval needs `timestamp_timezone` `Asia/Manila`, a timestamp ending in `+08:00`, currency `PHP`, the server order total, the order's payment method, a completed status (`completed`, `success`, or `successful`), confidence at or above `BLKJN_MIN_CONFIDENCE` for the critical fields, and a time inside the order `created_at` and the receipt `created_at`, extended by `BLKJN_CLOCK_SKEW_MINUTES`, and not older than `BLKJN_PAYMENT_WINDOW_HOURS` before the receipt. An unconfigured window, skew, or confidence forces `NEEDS_REVIEW`. Reference matching strips spaces and dashes, uppercases, and keeps leading zeros. The canonical key is `provider|configuredRecipientIdentity|normalizedReference`.

Responses:

| Result | Body |
|---|---|
| Criteria matched | `{ "ok": true, "duplicate": false, "outcome": "AUTO_APPROVED_RECEIPT", "meansBankSettlement": false, "filesReleased": false, "delivery": "not_sent" }` |
| Needs a person | `{ "ok": true, "duplicate": false, "outcome": "NEEDS_REVIEW", "filesReleased": false }` |
| Reference belongs to another order | `{ "ok": true, "duplicate": false, "outcome": "DUPLICATE_REFERENCE_REJECTED", "filesReleased": false }` |
| Same `idempotencyKey` again | `{ "ok": true, "duplicate": true, "outcome": "<stored outcome>", "canonicalKey": "<key or null>" }` |
| No receipt stored | `409` `{ "error": "receipt_not_submitted" }` |
| Unknown order | `404` `{ "error": "order_not_found" }` |

`meansBankSettlement` is false. `filesReleased` is false unless an in-process mailer, which the HTTP server does not attach, accepts a send. Make treats `delivery: "not_sent"` as "the server did not email anyone".

## Request-send acknowledgment

Public `POST /api/blkjn/requests/` stays `403` `{ "error": "request_collection_disabled" }` until `BLKJN_REQUEST_INTAKE_LIVE=true`. The server still does not send that email.

After Make sends the request notification, `POST /api/blkjn/make/request-sends/`:

```json
{
  "eventId": "request.received:{requestId}",
  "idempotencyKey": "request-mail-1",
  "outcome": "uncertain",
  "providerMessageId": "synthetic-message-1"
}
```

`outcome` is `accepted`, `uncertain`, or `failed`. `accepted` and `uncertain` require `providerMessageId`.

| Result | Body |
|---|---|
| Accepted | `{ "ok": true, "duplicate": false, "mailState": "accepted", "resent": false, "emailSentByBackend": false }` |
| Uncertain | `{ "ok": true, "duplicate": false, "mailState": "uncertain", "resent": false, "emailSentByBackend": false }` |
| Failed | `{ "ok": true, "duplicate": false, "mailState": "failed", "resent": false, "emailSentByBackend": false }` and the event returns to `pending` |
| Same idempotency key | `{ "ok": true, "duplicate": true, "mailState": "<stored>", "resent": false, "emailSentByBackend": false }` |
| Uncertain, then a new key with the same `providerMessageId` and `outcome: "accepted"` | `{ "ok": true, "duplicate": false, "mailState": "accepted", "reconciled": true, "resent": false, "emailSentByBackend": false }` |
| Uncertain, then a different message id | `409` `{ "error": "reconcile_required" }` |
| Already accepted | `{ "ok": true, "duplicate": true, "mailState": "accepted", "resent": false, "emailSentByBackend": false }` |
| Not a request event | `404` `{ "error": "request_event_not_found" }` |

`emailSentByBackend` is always false. `resent` is always false. An uncertain result stays `mail_uncertain` and does not reappear in the outbox. Do not send a second email for it.

## Delivery report

`POST /api/blkjn/make/deliveries/` works only while `BLKJN_FULFILLMENT_LIVE=true`. Otherwise `403` `{ "error": "fulfillment_disabled" }`. The HTTP server does not send the customer email. Make reports the send it performed.

```json
{
  "orderId": "uuid",
  "idempotencyKey": "delivery-1",
  "outcome": "uncertain",
  "providerMessageId": "synthetic-message-1"
}
```

`accepted` and `uncertain` require `providerMessageId`. Missing it returns `400` `{ "error": "missing_provider_message_id" }`.

| Result | Body |
|---|---|
| First accepted | `{ "ok": true, "duplicate": false, "status": "DELIVERED", "resent": false }` |
| First uncertain | `{ "ok": true, "duplicate": false, "status": "DELIVERY_UNCERTAIN", "resent": false }` |
| First failed | `{ "ok": true, "duplicate": false, "status": "FULFILLMENT_FAILED", "resent": false }` |
| Same idempotency key | `{ "ok": true, "duplicate": true, "status": "<stored status>", "resent": false }` |
| New key, same `providerMessageId`, `outcome: "accepted"` after uncertain | `{ "ok": true, "duplicate": false, "status": "DELIVERED", "reconciled": true, "resent": false }` |
| Uncertain, then a different message id | `409` `{ "error": "reconcile_required" }` |
| No fulfillment row | `409` `{ "error": "fulfillment_not_reserved" }` |

`resent` is always false. The same provider message id is the only path from `DELIVERY_UNCERTAIN` to `DELIVERED`.

`GET /api/blkjn/downloads/{token}?sku={sku}` returns workbook bytes only when fulfillment is live, `BLKJN_DELIVERABLE_ROOT` is set, the token hash matches, the SKU matches, the grant is unexpired, `remaining_count` is at least 1, and `{BLKJN_DELIVERABLE_ROOT}/{sku}.xlsx` exists. Otherwise `503` or `403`. The response is `Cache-Control: no-store`.

## Public routes that already exist

- `GET /api/blkjn/capabilities/` returns `checkout` (`unavailable`, `disabled`, `test`, or `live`), `requestIntake`, `fulfillment`, `purchaseLive`, `qr.gcash`, `qr.gotyme`, and `gaps`. It writes nothing.
- `POST /api/blkjn/orders/` body `{ "buyerEmail", "paymentMethod", "lines": [{ "sku", "quantity" }] }`. `unitPhp` and any payment-time field are ignored. `201` returns `ok`, `orderId`, `publicRef`, `accessToken`, `totalCentavos`, `currency`, `status` `AWAITING_PAYMENT`, `testOnly`, and `lines`. `403` `purchase_disabled` or `503` `configuration_unavailable` stores nothing.
- `POST /api/blkjn/orders/{orderId}/receipts/` is multipart with `receipt` and `idempotencyKey` and header `Authorization: Bearer {accessToken}`. Success returns `ok`, `duplicate`, `headline`, `detail`, and `bankSettlementVerified: false`. The same order and idempotency key returns `duplicate: true` and does not store a second object.

Call the app with a trailing slash. `next.config` sets `trailingSlash: true`.

## Environment

| Name | Required for | Notes |
|---|---|---|
| `BLKJN_DATABASE_URL` | Orders and events | BLKJN Postgres. Not the Growthub database. |
| `BLKJN_MODE` | Test orders | `test` allows orders without purchase live. Anything else is `live`. |
| `BLKJN_PURCHASE_LIVE` | Live orders | Default false. |
| `BLKJN_REQUEST_INTAKE_LIVE` | Public request form | Default false. |
| `BLKJN_FULFILLMENT_LIVE` | Grants, delivery reports, downloads | Default false. |
| `BLKJN_MAX_QUANTITY` | Quotes | Positive integer. |
| `BLKJN_QUOTE_TTL_MINUTES` | Orders | Unset rejects orders. |
| `BLKJN_PAYMENT_WINDOW_HOURS` | Auto-approval | Unset forces review. |
| `BLKJN_CLOCK_SKEW_MINUTES` | Auto-approval | Unset forces review. |
| `BLKJN_MIN_CONFIDENCE` | Auto-approval | Decimal such as `0.9`. |
| `BLKJN_RECEIPT_MAX_BYTES` | Uploads | Unset rejects uploads. |
| `BLKJN_STORAGE_DRIVER` | Receipt bytes | `s3`, or `local-test` only with `BLKJN_MODE=test`. |
| `BLKJN_STORAGE_ROOT` | local-test | Directory. Not production storage. |
| `BLKJN_S3_ENDPOINT` | s3 | BLKJN-owned endpoint. |
| `BLKJN_S3_BUCKET` | s3 | Private bucket. |
| `BLKJN_S3_ACCESS_KEY` | s3 | Secret. Not in this repo. |
| `BLKJN_S3_SECRET_KEY` | s3 | Secret. Not in this repo. |
| `BLKJN_S3_REGION` | s3 | Optional. Default `auto`. |
| `BLKJN_MAKE_SIGNING_SECRET` | Make calls | Secret. The fixture value is not this secret. |
| `BLKJN_RECIPIENT_NAME` | Name match | Compared after trimming, collapsing spaces, and lowercasing. |
| `BLKJN_GCASH_IDENTIFIER` | GCash match | Spaces and dashes are ignored. |
| `BLKJN_GOTYME_IDENTITY` | GoTyme match | Must occur in the identifier. |
| `BLKJN_GOTYME_SUFFIX` | GoTyme match | Identifier must end with this suffix. |
| `BLKJN_GCASH_QR_CONFIGURED` | QR flag | Display only. |
| `BLKJN_GOTYME_QR_CONFIGURED` | QR flag | Display only. |
| `BLKJN_REQUEST_RATE_PER_HOUR` | Request intake | Required before intake can store a row. |
| `BLKJN_DOWNLOAD_TTL_MINUTES` | Grants | Required before a live grant is stored. |
| `BLKJN_DOWNLOAD_MAX_COUNT` | Grants | Required before a live grant is stored. |
| `BLKJN_DELIVERABLE_ROOT` | File bytes | Private directory of `{sku}.xlsx` files. |

`migrate` applies `db/001_init.sql`, including `outbox.lease_until` and `outbox.attempt_count` on a database created by the previous script.

## Still outside this repo

These are not invented here and are still required before an inactive scenario can be pointed at a real store:

- The BLKJN Postgres URL, the Make signing secret, and the S3 endpoint, bucket, and keys.
- The BLKJN-owned sheet id and the column that stores `eventId`.
- The BLKJN-owned mailbox Make uses for request notifications and, later, fulfillment email. Personal Make may call these routes. It does not become the owner of the mailbox, Drive, or sheet.
- The OCR step that turns `bytesBase64` into the extraction object. The server accepts the allowlisted JSON and does not call an OCR provider.
- QR image files and the private `{sku}.xlsx` workbooks.
- A host name for `downloadPath`. The payload has the path only.
- Turning on `BLKJN_PURCHASE_LIVE`, `BLKJN_REQUEST_INTAKE_LIVE`, or `BLKJN_FULFILLMENT_LIVE`. They stay false.
- Replaying events that were already audited while fulfillment was off. That is a separate backfill, not this contract.
