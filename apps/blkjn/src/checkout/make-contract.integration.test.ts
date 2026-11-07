import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { POST as claimRoute } from "../app/api/blkjn/make/outbox/claim/route.ts";
import { GET as outboxRoute } from "../app/api/blkjn/make/outbox/route.ts";
import { POST as receiptRoute } from "../app/api/blkjn/make/receipt-objects/route.ts";
import { POST as requestSendRoute } from "../app/api/blkjn/make/request-sends/route.ts";
import { readConfig, type AppConfig } from "./config.ts";
import { getPool, resetDatabase } from "./db.ts";
import { parseExtraction } from "./extraction.ts";
import {
  duplicateRejectedKeys,
  fulfillmentHeldKeys,
  fulfillmentRequestedKeys,
  hasKeys,
  orderLineKeys,
  outboxEventKeys,
  receiptSubmittedKeys,
  requestReceivedKeys,
} from "./make-contract.ts";
import {
  acceptRequest,
  acknowledgeAudit,
  applyExtraction,
  claimOutbox,
  createOrder,
  listOutbox,
  readReceiptObject,
  reportDelivery,
  reportRequestSend,
  submitReceipt,
} from "./service.ts";
import { signBody } from "./signature.ts";
import { createStorage } from "./storage.ts";

const databaseUrl = process.env.BLKJN_TEST_DATABASE_URL
  ?? "postgresql://growthub:growthub@localhost:5432/blkjn_checkout_test";
const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../docs/make-fixtures.json"), "utf8")) as {
  vectors: { name: string; path: string; timestamp: string; rawBody: string; signature: string }[];
};

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

function signed(method: string, path: string, rawBody: string, timestamp = new Date().toISOString()) {
  return new Request(`https://blkjn.example${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-blkjn-timestamp": timestamp,
      "x-blkjn-signature": signBody("test-signing-secret", timestamp, rawBody),
    },
    body: method === "GET" ? undefined : rawBody,
  });
}

function useRouteEnv(root: string) {
  const previous = { ...process.env };
  Object.assign(process.env, {
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
    BLKJN_PURCHASE_LIVE: "false",
    BLKJN_REQUEST_INTAKE_LIVE: "false",
    BLKJN_FULFILLMENT_LIVE: "false",
  });
  return () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  };
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test("runtime outbox, receipt fetch, lease, and request ack match the fixture schema", async () => {
  const pool = getPool(databaseUrl);
  await resetDatabase(pool);
  const root = await mkdtemp(join(tmpdir(), "blkjn-contract-"));
  const restore = useRouteEnv(root);
  try {
    let clock = new Date("2026-11-07T23:40:00+08:00");
    const deps = { pool, config: testConfig(root), storage: createStorage(testConfig(root)), now: () => clock };
    const order = await createOrder(deps, {
      buyerEmail: "buyer@example.com",
      paymentMethod: "gcash",
      lines: [{ sku: "BLKJN-P01", quantity: 1, unitPhp: 1 }],
    });
    const second = await createOrder(deps, {
      buyerEmail: "buyer-two@example.com",
      paymentMethod: "gcash",
      lines: [{ sku: "BLKJN-P01", quantity: 1 }],
    });
    assert.equal(order.ok && second.ok, true);
    if (!order.ok || !second.ok) return;
    clock = new Date("2026-11-07T23:55:00+08:00");
    const uploaded = await submitReceipt(deps, {
      orderId: order.orderId,
      accessToken: order.accessToken,
      idempotencyKey: "up-1",
      bytes: png,
    });
    assert.equal(uploaded.ok && uploaded.bankSettlementVerified, false);
    const listed = await listOutbox(deps);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.events.length, 1);
    const event = listed.events[0];
    assert.equal(hasKeys(event, outboxEventKeys), true);
    assert.equal(event.topic, "receipt.submitted");
    assert.equal(event.attemptCount, 0);
    assert.equal(hasKeys(event.payload, receiptSubmittedKeys), true);
    const payload = event.payload as { lines: unknown[]; totalCentavos: number; currency: string; paymentMethod: string; objectKey: string; contentSha256: string };
    assert.equal(hasKeys(payload.lines[0], orderLineKeys), true);
    assert.equal(payload.totalCentavos, 9900);
    assert.equal(payload.currency, "PHP");
    assert.equal(payload.paymentMethod, "gcash");
    assert.equal("buyerEmail" in (event.payload as object), false);

    const claimed = await claimOutbox(deps, { eventId: event.eventId, leaseSeconds: 120 });
    assert.equal(claimed.ok && claimed.duplicate, false);
    if (!claimed.ok || claimed.duplicate) return;
    assert.equal(claimed.leaseSeconds, 120);
    assert.equal(claimed.event.status, "leased");
    assert.equal(claimed.event.attemptCount, 1);
    const held = await claimOutbox(deps, { eventId: event.eventId });
    assert.equal(held.ok, false);
    if (!held.ok) assert.equal(held.error, "lease_held");
    const hidden = await listOutbox(deps);
    assert.equal(hidden.ok && hidden.events.length, 0);

    const object = await readReceiptObject(deps, { orderId: order.orderId, objectKey: payload.objectKey });
    assert.equal(object.ok && object.bytesBase64, png.toString("base64"));
    if (object.ok) assert.equal(object.sha256, payload.contentSha256);
    const otherOrder = await readReceiptObject(deps, {
      orderId: "00000000-0000-4000-8000-000000000099",
      objectKey: payload.objectKey,
    });
    assert.equal(otherOrder.ok, false);

    const receiptBody = JSON.stringify({ orderId: order.orderId, objectKey: payload.objectKey });
    const receiptResponse = await receiptRoute(signed("POST", "/api/blkjn/make/receipt-objects/", receiptBody));
    assert.equal(receiptResponse.status, 200);
    const receiptJson = await receiptResponse.json() as { bytesBase64: string; sha256: string; contentType: string };
    assert.equal(receiptJson.bytesBase64, png.toString("base64"));
    assert.equal(receiptJson.sha256, payload.contentSha256);
    assert.equal(receiptJson.contentType, "image/png");

    const released = await acknowledgeAudit(deps, { eventId: event.eventId, ok: false });
    assert.equal(released.ok && released.status, "pending");
    if (released.ok) assert.equal(released.paymentDecisionChanged, false);
    const visible = await listOutbox(deps);
    assert.equal(visible.ok && visible.events.length, 1);
    const again = await claimOutbox(deps, { eventId: event.eventId, leaseSeconds: 120 });
    assert.equal(again.ok && !again.duplicate && again.event.attemptCount, 2);
    const audited = await acknowledgeAudit(deps, { eventId: event.eventId, ok: true });
    assert.equal(audited.ok && audited.status, "audited");
    if (audited.ok) assert.equal(audited.paymentDecisionChanged, false);
    const repeat = await acknowledgeAudit(deps, { eventId: event.eventId, ok: true });
    assert.equal(repeat.ok && repeat.duplicate, true);
    if (repeat.ok) assert.equal(repeat.paymentDecisionChanged, false);

    const frozen = fixture.vectors.find((vector) => vector.name === "getOutbox");
    assert.ok(frozen);
    const stale = await outboxRoute(signed("GET", frozen.path, "", frozen.timestamp));
    if (Math.abs(Date.now() - Date.parse(frozen.timestamp)) > 5 * 60_000) assert.equal(stale.status, 401);
    const fresh = await outboxRoute(signed("GET", "/api/blkjn/make/outbox/", ""));
    assert.equal(fresh.status, 200);
    const freshJson = await fresh.json() as { ok: boolean; events: unknown[] };
    assert.equal(freshJson.ok, true);
    assert.equal(freshJson.events.length, 0);
    const badClaim = await claimRoute(new Request("https://blkjn.example/api/blkjn/make/outbox/claim/", {
      method: "POST",
      headers: { "x-blkjn-timestamp": new Date().toISOString(), "x-blkjn-signature": "00" },
      body: "{}",
    }));
    assert.equal(badClaim.status, 401);

    clock = new Date("2026-11-08T00:10:00+08:00");
    const extractionVector = fixture.vectors.find((vector) => vector.name === "postExtraction");
    assert.ok(extractionVector);
    const fixtureExtraction = parseExtraction((JSON.parse(extractionVector.rawBody) as { extraction: unknown }).extraction);
    assert.equal(fixtureExtraction.ok, true);
    const decided = await applyExtraction(deps, {
      orderId: order.orderId,
      idempotencyKey: "extract-1",
      extraction: fixtureExtraction.ok ? fixtureExtraction.value : {},
    });
    assert.equal(decided.ok && decided.outcome, "AUTO_APPROVED_RECEIPT");
    if (decided.ok && decided.outcome === "AUTO_APPROVED_RECEIPT") {
      assert.equal(decided.meansBankSettlement, false);
      assert.equal(decided.filesReleased, false);
      assert.equal(decided.delivery, "not_sent");
    }
    const heldEvents = await listOutbox(deps);
    assert.equal(heldEvents.ok, true);
    if (!heldEvents.ok) return;
    const heldEvent = heldEvents.events.find((item) => item.topic === "fulfillment.held");
    assert.ok(heldEvent);
    assert.equal(hasKeys(heldEvent.payload, fulfillmentHeldKeys), true);
    assert.equal((heldEvent.payload as { reason: string }).reason, "fulfillment_disabled");
    const deliveryBlocked = await reportDelivery(deps, {
      orderId: order.orderId,
      idempotencyKey: "delivery-1",
      outcome: "accepted",
      providerMessageId: "synthetic-message-1",
    });
    assert.equal(deliveryBlocked.ok, false);
    if (!deliveryBlocked.ok) assert.equal(deliveryBlocked.error, "fulfillment_disabled");

    clock = new Date("2026-11-07T23:55:00+08:00");
    assert.equal((await submitReceipt(deps, {
      orderId: second.orderId,
      accessToken: second.accessToken,
      idempotencyKey: "up-2",
      bytes: png,
    })).ok, true);
    clock = new Date("2026-11-08T00:10:00+08:00");
    const duplicate = await applyExtraction(deps, {
      orderId: second.orderId,
      idempotencyKey: "extract-2",
      extraction: fixtureExtraction.ok ? fixtureExtraction.value : {},
    });
    assert.equal(duplicate.ok && duplicate.outcome, "DUPLICATE_REFERENCE_REJECTED");
    const duplicateEvent = await pool.query<{ payload: unknown }>("SELECT payload FROM outbox WHERE topic = 'receipt.duplicate_rejected'");
    assert.equal(hasKeys(duplicateEvent.rows[0]?.payload, duplicateRejectedKeys), true);

    const disabled = await acceptRequest(deps, { name: "Buyer", email: "buyer@example.com", message: "Hello" });
    assert.equal(disabled.ok, false);
    if (!disabled.ok) assert.equal(disabled.error, "request_collection_disabled");
    const enabled = await acceptRequest(
      { ...deps, config: testConfig(root, { requestIntakeLive: true }) },
      { name: "Buyer", email: "buyer@example.com", message: "=CMD" },
    );
    assert.equal(enabled.ok, true);
    if (!enabled.ok) return;
    const requestEventId = `request.received:${enabled.requestId}`;
    const requestRow = await pool.query<{ payload: unknown }>("SELECT payload FROM outbox WHERE event_id = $1", [requestEventId]);
    assert.equal(hasKeys(requestRow.rows[0]?.payload, requestReceivedKeys), true);
    assert.equal((requestRow.rows[0]?.payload as { message: string }).message.startsWith("'="), true);
    const wrongAck = await acknowledgeAudit(deps, { eventId: requestEventId, ok: true });
    assert.equal(wrongAck.ok, false);
    if (!wrongAck.ok) assert.equal(wrongAck.error, "use_request_send_ack");
    const uncertain = await reportRequestSend(deps, {
      eventId: requestEventId,
      idempotencyKey: "request-mail-1",
      outcome: "uncertain",
      providerMessageId: "synthetic-message-1",
    });
    assert.equal(uncertain.ok && uncertain.mailState, "uncertain");
    if (uncertain.ok) {
      assert.equal(uncertain.emailSentByBackend, false);
      assert.equal(uncertain.resent, false);
    }
    const conflict = await reportRequestSend(deps, {
      eventId: requestEventId,
      idempotencyKey: "request-mail-2",
      outcome: "accepted",
      providerMessageId: "different-message",
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.error, "reconcile_required");
    const reconciled = await reportRequestSend(deps, {
      eventId: requestEventId,
      idempotencyKey: "request-mail-3",
      outcome: "accepted",
      providerMessageId: "synthetic-message-1",
    });
    assert.equal(reconciled.ok && reconciled.mailState, "accepted");
    if (reconciled.ok) assert.equal(reconciled.emailSentByBackend, false);
    const requestRouteBody = JSON.stringify({
      eventId: requestEventId,
      idempotencyKey: "request-mail-3",
      outcome: "accepted",
      providerMessageId: "synthetic-message-1",
    });
    const requestRouteResponse = await requestSendRoute(signed("POST", "/api/blkjn/make/request-sends/", requestRouteBody));
    assert.equal(requestRouteResponse.status, 200);
    const requestRouteJson = await requestRouteResponse.json() as { duplicate: boolean; emailSentByBackend: boolean };
    assert.equal(requestRouteJson.duplicate, true);
    assert.equal(requestRouteJson.emailSentByBackend, false);
  } finally {
    restore();
  }
});

test("a fulfillment-live test grant is reported by the worker without a backend send", async () => {
  const pool = getPool(databaseUrl);
  await resetDatabase(pool);
  const root = await mkdtemp(join(tmpdir(), "blkjn-grant-"));
  let clock = new Date("2026-11-07T23:40:00+08:00");
  const config = testConfig(root, { fulfillmentLive: true });
  const deps = { pool, config, storage: createStorage(config), now: () => clock };
  const order = await createOrder(deps, {
    buyerEmail: "buyer@example.com",
    paymentMethod: "gcash",
    lines: [{ sku: "BLKJN-P01", quantity: 1 }],
  });
  assert.equal(order.ok, true);
  if (!order.ok) return;
  clock = new Date("2026-11-07T23:55:00+08:00");
  assert.equal((await submitReceipt(deps, {
    orderId: order.orderId,
    accessToken: order.accessToken,
    idempotencyKey: "up-live",
    bytes: png,
  })).ok, true);
  clock = new Date("2026-11-08T00:10:00+08:00");
  const extractionVector = fixture.vectors.find((vector) => vector.name === "postExtraction");
  assert.ok(extractionVector);
  const extraction = parseExtraction((JSON.parse(extractionVector.rawBody) as { extraction: unknown }).extraction);
  const decided = await applyExtraction(deps, {
    orderId: order.orderId,
    idempotencyKey: "extract-live",
    extraction: extraction.ok ? { ...extraction.value, reference_raw: "009002" } : {},
  });
  assert.equal(decided.ok && decided.delivery, "not_sent");
  const listed = await listOutbox(deps);
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  const requested = listed.events.find((item) => item.topic === "fulfillment.requested");
  assert.ok(requested);
  assert.equal(hasKeys(requested.payload, fulfillmentRequestedKeys), true);
  const grant = (requested.payload as { grants: { downloadPath: string; token: string; sku: string }[] }).grants[0];
  assert.equal(grant.downloadPath, `/api/blkjn/downloads/${grant.token}?sku=${encodeURIComponent(grant.sku)}`);
  const missing = await reportDelivery(deps, {
    orderId: order.orderId,
    idempotencyKey: "delivery-missing",
    outcome: "uncertain",
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "missing_provider_message_id");
  const uncertain = await reportDelivery(deps, {
    orderId: order.orderId,
    idempotencyKey: "delivery-1",
    outcome: "uncertain",
    providerMessageId: "synthetic-message-1",
  });
  assert.equal(uncertain.ok && uncertain.status, "DELIVERY_UNCERTAIN");
  if (uncertain.ok) assert.equal(uncertain.resent, false);
  const status = await pool.query("SELECT status FROM orders WHERE id = $1", [order.orderId]);
  assert.equal(status.rows[0]?.status, "AUTO_APPROVED_RECEIPT");
  const same = await reportDelivery(deps, {
    orderId: order.orderId,
    idempotencyKey: "delivery-1",
    outcome: "accepted",
    providerMessageId: "synthetic-message-1",
  });
  assert.equal(same.ok && same.duplicate, true);
  if (same.ok) assert.equal(same.status, "DELIVERY_UNCERTAIN");
  const conflict = await reportDelivery(deps, {
    orderId: order.orderId,
    idempotencyKey: "delivery-2",
    outcome: "accepted",
    providerMessageId: "different-message",
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error, "reconcile_required");
  const reconciled = await reportDelivery(deps, {
    orderId: order.orderId,
    idempotencyKey: "delivery-3",
    outcome: "accepted",
    providerMessageId: "synthetic-message-1",
  });
  assert.equal(reconciled.ok && reconciled.status, "DELIVERED");
  if (reconciled.ok) assert.equal(reconciled.resent, false);
  const delivered = await pool.query("SELECT status FROM orders WHERE id = $1", [order.orderId]);
  assert.equal(delivered.rows[0]?.status, "DELIVERED");
});
