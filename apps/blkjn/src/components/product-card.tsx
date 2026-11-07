import type { Product } from "@/data/catalogue";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article
      className="product-card"
      data-product-id={product.productId}
      data-price-php={product.pricePhp}
      data-purchase-enabled="false"
      data-download-enabled="false"
    >
      <figure className="product-thumb">
        <img
          src={product.thumbnail.src}
          alt={product.thumbnail.alt}
          width={product.thumbnail.width}
          height={product.thumbnail.height}
          loading={product.skuNumber <= 3 ? "eager" : "lazy"}
          decoding="async"
        />
        <figcaption>Example sheet · sample data</figcaption>
      </figure>
      <h3>{product.name}</h3>
      <p className="product-status">Proposed — not final</p>
      <p className="product-price">{`PHP ${product.pricePhp}`}</p>
      <p className="product-editions">Includes the blank and example editions.</p>
      <button type="button" disabled data-action="purchase">
        Purchase disabled
      </button>
      <button type="button" disabled data-action="download">
        Download disabled
      </button>
    </article>
  );
}
