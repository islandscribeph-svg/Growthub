"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageShell } from "@/components/page-shell";
import { readBuyNow, useCart } from "@/components/cart-provider";
import { products } from "@/data/catalogue";

type Capabilities = {
  checkout: "unavailable" | "test" | "live" | "disabled";
  qr: { gcash: boolean; gotyme: boolean };
  purchaseLive: boolean;
  gaps: string[];
};

type Result =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "pending"; headline: string; detail: string };

const bySku = new Map(products.map((item) => [item.productId, item]));

export default function CheckoutPage() {
  const cart = useCart();
  const [mode, setMode] = useState<"cart" | "buy-now">("cart");
  const [buyNowSku, setBuyNowSku] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"gcash" | "gotyme">("gcash");
  const [file, setFile] = useState<File | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const nextMode = params.get("mode") === "buy-now" ? "buy-now" : "cart";
      setMode(nextMode);
      if (nextMode === "buy-now") setBuyNowSku(readBuyNow()?.sku ?? null);
    }, 0);
    void fetch("/api/blkjn/capabilities/")
      .then((response) => response.json())
      .then((body: Capabilities) => setCapabilities(body))
      .catch(() => setCapabilities(null));
    return () => window.clearTimeout(handle);
  }, []);

  const lines = useMemo(() => {
    if (mode === "buy-now") {
      const product = buyNowSku ? bySku.get(buyNowSku as `BLKJN-P${string}`) : undefined;
      return product ? [{ sku: product.productId, quantity: 1 }] : [];
    }
    return cart.items;
  }, [mode, buyNowSku, cart.items]);

  const displayCentavos = lines.reduce((sum, line) => {
    const product = bySku.get(line.sku as `BLKJN-P${string}`);
    return sum + (product ? product.pricePhp * 100 * line.quantity : 0);
  }, 0);
  const checkoutOpen = capabilities?.checkout === "test" || capabilities?.checkout === "live";
  const qrReady = method === "gcash" ? capabilities?.qr.gcash : capabilities?.qr.gotyme;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ kind: "idle" });
    if (!checkoutOpen) {
      setResult({ kind: "error", message: "Checkout is unavailable until BLKJN database configuration is set. Nothing was saved." });
      return;
    }
    if (!file) {
      setResult({ kind: "error", message: "Choose a receipt image or PDF before submitting." });
      return;
    }
    setBusy(true);
    try {
      const orderResponse = await fetch("/api/blkjn/orders/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buyerEmail: email,
          paymentMethod: method,
          lines: lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
        }),
      });
      const orderBody = await orderResponse.json() as { error?: string; orderId?: string; accessToken?: string; headline?: string };
      if (!orderResponse.ok || !orderBody.orderId || !orderBody.accessToken) {
        setResult({ kind: "error", message: orderBody.error ?? "The order was not created. Nothing was saved." });
        return;
      }
      const form = new FormData();
      form.set("receipt", file);
      form.set("idempotencyKey", crypto.randomUUID());
      const receiptResponse = await fetch(`/api/blkjn/orders/${orderBody.orderId}/receipts/`, {
        method: "POST",
        headers: { authorization: `Bearer ${orderBody.accessToken}` },
        body: form,
      });
      const receiptBody = await receiptResponse.json() as { error?: string; headline?: string; detail?: string; bankSettlementVerified?: boolean };
      if (!receiptResponse.ok || !receiptBody.headline) {
        setResult({ kind: "error", message: receiptBody.error ?? "The receipt was not stored. The order was not confirmed." });
        return;
      }
      if (receiptBody.bankSettlementVerified) {
        setResult({ kind: "error", message: "Unexpected settlement flag. No confirmation was shown." });
        return;
      }
      setResult({ kind: "pending", headline: receiptBody.headline, detail: receiptBody.detail ?? "" });
    } catch {
      setResult({ kind: "error", message: "Checkout could not reach the server. Nothing was confirmed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell current="checkout">
      <section className="section frame checkout">
        <p className="pill">CHECKOUT · {capabilities?.checkout === "test" ? "TEST ONLY" : "NOT LIVE"}</p>
        <h1>{mode === "buy-now" ? "Buy now" : "Checkout"}</h1>
        <p className="section-lede">
          {mode === "buy-now"
            ? "This buy-now selection does not replace the saved cart."
            : "The saved cart stays on this browser."}
          {" "}One PHP price for every buyer. Receipt review is not bank settlement verification.
        </p>
        {lines.length === 0 ? <p>There is nothing in this checkout yet.</p> : (
          <ul className="checkout-lines">
            {lines.map((line) => {
              const product = bySku.get(line.sku as `BLKJN-P${string}`);
              return (
                <li key={line.sku}>
                  <span>{product?.name ?? line.sku}</span>
                  {mode === "cart" ? (
                    <input
                      aria-label={`Quantity for ${product?.name ?? line.sku}`}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) => cart.setQuantity(line.sku, Number(event.target.value))}
                    />
                  ) : <span>Qty {line.quantity}</span>}
                  <span>{product ? `PHP ${product.pricePhp * line.quantity}` : "Unavailable"}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="product-price">Total PHP {displayCentavos / 100}</p>
        <form className="request-card" onSubmit={submit}>
          <label htmlFor="buyer-email">Buyer email</label>
          <input id="buyer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <fieldset>
            <legend>Payment method</legend>
            <label><input type="radio" name="method" checked={method === "gcash"} onChange={() => setMethod("gcash")} /> GCash</label>
            <label><input type="radio" name="method" checked={method === "gotyme"} onChange={() => setMethod("gotyme")} /> GoTyme</label>
          </fieldset>
          <p className="qr-placeholder" data-qr={qrReady ? "configured" : "unavailable"}>
            {qrReady
              ? "Owner QR is configured."
              : `${method === "gcash" ? "GCash" : "GoTyme"} QR unavailable until the owner image is configured. A static QR does not set the exact PHP amount.`}
          </p>
          <label htmlFor="receipt">Payment receipt</label>
          <input id="receipt" type="file" accept="image/png,image/jpeg,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button type="submit" data-action="submit-receipt" disabled={busy || lines.length === 0}>
            {busy ? "Submitting" : "Submit receipt"}
          </button>
        </form>
        {capabilities && capabilities.checkout !== "test" && capabilities.checkout !== "live" ? (
          <p className="checkout-error" role="status">
            Checkout is unavailable. Missing: {capabilities.gaps.join(", ") || "purchase switch"}. Nothing will be saved.
          </p>
        ) : null}
        {result.kind === "error" ? <p className="checkout-error" role="status">{result.message}</p> : null}
        {result.kind === "pending" ? (
          <div className="checkout-pending" role="status">
            <p>{result.headline}</p>
            <p>{result.detail}</p>
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
