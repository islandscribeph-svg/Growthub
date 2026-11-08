const allowed = [
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

export type Extraction = {
  schema_version: "1";
  provider: "gcash" | "gotyme";
  currency: string;
  amount_centavos: number;
  reference_raw: string;
  recipient_name: string;
  recipient_identifier: string;
  payment_timestamp_raw: string;
  parsed_payment_timestamp: string | null;
  timestamp_timezone: string | null;
  transaction_status: string;
  field_confidence: Record<string, number>;
  missing_fields: string[];
};

export function parseExtraction(input: unknown): { ok: true; value: Extraction } | { ok: false; reason: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "malformed_extraction" };
  }
  const source = input as Record<string, unknown>;
  const value: Record<string, unknown> = {};
  for (const key of allowed) value[key] = source[key];
  if (value.schema_version !== "1") return { ok: false, reason: "bad_schema" };
  if (value.provider !== "gcash" && value.provider !== "gotyme") return { ok: false, reason: "bad_provider" };
  if (typeof value.currency !== "string") return { ok: false, reason: "bad_currency" };
  if (typeof value.amount_centavos !== "number" || !Number.isInteger(value.amount_centavos)) {
    return { ok: false, reason: "bad_amount" };
  }
  for (const key of ["reference_raw", "recipient_name", "recipient_identifier", "payment_timestamp_raw", "transaction_status"]) {
    if (typeof value[key] !== "string") return { ok: false, reason: "bad_string" };
  }
  if (value.parsed_payment_timestamp !== null && typeof value.parsed_payment_timestamp !== "string") {
    return { ok: false, reason: "bad_timestamp" };
  }
  if (value.timestamp_timezone !== null && typeof value.timestamp_timezone !== "string") {
    return { ok: false, reason: "bad_timezone" };
  }
  if (value.field_confidence === null || typeof value.field_confidence !== "object" || Array.isArray(value.field_confidence)) {
    return { ok: false, reason: "bad_confidence" };
  }
  if (!Array.isArray(value.missing_fields)) return { ok: false, reason: "bad_missing_fields" };
  return { ok: true, value: value as Extraction };
}
