import { json, runtimeDeps, unavailable } from "../../../../../checkout/http.ts";
import { sendActions, type SendAction } from "../../../../../checkout/make-contract.ts";
import { parseSendCommand, reportSend, reserveSend } from "../../../../../checkout/send-reservation.ts";
import { verifySignature } from "../../../../../checkout/signature.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAction(value: unknown): value is SendAction {
  return typeof value === "string" && (sendActions as readonly string[]).includes(value);
}

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const action = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as { action?: unknown }).action
    : undefined;
  if (!isAction(action)) return json(400, { error: "invalid_send" });
  const command = parseSendCommand(parsed, action);
  if (!command.ok) return json(400, { error: command.error });
  const sendDeps = { pool: deps.pool, fulfillmentLive: deps.config.fulfillmentLive };
  const result = command.operation === "reserve"
    ? await reserveSend(sendDeps, command)
    : await reportSend(sendDeps, command);
  if (!result.ok) return json(result.status, { error: result.error });
  return json(200, result);
}
