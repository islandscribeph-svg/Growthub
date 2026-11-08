import { createHash, timingSafeEqual } from "node:crypto";
import { neutralizeSheetCell } from "./sheet.ts";

export const outboxTopics = [
  "receipt.submitted",
  "receipt.duplicate_rejected",
  "request.received",
  "fulfillment.requested",
  "fulfillment.held",
] as const;

export type OutboxTopic = (typeof outboxTopics)[number];

export const extractionFields = [
  "schema_version",
  "provider",
  "currency",
  "amount_centavos",
  "reference_raw",
  "recipient_name",
  "recipient_identifier",
  "payment_timestamp_raw",
  "parsed_payment_timestamp",
  "timestamp_timezone",
  "transaction_status",
  "field_confidence",
  "missing_fields",
] as const;

export type OrderLineSnapshot = {
  sku: string;
  title: string;
  quantity: number;
  unitCentavos: number;
  lineCentavos: number;
};

export type ReceiptSubmittedPayload = {
  orderId: string;
  publicRef: string;
  receiptId: string;
  idempotencyKey: string;
  objectKey: string;
  contentSha256: string;
  contentType: string;
  submittedAt: string;
  orderCreatedAt: string;
  currency: "PHP";
  totalCentavos: number;
  paymentMethod: "gcash" | "gotyme";
  lines: OrderLineSnapshot[];
};

export function receiptSubmittedPayload(input: ReceiptSubmittedPayload): ReceiptSubmittedPayload {
  return {
    ...input,
    publicRef: neutralizeSheetCell(input.publicRef),
    lines: input.lines.map((line) => ({ ...line, title: neutralizeSheetCell(line.title) })),
  };
}

export function duplicateRejectedPayload(input: { orderId: string; orderRef: string; buyerEmail: string; subject: string; body: string }) {
  return {
    orderId: input.orderId,
    orderRef: neutralizeSheetCell(input.orderRef),
    buyerEmail: neutralizeSheetCell(input.buyerEmail),
    subject: neutralizeSheetCell(input.subject),
    body: neutralizeSheetCell(input.body),
  };
}

export const fixtureReceiptBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
export const fixtureReceiptSha256 = "843ac23b1736b4487ec81cf7c07ddd9bb46ae5b7818c2c3843d99d62fa75f3c9";

export function receiptSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function receiptHashMatches(bytes: Buffer, sha256: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(sha256)) return false;
  const actual = createHash("sha256").update(bytes).digest();
  const expected = Buffer.from(sha256, "hex");
  return timingSafeEqual(actual, expected);
}

export function requestReceivedPayload(input: { requestId: string; name: string; email: string; message: string }) {
  return {
    requestId: input.requestId,
    name: neutralizeSheetCell(input.name),
    email: neutralizeSheetCell(input.email),
    message: neutralizeSheetCell(input.message),
    replyTo: neutralizeSheetCell(input.email),
  };
}

export function fulfillmentHeldPayload(input: { orderId: string; orderRef: string }) {
  return { orderId: input.orderId, orderRef: neutralizeSheetCell(input.orderRef), reason: "fulfillment_disabled" as const };
}

export type DownloadGrantPayload = {
  sku: string;
  token: string;
  downloadPath: string;
  expiresAt: string;
  remainingCount: number;
};

export function fulfillmentRequestedPayload(input: {
  orderId: string;
  orderRef: string;
  buyerEmail: string;
  grants: DownloadGrantPayload[];
}) {
  return {
    orderId: input.orderId,
    orderRef: neutralizeSheetCell(input.orderRef),
    buyerEmail: input.buyerEmail,
    grants: input.grants,
  };
}

export function hasKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export const receiptSubmittedKeys = [
  "orderId",
  "publicRef",
  "receiptId",
  "idempotencyKey",
  "objectKey",
  "contentSha256",
  "contentType",
  "submittedAt",
  "orderCreatedAt",
  "currency",
  "totalCentavos",
  "paymentMethod",
  "lines",
] as const;

export const orderLineKeys = ["sku", "title", "quantity", "unitCentavos", "lineCentavos"] as const;
export const duplicateRejectedKeys = ["orderId", "orderRef", "buyerEmail", "subject", "body"] as const;
export const sendActions = ["request_mail", "duplicate_notice", "fulfillment_delivery"] as const;
export type SendAction = (typeof sendActions)[number];
export const requestReceivedKeys = ["requestId", "name", "email", "message", "replyTo"] as const;
export const fulfillmentHeldKeys = ["orderId", "orderRef", "reason"] as const;
export const fulfillmentRequestedKeys = ["orderId", "orderRef", "buyerEmail", "grants"] as const;
export const downloadGrantKeys = ["sku", "token", "downloadPath", "expiresAt", "remainingCount"] as const;
export const outboxEventKeys = ["eventId", "topic", "status", "createdAt", "attemptCount", "payload"] as const;
