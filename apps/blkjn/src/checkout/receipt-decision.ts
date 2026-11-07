import type { Extraction } from "./extraction.ts";
import { canonicalReferenceKey } from "./reference.ts";

export type ReceiptPolicy = {
  orderTotalCentavos: number;
  orderMethod: "gcash" | "gotyme";
  orderCreatedAt: string;
  buyerClaimedPaidAt: string;
  now: string;
  windowHours: number | null;
  clockSkewMinutes: number | null;
  minConfidence: number | null;
  recipientName: string;
  gcashIdentifier: string | null;
  gotymeIdentity: string | null;
  gotymeSuffix: string | null;
  maskedIdentifierAccepted: boolean;
};

export type ReceiptDecision =
  | {
      outcome: "AUTO_APPROVED_RECEIPT";
      meansBankSettlement: false;
      canonicalKey: string;
      reasons: [];
    }
  | { outcome: "NEEDS_REVIEW"; reasons: string[] };

const criticalFields = [
  "amount_centavos",
  "reference_raw",
  "recipient_name",
  "recipient_identifier",
  "parsed_payment_timestamp",
  "transaction_status",
] as const;

const successStatuses = new Set(["completed", "success", "successful"]);

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseInstant(value: string): number | null {
  if (!value.includes("T") || (!value.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(value))) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function decideReceipt(extraction: Extraction, policy: ReceiptPolicy): ReceiptDecision {
  const reasons: string[] = [];
  if (policy.windowHours === null) reasons.push("payment_window_unconfigured");
  if (policy.clockSkewMinutes === null) reasons.push("clock_skew_unconfigured");
  if (policy.minConfidence === null) reasons.push("confidence_threshold_unconfigured");
  if (extraction.missing_fields.length > 0) reasons.push("missing_fields");
  if (extraction.currency !== "PHP") reasons.push("currency_mismatch");
  if (extraction.amount_centavos !== policy.orderTotalCentavos) reasons.push("amount_mismatch");
  if (extraction.provider !== policy.orderMethod) reasons.push("provider_mismatch");
  if (normalizeName(extraction.recipient_name) !== normalizeName(policy.recipientName)) reasons.push("recipient_name_mismatch");
  if (!extraction.reference_raw.trim()) reasons.push("missing_reference");
  if (/[*•xX]/.test(extraction.recipient_identifier) && !policy.maskedIdentifierAccepted) {
    reasons.push("masked_identifier");
  }
  if (extraction.provider === "gcash") {
    if (!policy.gcashIdentifier || extraction.recipient_identifier.replace(/[\s-]/g, "") !== policy.gcashIdentifier.replace(/[\s-]/g, "")) {
      reasons.push("gcash_identifier_mismatch");
    }
  }
  if (extraction.provider === "gotyme") {
    const identifier = extraction.recipient_identifier.replace(/[\s-]/g, "").toUpperCase();
    const suffix = policy.gotymeSuffix?.toUpperCase() ?? "";
    const identity = policy.gotymeIdentity?.replace(/[\s-]/g, "").toUpperCase() ?? "";
    if (!suffix || !identity || !identifier.endsWith(suffix) || !identifier.includes(identity)) {
      reasons.push("gotyme_identifier_mismatch");
    }
  }
  if (!successStatuses.has(extraction.transaction_status.trim().toLowerCase())) reasons.push("status_not_completed");
  const paidAt = extraction.parsed_payment_timestamp ? parseInstant(extraction.parsed_payment_timestamp) : null;
  if (!extraction.timestamp_timezone || paidAt === null) reasons.push("ambiguous_timestamp");
  if (policy.minConfidence !== null) {
    for (const field of criticalFields) {
      const confidence = extraction.field_confidence[field];
      if (typeof confidence !== "number" || confidence < policy.minConfidence) reasons.push(`low_confidence:${field}`);
    }
  }
  const created = parseInstant(policy.orderCreatedAt);
  const claimed = parseInstant(policy.buyerClaimedPaidAt);
  const now = parseInstant(policy.now);
  if (created === null || claimed === null || now === null) reasons.push("invalid_lifecycle_timestamp");
  if (
    reasons.length === 0 &&
    paidAt !== null &&
    created !== null &&
    claimed !== null &&
    now !== null &&
    policy.windowHours !== null &&
    policy.clockSkewMinutes !== null
  ) {
    const skew = policy.clockSkewMinutes * 60_000;
    const window = policy.windowHours * 60 * 60_000;
    if (Math.abs(paidAt - claimed) > skew) reasons.push("claimed_time_mismatch");
    if (paidAt < created - skew || paidAt > created + window) reasons.push("outside_lifecycle");
    if (paidAt > now + skew) reasons.push("future_timestamp");
  }
  if (reasons.length > 0) return { outcome: "NEEDS_REVIEW", reasons };
  const recipientIdentity = extraction.provider === "gcash" ? policy.gcashIdentifier ?? "" : policy.gotymeIdentity ?? "";
  return {
    outcome: "AUTO_APPROVED_RECEIPT",
    meansBankSettlement: false,
    canonicalKey: canonicalReferenceKey({
      provider: extraction.provider,
      recipientIdentity,
      referenceRaw: extraction.reference_raw,
    }),
    reasons: [],
  };
}
