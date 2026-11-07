import { reportRequestSend } from "../../../../../checkout/service.ts";
import { json, runtimeDeps, unavailable } from "../../../../../checkout/http.ts";
import { verifySignature } from "../../../../../checkout/signature.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const deps = runtimeDeps();
  if (!deps.pool || !deps.config.makeSigningSecret) return unavailable();
  const body = await request.text();
  const timestamp = request.headers.get("x-blkjn-timestamp") ?? "";
  const signature = request.headers.get("x-blkjn-signature") ?? "";
  if (!verifySignature({
    secret: deps.config.makeSigningSecret,
    timestamp,
    body,
    signature,
    nowMs: Date.now(),
  })) {
    return json(401, { error: "invalid_signature" });
  }
  let parsed: { eventId?: string; idempotencyKey?: string; outcome?: "accepted" | "uncertain" | "failed"; providerMessageId?: string };
  try {
    parsed = JSON.parse(body) as { eventId?: string; idempotencyKey?: string; outcome?: "accepted" | "uncertain" | "failed"; providerMessageId?: string };
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!parsed.eventId || !parsed.idempotencyKey || !parsed.outcome) return json(400, { error: "invalid_request_send" });
  const result = await reportRequestSend(
    { pool: deps.pool, config: deps.config, storage: deps.storage },
    {
      eventId: parsed.eventId,
      idempotencyKey: parsed.idempotencyKey,
      outcome: parsed.outcome,
      providerMessageId: parsed.providerMessageId,
    },
  );
  if (!result.ok) return json(result.status, { error: result.error });
  return json(200, result);
}
