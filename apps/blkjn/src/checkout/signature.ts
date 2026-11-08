import { createHmac, timingSafeEqual } from "node:crypto";

export function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifySignature(input: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  nowMs: number;
}): boolean {
  const stamped = Date.parse(input.timestamp);
  if (Number.isNaN(stamped) || Math.abs(input.nowMs - stamped) > 5 * 60_000) return false;
  const expected = signBody(input.secret, input.timestamp, input.body);
  const left = Buffer.from(expected);
  const right = Buffer.from(input.signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
