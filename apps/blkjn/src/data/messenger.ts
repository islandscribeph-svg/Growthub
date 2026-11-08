const messengerPage = "https://m.me/553723741160341";
const catalogueSku = /^BLKJN-P(?:0[1-9]|1[0-5])$/;

export function messengerPurchaseUrl(lines: readonly { sku: string; quantity: number }[]): string {
  const ref = lines.flatMap((line) => {
    if (!catalogueSku.test(line.sku)) return [];
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) return [];
    return [`${line.sku}-${line.quantity}`];
  }).join("_");
  if (!ref) return messengerPage;
  return `${messengerPage}?ref=${ref}`;
}
