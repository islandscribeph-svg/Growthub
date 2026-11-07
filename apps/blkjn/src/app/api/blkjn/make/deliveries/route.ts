import { json, runtimeDeps, unavailable } from "../../../../../checkout/http.ts";
import { reportDelivery } from "../../../../../checkout/service.ts";
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
  const parsed = JSON.parse(body) as {
    orderId?: string;
    idempotencyKey?: string;
    outcome?: "accepted" | "uncertain" | "failed";
    providerMessageId?: string;
  };
  if (!parsed.orderId || !parsed.idempotencyKey || !parsed.outcome) return json(400, { error: "invalid_delivery" });
  const result = await reportDelivery(
    { pool: deps.pool, config: deps.config, storage: deps.storage },
    parsed as { orderId: string; idempotencyKey: string; outcome: "accepted" | "uncertain" | "failed"; providerMessageId?: string },
  );
  if (!result.ok) return json(result.status, { error: result.error });
  return json(200, result);
}
