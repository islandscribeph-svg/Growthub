import { submitReceipt } from "../../../../../../checkout/service.ts";
import { json, runtimeDeps, unavailable } from "../../../../../../checkout/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const deps = runtimeDeps();
  if (!deps.pool || !deps.storage) return unavailable();
  const { orderId } = await context.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("receipt");
  const idempotencyKey = form?.get("idempotencyKey");
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!(file instanceof File) || typeof idempotencyKey !== "string") return json(400, { error: "invalid_receipt" });
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await submitReceipt(
    { pool: deps.pool, config: deps.config, storage: deps.storage },
    { orderId, accessToken, idempotencyKey, bytes },
  );
  if (!result.ok) return json(result.status, { error: result.error });
  return json(201, result);
}
