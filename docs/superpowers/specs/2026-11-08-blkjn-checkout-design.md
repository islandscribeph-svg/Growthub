# BLKJN Phase 1 checkout — implementation design

Approved scope is `checkout-integration-design.md` (8 November 2026). This file records how that scope is implemented in `apps/blkjn`, including safe defaults where the spec left a value unconfigured. Live payment, request collection, and fulfillment stay off until those switches are explicitly enabled.

## Preserved catalogue

The fifteen template SKUs, titles, packs, thumbnails, and approved PHP prices already on the Store stay as they are. Prices in centavos are 100 times the PHP amount. Packs are not SKUs. PDF automation guides stay Phase 2: no price, no cart line, no purchase action.

## Runtime shape

`apps/blkjn` remains its own Next.js app. Static export cannot host the order API, so the app build is a Next server build. Pages stay prerendered. Route handlers under `src/app/api/blkjn/` are the only backend. The Growthub app at the repository root is not part of this build.

The transactional database is Postgres, addressed by `BLKJN_DATABASE_URL`. A missing URL makes every write return `503 configuration_unavailable`. Tests that need atomicity use Postgres. An in-memory stand-in is not a production adapter.

Private receipt bytes use an object-storage adapter:

- `s3` when `BLKJN_STORAGE_DRIVER=s3` and the endpoint, bucket, and keys are set
- `local-test` only when `BLKJN_MODE=test` and `BLKJN_STORAGE_DRIVER=local-test`

`local-test` is a disposable directory for automated tests. It is not production storage and it does not provide the database's atomic reference claim. If neither driver is configured, receipt upload returns `503` and the screen does not say the receipt was accepted.

## Switches

| Env | Default | Effect when false or unset |
|---|---|---|
| `BLKJN_PURCHASE_LIVE` | false | Orders, when the test database is configured, are stored as `environment=test`. Live orders are refused. |
| `BLKJN_REQUEST_INTAKE_LIVE` | false | Public request endpoint returns `403 request_collection_disabled` and writes nothing. |
| `BLKJN_FULFILLMENT_LIVE` | false | No customer email is sent. Download files are not handed out by the live path. |

`BLKJN_MODE=test` plus a configured database allows the staging UI and automated tests to create test orders. That is not a live checkout.

## Safe defaults for unresolved policy

These are not launch policy. Auto-approval requires every one of them to be present on the policy object. If any is missing, the decision is `NEEDS_REVIEW` or the write is `503`.

- Quantity limit: `BLKJN_MAX_QUANTITY`. Unset rejects quote and order creation.
- Quote lifetime: `BLKJN_QUOTE_TTL_MINUTES`. Unset rejects order creation.
- Payment window: `BLKJN_PAYMENT_WINDOW_HOURS`. Unset forces review. No 24-hour rule is implied.
- Clock skew: `BLKJN_CLOCK_SKEW_MINUTES`. Unset forces review.
- Minimum field confidence: `BLKJN_MIN_CONFIDENCE` as a decimal string such as `0.9`. Unset forces review.
- Masked account identifiers are not accepted. They review.
- Receipt size and allowed types: `BLKJN_RECEIPT_MAX_BYTES`. Unset rejects upload. Allowed types are JPEG, PNG, and PDF by magic bytes.

Tests pass these values explicitly. They are synthetic, not the owner's live policy.

## Receipt decision

The browser never supplies the amount that is compared. Extraction input is parsed against an allowlist. Unknown fields and instruction-like text are ignored as data. Nothing in that payload is evaluated or fetched.

Auto-approval requires PHP currency, exact centavo equality, the order's provider, normalized recipient name equality, a configured account identifier match, a completed status, a timezone-aware timestamp inside the order lifecycle and within skew of the buyer's claimed payment time, and confidence at or above the configured minimum.

`AUTO_APPROVED_RECEIPT` means those receipt criteria matched. It does not mean a bank confirmed the money.

The canonical reference key is `provider + configured recipient identity + normalized reference`. Leading zeros are kept. The unique constraint is on that key. The same order retry returns the existing decision and does not create a second grant or email. Another order loses with `DUPLICATE_REFERENCE_REJECTED` and a polite outbox template. No files are attached to that rejection.

## Make

Make is the personal-account exception. It calls BLKJN with `X-BLKJN-Timestamp` and `X-BLKJN-Signature` (HMAC-SHA256 of `timestamp.rawBody` using `BLKJN_MAKE_SIGNING_SECRET`). Replay older than five minutes is rejected. Sheets rows are an audit mirror produced as neutralized outbox payloads. A failed audit ack does not change the payment decision.

## Customer copy after a durable receipt write

Thank you for your purchase. We're reviewing your payment receipt and will send your purchase order shortly.

The same screen states that this is not bank settlement verification, and it shows the public order reference. If the write fails, the screen shows the error and does not use that thank-you copy.
