"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type CartItem = { sku: string; quantity: number };

type CartValue = {
  items: CartItem[];
  add: (sku: string) => void;
  setQuantity: (sku: string, quantity: number) => void;
  buyNow: (sku: string) => void;
};

const CartContext = createContext<CartValue | null>(null);
const storageKey = "blkjn-cart-v1";
const buyNowKey = "blkjn-buy-now";

export function CartProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as CartItem[];
          if (Array.isArray(parsed)) setItems(parsed.filter((item) => item.quantity > 0));
        } catch {
          setItems([]);
        }
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready]);

  function add(sku: string) {
    setItems((current) => {
      const existing = current.find((item) => item.sku === sku);
      if (!existing) return [...current, { sku, quantity: 1 }];
      return current.map((item) => item.sku === sku ? { ...item, quantity: item.quantity + 1 } : item);
    });
  }

  function setQuantity(sku: string, quantity: number) {
    setItems((current) => current.flatMap((item) => {
      if (item.sku !== sku) return [item];
      if (quantity < 1) return [];
      return [{ ...item, quantity }];
    }));
  }

  function buyNow(sku: string) {
    window.sessionStorage.setItem(buyNowKey, JSON.stringify({ sku, quantity: 1 }));
    router.push("/checkout/?mode=buy-now");
  }

  return (
    <CartContext.Provider value={{ items, add, setQuantity, buyNow }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider is missing");
  return value;
}

export function readBuyNow(): CartItem | null {
  const raw = window.sessionStorage.getItem(buyNowKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CartItem;
    if (!parsed?.sku || parsed.quantity < 1) return null;
    return parsed;
  } catch {
    return null;
  }
}
