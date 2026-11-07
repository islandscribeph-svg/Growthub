import { createOrder } from "../../../../checkout/service.ts";
import { json, runtimeDeps, unavailable } from "../../../../checkout/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const deps = runtimeDeps();
  if (!deps.pool) return unavailable();
  const body = await request.json().catch(() => null) as {
    buyerEmail?: string;
    paymentMethod?: "gcash" | "gotyme";
    lines?: { sku: string; quantity: number; unitPhp?: number }[];
    buyerPaymentClaimedAt?: string;
  } | null;
  if (!body?.buyerEmail || !body.paymentMethod || !body.lines || !body.buyerPaymentClaimedAt) {
    return json(400, { error: "invalid_order" });
  }
  try {
    const result = await createOrder(
      { pool: deps.pool, config: deps.config, storage: deps.storage },
      {
        buyerEmail: body.buyerEmail,
        paymentMethod: body.paymentMethod,
        lines: body.lines,
        buyerPaymentClaimedAt: body.buyerPaymentClaimedAt,
      },
    );
    if (!result.ok) return json(result.status, { error: result.error });
    return json(201, result);
  } catch {
    return json(503, { error: "configuration_unavailable" });
  }
}
