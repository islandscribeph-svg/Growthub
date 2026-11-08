import { claimOutbox } from "../../../../../../checkout/service.ts";
import { json, runtimeDeps, unavailable } from "../../../../../../checkout/http.ts";
import { verifySignature } from "../../../../../../checkout/signature.ts";

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
  let parsed: { eventId?: string; leaseSeconds?: number; fenceToken?: string };
  try {
    parsed = JSON.parse(body) as { eventId?: string; leaseSeconds?: number; fenceToken?: string };
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!parsed.eventId || (parsed.fenceToken !== undefined && typeof parsed.fenceToken !== "string") || (parsed.leaseSeconds !== undefined && (!Number.isInteger(parsed.leaseSeconds) || parsed.leaseSeconds < 30 || parsed.leaseSeconds > 300))) {
    return json(400, { error: "invalid_claim" });
  }
  const result = await claimOutbox(
    { pool: deps.pool, config: deps.config, storage: deps.storage },
    { eventId: parsed.eventId, leaseSeconds: parsed.leaseSeconds, fenceToken: parsed.fenceToken },
  );
  if (!result.ok) return json(result.status, { error: result.error });
  return json(200, result);
}
