import { randomUUID } from "node:crypto";
import type pg from "pg";
import { sendActions, type SendAction } from "./make-contract.ts";

export type SendState = "reserved" | "accepted" | "uncertain" | "failed";
export type SendOutcome = "accepted" | "uncertain" | "failed";

export type SendView = {
  ok: true;
  action: SendAction;
  eventId: string;
  state: SendState;
  sendBlocked: boolean;
  stopped: boolean;
  owner: boolean;
  providerMessageId: string | null;
  resent: false;
  emailSentByBackend: false;
  duplicate: boolean;
};

type Failure = { ok: false; status: number; error: string };

type ReservationRow = {
  fence_token: string;
  state: SendState;
  provider_message_id: string | null;
  report_key: string | null;
};

type EventRow = {
  topic: string;
  status: string;
  fence_token: string | null;
  lease_until: Date | null;
  payload: { orderId?: string };
};

function fail(status: number, error: string): Failure {
  return { ok: false, status, error };
}

function isAction(value: string): value is SendAction {
  return (sendActions as readonly string[]).includes(value);
}

function topicFor(action: SendAction): string {
  switch (action) {
    case "request_mail":
      return "request.received";
    case "duplicate_notice":
      return "receipt.duplicate_rejected";
    case "fulfillment_delivery":
      return "fulfillment.requested";
    default: {
      const never: never = action;
      return never;
    }
  }
}

function view(input: {
  action: SendAction;
  eventId: string;
  state: SendState;
  owner: boolean;
  sendBlocked: boolean;
  providerMessageId: string | null;
  duplicate: boolean;
}): SendView {
  return {
    ok: true,
    action: input.action,
    eventId: input.eventId,
    state: input.state,
    sendBlocked: input.sendBlocked,
    stopped: input.state === "uncertain",
    owner: input.owner,
    providerMessageId: input.providerMessageId,
    resent: false,
    emailSentByBackend: false,
    duplicate: input.duplicate,
  };
}

async function loadEvent(pool: pg.Pool, eventId: string): Promise<EventRow | null> {
  const found = await pool.query<EventRow>(
    "SELECT topic, status, fence_token, lease_until, payload FROM outbox WHERE event_id = $1",
    [eventId],
  );
  return found.rows[0] ?? null;
}

function leaseOwned(event: EventRow, fenceToken: string): boolean {
  return event.status === "leased"
    && event.fence_token === fenceToken
    && event.lease_until !== null
    && event.lease_until.getTime() > Date.now();
}

async function loadReservation(pool: pg.Pool, eventId: string, action: SendAction): Promise<ReservationRow | null> {
  const found = await pool.query<ReservationRow>(
    "SELECT fence_token, state, provider_message_id, report_key FROM send_reservations WHERE event_id = $1 AND action = $2",
    [eventId, action],
  );
  return found.rows[0] ?? null;
}

async function applyFulfillment(pool: pg.Pool, orderId: string, state: SendState, providerMessageId: string | null): Promise<Failure | null> {
  const found = await pool.query<{ status: string; provider_message_id: string | null }>(
    "SELECT status, provider_message_id FROM fulfillments WHERE order_id = $1 AND receipt_version = 1",
    [orderId],
  );
  const current = found.rows[0];
  if (!current) return fail(409, "fulfillment_not_reserved");
  if (current.status === "DELIVERED") {
    if (state === "accepted" && providerMessageId && providerMessageId === current.provider_message_id) return null;
    if (current.provider_message_id && providerMessageId && providerMessageId !== current.provider_message_id) {
      return fail(409, "reconcile_required");
    }
    return null;
  }
  if (state === "accepted") {
    await pool.query(
      "UPDATE fulfillments SET status = 'DELIVERED', provider_message_id = $2 WHERE order_id = $1 AND receipt_version = 1",
      [orderId, providerMessageId],
    );
    await pool.query("UPDATE orders SET status = 'DELIVERED' WHERE id = $1", [orderId]);
    return null;
  }
  if (state === "uncertain") {
    await pool.query(
      "UPDATE fulfillments SET status = 'DELIVERY_UNCERTAIN', provider_message_id = COALESCE($2, provider_message_id) WHERE order_id = $1 AND receipt_version = 1",
      [orderId, providerMessageId],
    );
    return null;
  }
  await pool.query(
    "UPDATE fulfillments SET status = 'FULFILLMENT_FAILED' WHERE order_id = $1 AND receipt_version = 1",
    [orderId],
  );
  return null;
}

async function markOutbox(pool: pg.Pool, eventId: string, state: SendState) {
  if (state === "accepted") {
    await pool.query("UPDATE outbox SET status = 'mail_accepted', lease_until = NULL WHERE event_id = $1", [eventId]);
  } else if (state === "uncertain") {
    await pool.query("UPDATE outbox SET status = 'mail_uncertain', lease_until = NULL WHERE event_id = $1", [eventId]);
  }
}

export async function reserveSend(deps: { pool: pg.Pool; fulfillmentLive: boolean }, input: {
  eventId: string;
  action: string;
  fenceToken: string;
}): Promise<SendView | Failure> {
  if (!isAction(input.action)) return fail(400, "invalid_send");
  if (!input.fenceToken) return fail(400, "missing_fence");
  if (input.action === "fulfillment_delivery" && !deps.fulfillmentLive) return fail(403, "fulfillment_disabled");
  const event = await loadEvent(deps.pool, input.eventId);
  if (!event || event.topic !== topicFor(input.action)) return fail(404, "send_event_not_found");
  const existing = await loadReservation(deps.pool, input.eventId, input.action);
  if (existing?.state === "failed" && leaseOwned(event, input.fenceToken)) {
    const reopened = await deps.pool.query<ReservationRow>(
      `UPDATE send_reservations
       SET state = 'reserved', fence_token = $3, provider_message_id = NULL, report_key = NULL, updated_at = now()
       WHERE event_id = $1 AND action = $2 AND state = 'failed'
       RETURNING fence_token, state, provider_message_id, report_key`,
      [input.eventId, input.action, input.fenceToken],
    );
    const row = reopened.rows[0];
    if (row) {
      return view({
        action: input.action,
        eventId: input.eventId,
        state: "reserved",
        owner: true,
        sendBlocked: false,
        providerMessageId: null,
        duplicate: false,
      });
    }
  }
  if (!leaseOwned(event, input.fenceToken)) {
    if (existing) {
      return view({
        action: input.action,
        eventId: input.eventId,
        state: existing.state,
        owner: false,
        sendBlocked: true,
        providerMessageId: existing.provider_message_id,
        duplicate: true,
      });
    }
    return fail(409, "stale_fence");
  }
  const created = await deps.pool.query<ReservationRow>(
    `INSERT INTO send_reservations (id, event_id, action, fence_token, state, provider_message_id, report_key, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'reserved',NULL,NULL,now(),now())
     ON CONFLICT (event_id, action) DO NOTHING
     RETURNING fence_token, state, provider_message_id, report_key`,
    [randomUUID(), input.eventId, input.action, input.fenceToken],
  );
  if (created.rows[0]) {
    return view({
      action: input.action,
      eventId: input.eventId,
      state: "reserved",
      owner: true,
      sendBlocked: false,
      providerMessageId: null,
      duplicate: false,
    });
  }
  const current = await loadReservation(deps.pool, input.eventId, input.action);
  if (!current) return fail(409, "send_reserved");
  return view({
    action: input.action,
    eventId: input.eventId,
    state: current.state,
    owner: current.fence_token === input.fenceToken && current.state === "reserved",
    sendBlocked: true,
    providerMessageId: current.provider_message_id,
    duplicate: true,
  });
}

export async function reportSend(deps: { pool: pg.Pool; fulfillmentLive: boolean }, input: {
  eventId: string;
  action: string;
  fenceToken: string;
  outcome: string;
  providerMessageId?: string | null;
  idempotencyKey: string;
}): Promise<SendView | Failure> {
  if (!isAction(input.action)) return fail(400, "invalid_send");
  if (input.outcome !== "accepted" && input.outcome !== "uncertain" && input.outcome !== "failed") return fail(400, "invalid_send");
  if (!input.fenceToken) return fail(400, "missing_fence");
  if (!input.idempotencyKey) return fail(400, "invalid_send");
  if (input.action === "fulfillment_delivery" && !deps.fulfillmentLive) return fail(403, "fulfillment_disabled");
  const providerMessageId = input.providerMessageId?.trim() ? input.providerMessageId.trim() : null;
  if (input.outcome === "accepted" && !providerMessageId) return fail(400, "missing_provider_message_id");
  if (input.outcome === "failed" && providerMessageId) return fail(400, "failed_has_provider_id");
  const event = await loadEvent(deps.pool, input.eventId);
  if (!event || event.topic !== topicFor(input.action)) return fail(404, "send_event_not_found");
  const reservation = await loadReservation(deps.pool, input.eventId, input.action);
  if (!reservation) return fail(409, "send_not_reserved");
  if (reservation.fence_token !== input.fenceToken) return fail(409, "stale_fence");
  if (reservation.report_key && reservation.report_key === input.idempotencyKey) {
    return view({
      action: input.action,
      eventId: input.eventId,
      state: reservation.state,
      owner: reservation.state === "reserved",
      sendBlocked: reservation.state !== "reserved",
      providerMessageId: reservation.provider_message_id,
      duplicate: true,
    });
  }
  if (reservation.state === "uncertain") {
    if (input.outcome !== "accepted" || !providerMessageId) return fail(409, "send_stopped");
    if (reservation.provider_message_id && reservation.provider_message_id !== providerMessageId) return fail(409, "reconcile_required");
    if (input.action === "fulfillment_delivery") {
      const applied = await applyFulfillment(deps.pool, event.payload.orderId ?? "", "accepted", providerMessageId);
      if (applied) return applied;
    }
    await deps.pool.query(
      `UPDATE send_reservations
       SET state = 'accepted', provider_message_id = $3, report_key = $4, updated_at = now()
       WHERE event_id = $1 AND action = $2 AND state = 'uncertain'`,
      [input.eventId, input.action, providerMessageId, input.idempotencyKey],
    );
    await markOutbox(deps.pool, input.eventId, "accepted");
    return view({
      action: input.action,
      eventId: input.eventId,
      state: "accepted",
      owner: false,
      sendBlocked: true,
      providerMessageId,
      duplicate: false,
    });
  }
  if (reservation.state === "accepted") {
    if (providerMessageId && reservation.provider_message_id && providerMessageId !== reservation.provider_message_id) {
      return fail(409, "reconcile_required");
    }
    return view({
      action: input.action,
      eventId: input.eventId,
      state: "accepted",
      owner: false,
      sendBlocked: true,
      providerMessageId: reservation.provider_message_id,
      duplicate: true,
    });
  }
  if (reservation.state === "failed") return fail(409, "reserve_required");
  if (input.action === "fulfillment_delivery") {
    const applied = await applyFulfillment(deps.pool, event.payload.orderId ?? "", input.outcome, providerMessageId);
    if (applied) return applied;
  }
  const updated = await deps.pool.query(
    `UPDATE send_reservations
     SET state = $3, provider_message_id = $4, report_key = $5, updated_at = now()
     WHERE event_id = $1 AND action = $2 AND state = 'reserved' AND fence_token = $6
     RETURNING state`,
    [input.eventId, input.action, input.outcome, providerMessageId, input.idempotencyKey, input.fenceToken],
  );
  if (!updated.rowCount) return fail(409, "send_stopped");
  await markOutbox(deps.pool, input.eventId, input.outcome);
  return view({
    action: input.action,
    eventId: input.eventId,
    state: input.outcome,
    owner: false,
    sendBlocked: true,
    providerMessageId,
    duplicate: false,
  });
}

export function parseSendCommand(body: unknown, action: SendAction):
  | { ok: true; operation: "reserve"; eventId: string; action: SendAction; fenceToken: string }
  | { ok: true; operation: "report"; eventId: string; action: SendAction; fenceToken: string; outcome: SendOutcome; providerMessageId: string | null; idempotencyKey: string }
  | { ok: false; error: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid_send" };
  const record = body as Record<string, unknown>;
  if (typeof record.eventId !== "string" || typeof record.fenceToken !== "string" || record.fenceToken.length < 1) {
    return { ok: false, error: "invalid_send" };
  }
  if (record.operation === "reserve") {
    return { ok: true, operation: "reserve", eventId: record.eventId, action, fenceToken: record.fenceToken };
  }
  if (record.operation !== "report") return { ok: false, error: "invalid_send" };
  if (record.outcome !== "accepted" && record.outcome !== "uncertain" && record.outcome !== "failed") {
    return { ok: false, error: "invalid_send" };
  }
  if (typeof record.idempotencyKey !== "string" || record.idempotencyKey.length < 1) return { ok: false, error: "invalid_send" };
  const providerMessageId = typeof record.providerMessageId === "string" ? record.providerMessageId : null;
  return {
    ok: true,
    operation: "report",
    eventId: record.eventId,
    action,
    fenceToken: record.fenceToken,
    outcome: record.outcome,
    providerMessageId,
    idempotencyKey: record.idempotencyKey,
  };
}

export async function reservationState(pool: pg.Pool, eventId: string): Promise<SendState | null> {
  const found = await pool.query<{ state: SendState }>(
    "SELECT state FROM send_reservations WHERE event_id = $1",
    [eventId],
  );
  return found.rows[0]?.state ?? null;
}
