export function normalizeReference(value: string): string {
  return value.trim().replace(/[\s-]+/g, "").toUpperCase();
}

export function canonicalReferenceKey(input: {
  provider: string;
  recipientIdentity: string;
  referenceRaw: string;
}): string {
  return `${input.provider}|${input.recipientIdentity}|${normalizeReference(input.referenceRaw)}`;
}
