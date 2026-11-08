import { acceptRequest } from "../../../../checkout/service.ts";
import { json, runtimeDeps, unavailable } from "../../../../checkout/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const deps = runtimeDeps();
  if (!deps.config.requestIntakeLive) return json(403, { error: "request_collection_disabled" });
  if (!deps.pool) return unavailable();
  const body = await request.json().catch(() => null) as { name?: string; email?: string; message?: string } | null;
  if (!body?.name || !body.email || !body.message) return json(400, { error: "invalid_request" });
  const result = await acceptRequest(
    { pool: deps.pool, config: deps.config, storage: deps.storage },
    body as { name: string; email: string; message: string },
  );
  if (!result.ok) return json(result.status, { error: result.error });
  return json(201, result);
}
