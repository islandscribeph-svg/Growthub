import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readConfig, type AppConfig } from "./config.ts";
import { getPool, resetDatabase } from "./db.ts";
import { neutralizeRow } from "./sheet.ts";
import { verifySignature, signBody } from "./signature.ts";
import { acceptRequest, acknowledgeAudit, applyExtraction, createOrder, redeemDownload, submitReceipt } from "./service.ts";
import { createStorage } from "./storage.ts";

const databaseUrl = process.env.BLKJN_TEST_DATABASE_URL
  ?? "postgresql://growthub:growthub@localhost:5432/blkjn_checkout_test";

function testConfig(root: string, overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...readConfig({
      BLKJN_MODE: "test",
      BLKJN_DATABASE_URL: databaseUrl,
      BLKJN_MAX_QUANTITY: "5",
      BLKJN_QUOTE_TTL_MINUTES: "60",
      BLKJN_PAYMENT_WINDOW_HOURS: "6",
      BLKJN_CLOCK_SKEW_MINUTES: "5",
      BLKJN_MIN_CONFIDENCE: "0.9",
      BLKJN_RECEIPT_MAX_BYTES: "2000000",
      BLKJN_STORAGE_DRIVER: "local-test",
      BLKJN_STORAGE_ROOT: root,
      BLKJN_MAKE_SIGNING_SECRET: "test-signing-secret",
      BLKJN_RECIPIENT_NAME: "TEST RECIPIENT",
      BLKJN_GCASH_IDENTIFIER: "TEST-GCASH-0000",
      BLKJN_GOTYME_IDENTITY: "TEST-GOTYME",
      BLKJN_GOTYME_SUFFIX: "9999",
      BLKJN_REQUEST_RATE_PER_HOUR: "3",
      BLKJN_DOWNLOAD_TTL_MINUTES: "30",
      BLKJN_DOWNLOAD_MAX_COUNT: "2",
    }),
    ...overrides,
  };
}

const paidAt = "2026-11-07T23:50:00+08:00";
const now = new Date("2026-11-08T00:10:00+08:00");

function extraction(reference = "001234") {
  return {
    schema_version: "1",
    provider: "gcash",
    currency: "PHP",
    amount_centavos: 9900,
    reference_raw: reference,
    recipient_name: "TEST RECIPIENT",
    recipient_identifier: "TEST-GCASH-0000",
    payment_timestamp_raw: paidAt,
    parsed_payment_timestamp: paidAt,
    timestamp_timezone: "Asia/Manila",
    transaction_status: "completed",
    field_confidence: {
      amount_centavos: 0.99,
      reference_raw: 0.99,
      recipient_name: 0.99,
      recipient_identifier: 0.99,
      parsed_payment_timestamp: 0.99,
      transaction_status: 0.99,
    },
    missing_fields: [],
  };
}

test("concurrent reference claims have one winner and same-order retry is quiet", async () => {
  const pool = getPool(databaseUrl);
  await resetDatabase(pool);
  const root = await mkdtemp(join(tmpdir(), "blkjn-store-"));
  let clock = new Date("2026-11-07T23:40:00+08:00");
  const deps = { pool, config: testConfig(root), storage: createStorage(testConfig(root)), now: () => clock };
  const first = await createOrder(deps, {
    buyerEmail: "buyer-one@example.com",
    paymentMethod: "gcash",
    lines: [{ sku: "BLKJN-P01", quantity: 1, unitPhp: 1 }],
    buyerPaymentClaimedAt: paidAt,
  });
  const second = await createOrder(deps, {
    buyerEmail: "buyer-two@example.com",
    paymentMethod: "gcash",
    lines: [{ sku: "BLKJN-P01", quantity: 1 }],
    buyerPaymentClaimedAt: paidAt,
  });
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.totalCentavos, 9900);
  clock = new Date("2026-11-08T00:10:00+08:00");
  const [left, right] = await Promise.all([
    applyExtraction(deps, { orderId: first.orderId, idempotencyKey: "extract-a", extraction: extraction() }),
    applyExtraction(deps, { orderId: second.orderId, idempotencyKey: "extract-b", extraction: extraction() }),
  ]);
  const outcomes = [left, right].map((item) => item.ok ? item.outcome : item.error).sort();
  assert.deepEqual(outcomes, ["AUTO_APPROVED_RECEIPT", "DUPLICATE_REFERENCE_REJECTED"]);
  const retry = await applyExtraction(deps, { orderId: first.orderId, idempotencyKey: "extract-a", extraction: extraction() });
  assert.equal(retry.ok && retry.duplicate, true);
  const grants = await pool.query("SELECT count(*)::int AS count FROM download_grants");
  const claims = await pool.query("SELECT count(*)::int AS count FROM payment_reference_claims");
  assert.equal(grants.rows[0]?.count, 1);
  assert.equal(claims.rows[0]?.count, 1);
  const rejected = await pool.query("SELECT status FROM orders WHERE id = $1", [
    left.ok && left.outcome === "DUPLICATE_REFERENCE_REJECTED" ? first.orderId : second.orderId,
  ]);
  assert.equal(rejected.rows[0]?.status, "DUPLICATE_REFERENCE_REJECTED");
  const denied = await redeemDownload(deps, { token: "wrong-token", sku: "BLKJN-P01" });
  assert.equal(denied.ok, false);
});

test("request collection stays off and formula text is neutralized only after an explicit enable", async () => {
  const pool = getPool(databaseUrl);
  await resetDatabase(pool);
  const root = await mkdtemp(join(tmpdir(), "blkjn-req-"));
  const disabled = await acceptRequest(
    { pool, config: testConfig(root, { requestIntakeLive: false }), storage: null },
    { name: "Buyer", email: "buyer@example.com", message: "Hello" },
  );
  assert.equal(disabled.ok, false);
  if (!disabled.ok) assert.equal(disabled.error, "request_collection_disabled");
  const enabled = await acceptRequest(
    { pool, config: testConfig(root, { requestIntakeLive: true }), storage: null },
    { name: "Buyer", email: "buyer@example.com\nBcc: evil@example.com", message: "=HYPERLINK(\"http://evil\")" },
  );
  assert.equal(enabled.ok, false);
  const stored = await acceptRequest(
    { pool, config: testConfig(root, { requestIntakeLive: true }), storage: null },
    { name: "Buyer", email: "buyer@example.com", message: "=HYPERLINK(\"http://evil\")" },
  );
  assert.equal(stored.ok, true);
  const outbox = await pool.query<{ payload: { message: string } }>("SELECT payload FROM outbox WHERE topic = 'request.received'");
  assert.equal(outbox.rows[0]?.payload.message.startsWith("'="), true);
  assert.deepEqual(neutralizeRow({ message: "=1+1" }), { message: "'=1+1" });
});

test("receipt upload is durable once and an audit failure does not change the decision", async () => {
  const pool = getPool(databaseUrl);
  await resetDatabase(pool);
  const root = await mkdtemp(join(tmpdir(), "blkjn-receipt-"));
  const config = testConfig(root);
  const deps = { pool, config, storage: createStorage(config), now: () => now };
  const order = await createOrder(deps, {
    buyerEmail: "buyer@example.com",
    paymentMethod: "gcash",
    lines: [{ sku: "BLKJN-P02", quantity: 1 }],
    buyerPaymentClaimedAt: paidAt,
  });
  assert.equal(order.ok, true);
  if (!order.ok) return;
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const first = await submitReceipt(deps, { orderId: order.orderId, accessToken: order.accessToken, idempotencyKey: "up-1", bytes: png });
  const second = await submitReceipt(deps, { orderId: order.orderId, accessToken: order.accessToken, idempotencyKey: "up-1", bytes: png });
  assert.equal(first.ok && first.bankSettlementVerified, false);
  assert.equal(second.ok && second.duplicate, true);
  const submissions = await pool.query("SELECT count(*)::int AS count FROM receipt_submissions");
  assert.equal(submissions.rows[0]?.count, 1);
  const bad = Buffer.from("MZ-not-an-image");
  const rejected = await submitReceipt(deps, { orderId: order.orderId, accessToken: "nope", idempotencyKey: "up-2", bytes: bad });
  assert.equal(rejected.ok, false);
  const audit = await acknowledgeAudit(deps, { eventId: "missing", ok: false });
  assert.equal(audit.ok, false);
  const body = "{}";
  const timestamp = new Date(Date.now() - 10 * 60_000).toISOString();
  assert.equal(verifySignature({
    secret: "test-signing-secret",
    timestamp,
    body,
    signature: signBody("test-signing-secret", timestamp, body),
    nowMs: Date.now(),
  }), false);
});

test("an uncertain send does not mark the order delivered", async () => {
  const pool = getPool(databaseUrl);
  await resetDatabase(pool);
  const root = await mkdtemp(join(tmpdir(), "blkjn-mail-"));
  let clock = new Date("2026-11-07T23:40:00+08:00");
  const config = testConfig(root, { fulfillmentLive: true });
  const deps = {
    pool,
    config,
    storage: createStorage(config),
    now: () => clock,
    mailer: { async send() { return { outcome: "uncertain" as const }; } },
  };
  const order = await createOrder(deps, {
    buyerEmail: "buyer@example.com",
    paymentMethod: "gcash",
    lines: [{ sku: "BLKJN-P01", quantity: 1 }],
    buyerPaymentClaimedAt: paidAt,
  });
  assert.equal(order.ok, true);
  if (!order.ok) return;
  clock = new Date("2026-11-08T00:10:00+08:00");
  const result = await applyExtraction(deps, {
    orderId: order.orderId,
    idempotencyKey: "extract-uncertain",
    extraction: extraction("009001"),
  });
  assert.equal(result.ok && result.delivery, "uncertain");
  const status = await pool.query("SELECT status FROM orders WHERE id = $1", [order.orderId]);
  assert.equal(status.rows[0]?.status, "AUTO_APPROVED_RECEIPT");
});
