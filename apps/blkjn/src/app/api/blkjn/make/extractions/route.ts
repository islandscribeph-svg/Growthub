import { applyExtraction } from "../../../../../checkout/service.ts";
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
  const parsed = JSON.parse(body) as { orderId?: string; idempotencyKey?: string; extraction?: unknown };
  if (!parsed.orderId || !parsed.idempotencyKey) return json(400, { error: "invalid_extraction" });
  const result = await applyExtraction(
    { pool: deps.pool, config: deps.config, storage: deps.storage },
    { orderId: parsed.orderId, idempotencyKey: parsed.idempotencyKey, extraction: parsed.extraction },
  );
  if (!result.ok) return json(result.status, { error: result.error });
  return json(200, result);
}
