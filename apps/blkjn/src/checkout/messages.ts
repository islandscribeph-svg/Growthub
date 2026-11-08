export function duplicateReferenceMessage(orderRef: string): { subject: string; body: string } {
  return {
    subject: `We need another payment receipt for order ${orderRef}`,
    body: `Thanks for your order. We couldn't approve this receipt because its payment reference is already linked to another order. No download has been sent for this order. If you resubmitted an existing order or believe this is a mistake, please reply with your order number so we can help. Please don't make another payment until we've checked.`,
  };
}

export function receiptPendingMessage(orderRef: string): { headline: string; detail: string } {
  return {
    headline: "Thank you for your purchase. We're reviewing your payment receipt and will send your purchase order shortly.",
    detail: `Order ${orderRef}. This receipt check is not bank settlement verification. No files have been sent.`,
  };
}
