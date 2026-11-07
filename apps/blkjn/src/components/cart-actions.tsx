"use client";

import { useCart } from "@/components/cart-provider";

export function CartActions({ sku }: { sku: string }) {
  const cart = useCart();
  return (
    <div className="cart-actions">
      <button type="button" data-action="add-to-cart" onClick={() => cart.add(sku)}>
        Add to cart
      </button>
      <button type="button" data-action="buy-now" onClick={() => cart.buyNow(sku)}>
        Buy now
      </button>
      <button type="button" disabled data-action="download">
        Download disabled
      </button>
    </div>
  );
}
