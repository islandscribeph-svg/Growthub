"use client";

import { useCart } from "@/components/cart-provider";
import { messengerPurchaseUrl } from "@/data/messenger";

export function CartActions({ sku }: { sku: string }) {
  const cart = useCart();
  return (
    <div className="cart-actions">
      <button type="button" data-action="add-to-cart" onClick={() => cart.add(sku)}>
        Add to cart
      </button>
      <a
        data-action="purchase-messenger"
        href={messengerPurchaseUrl([{ sku, quantity: 1 }])}
        target="_blank"
        rel="noopener noreferrer"
      >
        Purchase via Messenger
      </a>
      <button type="button" disabled data-action="download">
        Download disabled
      </button>
    </div>
  );
}
