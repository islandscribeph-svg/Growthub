import { CallSource, QualStatus } from "@prisma/client";

export const CALL_SOURCE_LABELS: Record<CallSource, string> = {
  CONTENT: "Content",
  ADS: "Ads",
  COLD_EMAIL: "Cold Email",
  REFERRAL: "Referral",
  UNKNOWN: "Unknown",
};

export const QUAL_STATUS_LABELS: Record<QualStatus, string> = {
  QUALIFIED: "Qualified",
  UNQUALIFIED: "Unqualified",
  PENDING: "Pending",
};

export const CALL_SOURCE_ORDER: CallSource[] = ["CONTENT", "ADS", "COLD_EMAIL", "REFERRAL", "UNKNOWN"];

// Best-effort guess from a calendar event's title + description, used only
// when a CallEntry is first created from a sync — never on re-sync, so a
// manual correction always sticks. Calendar text rarely states qualified/
// unqualified explicitly (that's usually a post-call judgment), so PENDING
// is the common, expected outcome and just means "needs review."
export function guessSource(text: string): CallSource {
  const t = text.toLowerCase();
  if (t.includes("cold email")) return "COLD_EMAIL";
  if (t.includes("referral")) return "REFERRAL";
  if (/\bads?\b|ad[\s-]?spend/.test(t)) return "ADS";
  if (/\bcontent\b|podcast|youtube|linkedin|\bli\b|\bx\b/.test(t)) return "CONTENT";
  return "UNKNOWN";
}

export function guessQualified(text: string): QualStatus {
  const t = text.toLowerCase();
  if (t.includes("unqualified")) return "UNQUALIFIED";
  if (t.includes("qualified")) return "QUALIFIED";
  return "PENDING";
}

export function guessNoShow(text: string): boolean {
  return /no[\s-]?show/i.test(text);
}
