import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { json, runtimeDeps, unavailable } from "../../../../../checkout/http.ts";
import { redeemDownload } from "../../../../../checkout/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const deps = runtimeDeps();
  if (!deps.pool) return unavailable();
  const { token } = await context.params;
  const sku = new URL(request.url).searchParams.get("sku") ?? "";
  const result = await redeemDownload(
    { pool: deps.pool, config: deps.config, storage: deps.storage },
    { token, sku },
  );
  if (!result.ok) return json(result.status, { error: result.error });
  const root = resolve(result.root);
  const path = resolve(root, `${result.sku}.xlsx`);
  if (!path.startsWith(`${root}/`)) return json(403, { error: "download_denied" });
  try {
    const bytes = await readFile(path);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${result.sku}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return json(404, { error: "deliverable_unavailable" });
  }
}
