import type { Product } from "@/data/catalogue";
import { SheetPreview } from "@/components/sheet-preview";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article
      className="product-card"
      data-product-id={product.productId}
      data-price="null"
      data-purchase-enabled="false"
      data-download-enabled="false"
    >
      <SheetPreview columns={product.previewColumns} />
      <h3>{product.name}</h3>
      <p className="product-status">Proposed — not final</p>
      <p className="product-price">Price pending</p>
      <button type="button" disabled data-action="purchase">
        Purchase disabled
      </button>
      <button type="button" disabled data-action="download">
        Download disabled
      </button>
    </article>
  );
}
