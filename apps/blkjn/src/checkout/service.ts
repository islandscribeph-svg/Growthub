import { createHash, randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import type { AppConfig } from "./config.ts";
import { migrate } from "./db.ts";
import { decideReceipt, type ReceiptPolicy } from "./receipt-decision.ts";
import { parseExtraction } from "./extraction.ts";
import { duplicateReferenceMessage, receiptPendingMessage } from "./messages.ts";
import { quoteLines, type QuoteLineInput } from "./quote.ts";
import {
  duplicateRejectedPayload,
  fulfillmentHeldPayload,
  fulfillmentRequestedPayload,
  receiptHashMatches,
  receiptSubmittedPayload,
  requestReceivedPayload,
} from "./make-contract.ts";
import { reservationState } from "./send-reservation.ts";
import { sniffReceipt, type ObjectStore } from "./storage.ts";

export type Failure = { ok: false; status: number; error: string };
export type MailResult = { outcome: "accepted"; providerMessageId: string } | { outcome: "uncertain" } | { outcome: "failed" };
export type Mailer = {
  send(input: { to: string; subject: string; body: string }): Promise<MailResult>;
};

type Deps = {
  pool: pg.Pool;
  config: AppConfig;
  storage: ObjectStore | null;
  mailer?: Mailer;
  now?: () => Date;
};

function fail(status: number, error: string): Failure {
  return { ok: false, status, error };
}

function token(): string {
  return randomBytes(32).toString("base64url");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function publicRef(): string {
  return `BLKJN-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function cleanEmail(value: string): string | null {
  const email = value.trim();
  if (email.length > 200 || /[\r\n]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function policyFor(config: AppConfig, order: {
  total_centavos: number;
  payment_method: "gcash" | "gotyme";
  created_at: Date;
  receipt_submitted_at: Date;
}): ReceiptPolicy {
  return {
    orderTotalCentavos: order.total_centavos,
    orderMethod: order.payment_method,
    orderCreatedAt: order.created_at.toISOString(),
    receiptSubmittedAt: order.receipt_submitted_at.toISOString(),
    windowHours: config.paymentWindowHours,
    clockSkewMinutes: config.clockSkewMinutes,
    minConfidence: config.minConfidence,
    recipientName: config.recipientName ?? "",
    gcashIdentifier: config.gcashIdentifier,
    gotymeIdentity: config.gotymeIdentity,
    gotymeSuffix: config.gotymeSuffix,
    maskedIdentifierAccepted: false,
  };
}

async function withTransaction<T>(pool: pg.Pool, run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await run(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createOrder(deps: Deps, input: {
  buyerEmail: string;
  paymentMethod: "gcash" | "gotyme";
  lines: QuoteLineInput[];
}) {
  if (!deps.config.databaseUrl) return fail(503, "configuration_unavailable");
  if (deps.config.mode === "live" && !deps.config.purchaseLive) return fail(403, "purchase_disabled");
  await migrate(deps.pool);
  if (deps.config.quoteTtlMinutes === null || deps.config.maxQuantity === null) return fail(503, "configuration_unavailable");
  const email = cleanEmail(input.buyerEmail);
  if (!email) return fail(400, "invalid_email");
  if (input.paymentMethod !== "gcash" && input.paymentMethod !== "gotyme") return fail(400, "invalid_method");
  const quote = quoteLines(input.lines, { maxQuantity: deps.config.maxQuantity });
  if (!quote.ok) return fail(400, quote.reason);
  const now = (deps.now ?? (() => new Date()))();
  const orderId = randomUUID();
  const accessToken = token();
  const ref = publicRef();
  const expires = new Date(now.getTime() + deps.config.quoteTtlMinutes * 60_000);
  await withTransaction(deps.pool, async (client) => {
    await client.query(
      `INSERT INTO orders
        (id, public_ref, environment, access_token_hash, buyer_email, currency, total_centavos, catalogue_version, status, payment_method, quote_expires_at, created_at, test_only)
       VALUES ($1,$2,$3,$4,$5,'PHP',$6,$7,'AWAITING_PAYMENT',$8,$9,$10,$11)`,
      [
        orderId,
        ref,
        deps.config.mode === "test" || !deps.config.purchaseLive ? "test" : "live",
        hash(accessToken),
        email,
        quote.totalCentavos,
        quote.catalogueVersion,
        input.paymentMethod,
        expires.toISOString(),
        now.toISOString(),
        !deps.config.purchaseLive,
      ],
    );
    for (const line of quote.lines) {
      await client.query(
        `INSERT INTO order_lines (id, order_id, sku, title_snapshot, unit_centavos, quantity, line_centavos)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [randomUUID(), orderId, line.sku, line.title, line.unitCentavos, line.quantity, line.lineCentavos],
      );
    }
    await client.query(
      `INSERT INTO order_events (id, order_id, event_type, idempotency_key, payload, created_at)
       VALUES ($1,$2,'order.created',$3,$4::jsonb,$5)`,
      [randomUUID(), orderId, `order.created:${orderId}`, JSON.stringify({ totalCentavos: quote.totalCentavos }), now.toISOString()],
    );
  });
  return {
    ok: true as const,
    orderId,
    publicRef: ref,
    accessToken,
    totalCentavos: quote.totalCentavos,
    currency: "PHP" as const,
    status: "AWAITING_PAYMENT",
    testOnly: !deps.config.purchaseLive,
    lines: quote.lines,
  };
}

async function authorizedOrder(pool: pg.Pool, orderId: string, accessToken: string) {
  const found = await pool.query<{ id: string; access_token_hash: string; status: string; public_ref: string }>(
    "SELECT id, access_token_hash, status, public_ref FROM orders WHERE id = $1",
    [orderId],
  );
  const order = found.rows[0];
  if (!order || order.access_token_hash !== hash(accessToken)) return null;
  return order;
}

export async function submitReceipt(deps: Deps, input: {
  orderId: string;
  accessToken: string;
  idempotencyKey: string;
  bytes: Buffer;
}) {
  if (!deps.config.databaseUrl) return fail(503, "configuration_unavailable");
  if (!deps.storage || deps.config.receiptMaxBytes === null) return fail(503, "configuration_unavailable");
  if (!input.idempotencyKey || input.idempotencyKey.length > 80) return fail(400, "invalid_idempotency_key");
  const order = await authorizedOrder(deps.pool, input.orderId, input.accessToken);
  if (!order) return fail(404, "order_not_found");
  if (order.status === "DELIVERED") return fail(409, "order_closed");
  const sniffed = sniffReceipt(input.bytes, deps.config.receiptMaxBytes);
  if (!sniffed.ok) return fail(400, sniffed.reason);
  const existing = await deps.pool.query(
    "SELECT id FROM receipt_submissions WHERE order_id = $1 AND idempotency_key = $2",
    [input.orderId, input.idempotencyKey],
  );
  if (existing.rowCount) {
    return { ok: true as const, duplicate: true, ...receiptPendingMessage(order.public_ref), bankSettlementVerified: false };
  }
  const stored = await deps.storage.putPrivate({
    orderId: input.orderId,
    bytes: input.bytes,
    contentType: sniffed.contentType,
  });
  const now = (deps.now ?? (() => new Date()))();
  const detail = await deps.pool.query<{ public_ref: string; created_at: Date; total_centavos: number; payment_method: "gcash" | "gotyme"; currency: "PHP" }>(
    "SELECT public_ref, created_at, total_centavos, payment_method, currency FROM orders WHERE id = $1",
    [input.orderId],
  );
  const lines = await deps.pool.query<{ sku: string; title_snapshot: string; quantity: number; unit_centavos: number; line_centavos: number }>(
    "SELECT sku, title_snapshot, quantity, unit_centavos, line_centavos FROM order_lines WHERE order_id = $1 ORDER BY sku",
    [input.orderId],
  );
  const receiptId = randomUUID();
  await withTransaction(deps.pool, async (client) => {
    const inserted = await client.query(
      `INSERT INTO receipt_submissions (id, order_id, idempotency_key, object_key, content_sha256, content_type, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'stored',$7)
       ON CONFLICT (order_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [receiptId, input.orderId, input.idempotencyKey, stored.objectKey, stored.sha256, sniffed.contentType, now.toISOString()],
    );
    if (!inserted.rowCount) return;
    await client.query("UPDATE orders SET status = 'RECEIPT_SUBMITTED' WHERE id = $1 AND status = 'AWAITING_PAYMENT'", [input.orderId]);
    const orderRow = detail.rows[0];
    if (!orderRow) return;
    await client.query(
      `INSERT INTO outbox (id, event_id, topic, payload, status, created_at)
       VALUES ($1,$2,'receipt.submitted',$3::jsonb,'pending',$4)`,
      [randomUUID(), `receipt.submitted:${input.orderId}:${input.idempotencyKey}`, JSON.stringify(receiptSubmittedPayload({
        orderId: input.orderId,
        publicRef: orderRow.public_ref,
        receiptId,
        idempotencyKey: input.idempotencyKey,
        objectKey: stored.objectKey,
        contentSha256: stored.sha256,
        contentType: sniffed.contentType,
        submittedAt: now.toISOString(),
        orderCreatedAt: new Date(orderRow.created_at).toISOString(),
        currency: "PHP",
        totalCentavos: orderRow.total_centavos,
        paymentMethod: orderRow.payment_method,
        lines: lines.rows.map((line) => ({
          sku: line.sku,
          title: line.title_snapshot,
          quantity: line.quantity,
          unitCentavos: line.unit_centavos,
          lineCentavos: line.line_centavos,
        })),
      })), now.toISOString()],
    );
  });
  return { ok: true as const, duplicate: false, ...receiptPendingMessage(order.public_ref), bankSettlementVerified: false };
}

export async function applyExtraction(deps: Deps, input: {
  orderId: string;
  idempotencyKey: string;
  extraction: unknown;
}) {
  if (!deps.config.databaseUrl) return fail(503, "configuration_unavailable");
  const parsed = parseExtraction(input.extraction);
  if (!parsed.ok) return fail(400, parsed.reason);
  const loaded = await deps.pool.query<{
    id: string;
    public_ref: string;
    status: string;
    total_centavos: number;
    payment_method: "gcash" | "gotyme";
    created_at: Date;
    buyer_email: string;
  }>("SELECT id, public_ref, status, total_centavos, payment_method, created_at, buyer_email FROM orders WHERE id = $1", [input.orderId]);
  const order = loaded.rows[0];
  if (!order) return fail(404, "order_not_found");
  const submitted = await deps.pool.query<{ created_at: Date }>(
    "SELECT created_at FROM receipt_submissions WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1",
    [input.orderId],
  );
  const receiptSubmittedAt = submitted.rows[0]?.created_at;
  if (!receiptSubmittedAt) return fail(409, "receipt_not_submitted");
  if (order.status === "DELIVERED") return fail(409, "order_closed");
  const prior = await deps.pool.query<{ payload: { outcome?: string; canonicalKey?: string } }>(
    "SELECT payload FROM order_events WHERE idempotency_key = $1",
    [input.idempotencyKey],
  );
  if (prior.rows[0]?.payload.outcome) {
    return { ok: true as const, duplicate: true, outcome: prior.rows[0].payload.outcome, canonicalKey: prior.rows[0].payload.canonicalKey ?? null };
  }
  const clock = (deps.now ?? (() => new Date()))();
  const decision = decideReceipt(parsed.value, policyFor(deps.config, {
    total_centavos: order.total_centavos,
    payment_method: order.payment_method,
    created_at: order.created_at,
    receipt_submitted_at: receiptSubmittedAt,
  }));
  if (decision.outcome === "NEEDS_REVIEW") {
    await recordDecision(deps, order.id, input.idempotencyKey, "NEEDS_REVIEW", { reasons: decision.reasons }, clock);
    return { ok: true as const, duplicate: false, outcome: "NEEDS_REVIEW" as const, filesReleased: false };
  }
  const claim = await withTransaction(deps.pool, async (client) => {
    const inserted = await client.query(
      `INSERT INTO payment_reference_claims (canonical_key, order_id, claimed_at)
       VALUES ($1,$2,$3)
       ON CONFLICT (canonical_key) DO NOTHING
       RETURNING order_id`,
      [decision.canonicalKey, order.id, clock.toISOString()],
    );
    const owner = inserted.rows[0]?.order_id as string | undefined;
    if (!owner) {
      const existing = await client.query<{ order_id: string }>(
        "SELECT order_id FROM payment_reference_claims WHERE canonical_key = $1",
        [decision.canonicalKey],
      );
      if (existing.rows[0]?.order_id !== order.id) {
        await client.query("UPDATE orders SET status = 'DUPLICATE_REFERENCE_REJECTED' WHERE id = $1", [order.id]);
        const message = duplicateReferenceMessage(order.public_ref);
        await client.query(
          `INSERT INTO outbox (id, event_id, topic, payload, status, created_at)
           VALUES ($1,$2,'receipt.duplicate_rejected',$3::jsonb,'pending',$4)
           ON CONFLICT (event_id) DO NOTHING`,
          [randomUUID(), `receipt.duplicate:${order.id}:${input.idempotencyKey}`, JSON.stringify(duplicateRejectedPayload({
            orderId: order.id,
            orderRef: order.public_ref,
            buyerEmail: order.buyer_email,
            subject: message.subject,
            body: message.body,
          })), clock.toISOString()],
        );
        await client.query(
          `INSERT INTO order_events (id, order_id, event_type, idempotency_key, payload, created_at)
           VALUES ($1,$2,'receipt.decision',$3,$4::jsonb,$5)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [randomUUID(), order.id, input.idempotencyKey, JSON.stringify({ outcome: "DUPLICATE_REFERENCE_REJECTED" }), clock.toISOString()],
        );
        return "other-order" as const;
      }
    }
    await client.query("UPDATE orders SET status = 'AUTO_APPROVED_RECEIPT' WHERE id = $1 AND status <> 'DELIVERED'", [order.id]);
    const fulfillment = await client.query(
      `INSERT INTO fulfillments (id, order_id, receipt_version, status, created_at)
       VALUES ($1,$2,1,'FULFILLMENT_PENDING',$3)
       ON CONFLICT (order_id, receipt_version) DO NOTHING
       RETURNING id`,
      [randomUUID(), order.id, clock.toISOString()],
    );
    const issued: { sku: string; token: string; downloadPath: string; expiresAt: string; remainingCount: number }[] = [];
    if (fulfillment.rows[0] && deps.config.fulfillmentLive && deps.config.downloadTtlMinutes && deps.config.downloadMaxCount) {
      for (const line of (await client.query<{ sku: string }>("SELECT sku FROM order_lines WHERE order_id = $1", [order.id])).rows) {
        const raw = token();
        const expiresAt = new Date(clock.getTime() + deps.config.downloadTtlMinutes * 60_000).toISOString();
        issued.push({
          sku: line.sku,
          token: raw,
          downloadPath: `/api/blkjn/downloads/${raw}?sku=${encodeURIComponent(line.sku)}`,
          expiresAt,
          remainingCount: deps.config.downloadMaxCount,
        });
        await client.query(
          `INSERT INTO download_grants (id, fulfillment_id, order_id, sku, token_hash, expires_at, remaining_count, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            randomUUID(),
            fulfillment.rows[0].id,
            order.id,
            line.sku,
            hash(raw),
            expiresAt,
            deps.config.downloadMaxCount,
            clock.toISOString(),
          ],
        );
      }
    }
    if (fulfillment.rows[0]) {
      await client.query(
        `INSERT INTO outbox (id, event_id, topic, payload, status, created_at)
         VALUES ($1,$2,$3,$4::jsonb,'pending',$5)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          randomUUID(),
          `fulfillment.${order.id}`,
          deps.config.fulfillmentLive ? "fulfillment.requested" : "fulfillment.held",
          JSON.stringify(deps.config.fulfillmentLive
            ? fulfillmentRequestedPayload({ orderId: order.id, orderRef: order.public_ref, buyerEmail: order.buyer_email, grants: issued })
            : fulfillmentHeldPayload({ orderId: order.id, orderRef: order.public_ref })),
          clock.toISOString(),
        ],
      );
    }
    await client.query(
      `INSERT INTO order_events (id, order_id, event_type, idempotency_key, payload, created_at)
       VALUES ($1,$2,'receipt.decision',$3,$4::jsonb,$5)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [randomUUID(), order.id, input.idempotencyKey, JSON.stringify({ outcome: "AUTO_APPROVED_RECEIPT", canonicalKey: decision.canonicalKey, meansBankSettlement: false }), clock.toISOString()],
    );
    return "claimed" as const;
  });
  if (claim === "other-order") {
    return { ok: true as const, duplicate: false, outcome: "DUPLICATE_REFERENCE_REJECTED" as const, filesReleased: false };
  }
  let delivery: "not_sent" | "accepted" | "uncertain" | "failed" = "not_sent";
  if (deps.config.fulfillmentLive && deps.mailer) {
    const sent = await deps.mailer.send({
      to: order.buyer_email,
      subject: `Your BLKJN downloads — order ${order.public_ref}`,
      body: "Test delivery. Links are issued only for purchased files.",
    });
    delivery = sent.outcome === "accepted" ? "accepted" : sent.outcome;
    const status = delivery === "accepted" ? "DELIVERED" : delivery === "uncertain" ? "DELIVERY_UNCERTAIN" : "FULFILLMENT_FAILED";
    await deps.pool.query("UPDATE fulfillments SET status = $2, provider_message_id = $3 WHERE order_id = $1 AND receipt_version = 1", [
      order.id,
      status,
      sent.outcome === "accepted" ? sent.providerMessageId : null,
    ]);
    if (delivery === "accepted") await deps.pool.query("UPDATE orders SET status = 'DELIVERED' WHERE id = $1", [order.id]);
  }
  return {
    ok: true as const,
    duplicate: false,
    outcome: "AUTO_APPROVED_RECEIPT" as const,
    meansBankSettlement: false as const,
    filesReleased: delivery === "accepted",
    delivery,
  };
}

async function recordDecision(deps: Deps, orderId: string, idempotencyKey: string, outcome: string, payload: unknown, now: Date) {
  await withTransaction(deps.pool, async (client) => {
    await client.query("UPDATE orders SET status = $2 WHERE id = $1 AND status <> 'DELIVERED'", [orderId, outcome]);
    await client.query(
      `INSERT INTO order_events (id, order_id, event_type, idempotency_key, payload, created_at)
       VALUES ($1,$2,'receipt.decision',$3,$4::jsonb,$5)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [randomUUID(), orderId, idempotencyKey, JSON.stringify({ outcome, ...(payload as object) }), now.toISOString()],
    );
  });
}

export async function acceptRequest(deps: Deps, input: { name: string; email: string; message: string }) {
  if (!deps.config.databaseUrl) return fail(503, "configuration_unavailable");
  if (!deps.config.requestIntakeLive) return fail(403, "request_collection_disabled");
  if (deps.config.requestRatePerHour === null) return fail(503, "configuration_unavailable");
  const email = cleanEmail(input.email);
  const name = input.name.trim();
  const message = input.message.trim();
  if (!email || name.length < 1 || name.length > 80 || message.length < 1 || message.length > 2000) return fail(400, "invalid_request");
  if (/[\r\n]/.test(name) || /[\r\n]/.test(message)) return fail(400, "invalid_request");
  const now = (deps.now ?? (() => new Date()))();
  const since = new Date(now.getTime() - 60 * 60_000).toISOString();
  try {
    return await withTransaction(deps.pool, async (client) => {
      const recent = await client.query(
        "SELECT count(*)::int AS hits FROM template_requests WHERE email = $1 AND created_at >= $2",
        [email, since],
      );
      if ((recent.rows[0]?.hits ?? 0) >= deps.config.requestRatePerHour!) return fail(429, "rate_limited");
      const id = randomUUID();
      await client.query(
        "INSERT INTO template_requests (id, name, email, message, status, created_at) VALUES ($1,$2,$3,$4,'accepted',$5)",
        [id, name, email, message, now.toISOString()],
      );
      await client.query(
        `INSERT INTO outbox (id, event_id, topic, payload, status, created_at)
         VALUES ($1,$2,'request.received',$3::jsonb,'pending',$4)`,
        [randomUUID(), `request.received:${id}`, JSON.stringify(requestReceivedPayload({
          requestId: id,
          name,
          email,
          message,
        })), now.toISOString()],
      );
      return { ok: true as const, requestId: id, status: "accepted" as const };
    });
  } catch (error) {
    if (error && typeof error === "object" && "ok" in error) return error as Failure;
    throw error;
  }
}

export async function acknowledgeAudit(deps: Deps, input: { eventId: string; ok: boolean; fenceToken?: string }) {
  if (!deps.config.databaseUrl) return fail(503, "configuration_unavailable");
  const current = await deps.pool.query<{ status: string; topic: string; fence_token: string | null; lease_until: Date | null }>(
    "SELECT status, topic, fence_token, lease_until FROM outbox WHERE event_id = $1",
    [input.eventId],
  );
  const row = current.rows[0];
  if (!row) return fail(404, "event_not_found");
  if (row.status === "audited") {
    return { ok: true as const, duplicate: true, status: "audited" as const, paymentDecisionChanged: false as const };
  }
  if (!input.fenceToken || row.fence_token !== input.fenceToken) return fail(409, "stale_fence");
  const owned = row.status === "leased" && row.lease_until !== null && row.lease_until.getTime() > Date.now();
  const sendTopic = row.topic === "request.received" || row.topic === "receipt.duplicate_rejected" || row.topic === "fulfillment.requested";
  if (input.ok) {
    if (sendTopic) {
      const state = await reservationState(deps.pool, input.eventId);
      if (state !== "accepted" && state !== "uncertain") return fail(409, "send_not_reported");
    } else if (!owned && row.status !== "mail_accepted" && row.status !== "mail_uncertain") {
      return fail(409, "stale_fence");
    }
    const updated = await deps.pool.query(
      "UPDATE outbox SET status = 'audited', lease_until = NULL WHERE event_id = $1 AND fence_token = $2 RETURNING event_id",
      [input.eventId, input.fenceToken],
    );
    if (!updated.rowCount) return fail(409, "stale_fence");
    return { ok: true as const, duplicate: false, status: "audited" as const, paymentDecisionChanged: false as const };
  }
  if (!owned) return fail(409, "stale_fence");
  await deps.pool.query(
    "UPDATE outbox SET status = 'pending', lease_until = NULL, fence_token = NULL WHERE event_id = $1 AND fence_token = $2",
    [input.eventId, input.fenceToken],
  );
  return { ok: true as const, duplicate: false, status: "pending" as const, retry: true, paymentDecisionChanged: false as const };
}

type OutboxRow = {
  event_id: string;
  topic: string;
  payload: unknown;
  status: string;
  created_at: Date;
  attempt_count: number;
};

type ClaimRow = OutboxRow & { fence_generation: number };

function outboxEvent(row: OutboxRow) {
  return {
    eventId: row.event_id,
    topic: row.topic,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    attemptCount: row.attempt_count,
    payload: row.payload,
  };
}

export async function listOutbox(deps: Deps) {
  if (!deps.config.databaseUrl) return fail(503, "configuration_unavailable");
  const rows = await deps.pool.query<OutboxRow>(
    `SELECT event_id, topic, payload, status, created_at, attempt_count
     FROM outbox
     WHERE (status = 'pending' AND (lease_until IS NULL OR lease_until <= now()))
        OR (status = 'leased' AND lease_until <= now())
     ORDER BY created_at ASC
     LIMIT 20`,
  );
  return { ok: true as const, events: rows.rows.map(outboxEvent) };
}

function claimResult(row: ClaimRow, seconds: number, fenceToken: string, renewed: boolean) {
  return {
    ok: true as const,
    duplicate: false as const,
    renewed,
    leaseSeconds: seconds,
    fenceToken,
    fenceGeneration: row.fence_generation,
    event: outboxEvent(row),
  };
}

export async function claimOutbox(deps: Deps, input: { eventId: string; leaseSeconds?: number; fenceToken?: string }) {
  if (!deps.config.databaseUrl) return fail(503, "configuration_unavailable");
  const seconds = Math.min(300, Math.max(30, input.leaseSeconds ?? 120));
  if (input.fenceToken) {
    const renewed = await deps.pool.query<ClaimRow>(
      `UPDATE outbox
       SET lease_until = now() + make_interval(secs => $2::integer)
       WHERE event_id = $1 AND status = 'leased' AND fence_token = $3 AND lease_until > now()
       RETURNING event_id, topic, payload, status, created_at, attempt_count, fence_generation`,
      [input.eventId, seconds, input.fenceToken],
    );
    if (renewed.rows[0]) return claimResult(renewed.rows[0], seconds, input.fenceToken, true);
    const current = await deps.pool.query<{ status: string; fence_token: string | null }>(
      "SELECT status, fence_token FROM outbox WHERE event_id = $1",
      [input.eventId],
    );
    if (!current.rowCount) return fail(404, "event_not_found");
    if (current.rows[0].status === "audited" || current.rows[0].status === "mail_accepted" || current.rows[0].status === "mail_uncertain") {
      return { ok: true as const, duplicate: true as const, status: current.rows[0].status };
    }
    if (current.rows[0].fence_token === input.fenceToken) return fail(409, "stale_fence");
    return fail(409, "lease_held");
  }
  const fenceToken = randomBytes(32).toString("base64url");
  const claimed = await deps.pool.query<ClaimRow>(
    `UPDATE outbox
     SET status = 'leased',
         lease_until = now() + make_interval(secs => $2::integer),
         attempt_count = attempt_count + 1,
         fence_token = $3,
         fence_generation = fence_generation + 1
     WHERE event_id = $1 AND (
       (status = 'pending' AND (lease_until IS NULL OR lease_until <= now()))
       OR (status = 'leased' AND lease_until <= now())
     )
     RETURNING event_id, topic, payload, status, created_at, attempt_count, fence_generation`,
    [input.eventId, seconds, fenceToken],
  );
  if (claimed.rows[0]) return claimResult(claimed.rows[0], seconds, fenceToken, false);
  const current = await deps.pool.query<{ status: string }>("SELECT status FROM outbox WHERE event_id = $1", [input.eventId]);
  if (!current.rowCount) return fail(404, "event_not_found");
  const status = current.rows[0].status;
  if (status === "audited" || status === "mail_accepted" || status === "mail_uncertain") {
    return { ok: true as const, duplicate: true as const, status };
  }
  return fail(409, "lease_held");
}

export async function readReceiptObject(deps: Deps, input: { orderId: string; objectKey: string }) {
  if (!deps.config.databaseUrl || !deps.storage) return fail(503, "configuration_unavailable");
  const found = await deps.pool.query<{ content_type: string; content_sha256: string }>(
    "SELECT content_type, content_sha256 FROM receipt_submissions WHERE order_id = $1 AND object_key = $2",
    [input.orderId, input.objectKey],
  );
  const row = found.rows[0];
  if (!row) return fail(404, "object_not_found");
  const bytes = await deps.storage.getPrivate(input.objectKey, input.orderId);
  if (!bytes) return fail(404, "object_not_found");
  if (!receiptHashMatches(bytes, row.content_sha256)) return fail(409, "receipt_hash_mismatch");
  return { ok: true as const, contentType: row.content_type, sha256: row.content_sha256, bytesBase64: bytes.toString("base64") };
}

export async function redeemDownload(deps: Deps, input: { token: string; sku: string }) {
  if (!deps.config.databaseUrl || !deps.config.deliverableRoot || !deps.config.fulfillmentLive) {
    return fail(503, "configuration_unavailable");
  }
  const found = await deps.pool.query<{ id: string; remaining_count: number; expires_at: Date; sku: string }>(
    "SELECT id, remaining_count, expires_at, sku FROM download_grants WHERE token_hash = $1",
    [hash(input.token)],
  );
  const grant = found.rows[0];
  const now = (deps.now ?? (() => new Date()))();
  if (!grant || grant.sku !== input.sku || grant.expires_at.getTime() <= now.getTime() || grant.remaining_count < 1) {
    return fail(403, "download_denied");
  }
  const consumed = await deps.pool.query(
    "UPDATE download_grants SET remaining_count = remaining_count - 1 WHERE id = $1 AND remaining_count > 0 RETURNING remaining_count",
    [grant.id],
  );
  if (!consumed.rowCount) return fail(403, "download_denied");
  return { ok: true as const, sku: grant.sku, root: deps.config.deliverableRoot };
}
