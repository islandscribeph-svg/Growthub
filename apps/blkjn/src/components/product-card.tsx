import type { Product } from "@/data/catalogue";
import { CartActions } from "@/components/cart-actions";

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
      <p className="product-status">Not available to download</p>
      <p className="product-price">{`PHP ${product.pricePhp}`}</p>
      <p className="product-editions">Includes the blank and example editions.</p>
      <CartActions sku={product.productId} />
    </article>
  );
}
