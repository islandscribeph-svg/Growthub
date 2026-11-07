import { products } from "../data/catalogue.ts";

export type QuoteLineInput = {
  sku: string;
  quantity: number;
  unitPhp?: number;
};

export type QuoteSuccess = {
  ok: true;
  currency: "PHP";
  catalogueVersion: "2026-11-08";
  totalCentavos: number;
  lines: {
    sku: string;
    title: string;
    quantity: number;
    unitCentavos: number;
    lineCentavos: number;
  }[];
};

export type QuoteFailure = { ok: false; reason: string };

const bySku = new Map(products.map((item) => [item.productId, item]));

export function quoteLines(
  lines: QuoteLineInput[],
  options: { maxQuantity: number | null },
): QuoteSuccess | QuoteFailure {
  if (options.maxQuantity === null || options.maxQuantity < 1) {
    return { ok: false, reason: "quantity_limit_unconfigured" };
  }
  if (lines.length === 0) return { ok: false, reason: "empty_quote" };
  const priced = [];
  for (const line of lines) {
    const product = bySku.get(line.sku as `BLKJN-P${string}`);
    if (!product) return { ok: false, reason: "unknown_sku" };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > options.maxQuantity) {
      return { ok: false, reason: "invalid_quantity" };
    }
    const unitCentavos = product.pricePhp * 100;
    priced.push({
      sku: product.productId,
      title: product.name,
      quantity: line.quantity,
      unitCentavos,
      lineCentavos: unitCentavos * line.quantity,
    });
  }
  return {
    ok: true,
    currency: "PHP",
    catalogueVersion: "2026-11-08",
    totalCentavos: priced.reduce((sum, line) => sum + line.lineCentavos, 0),
    lines: priced,
  };
}
