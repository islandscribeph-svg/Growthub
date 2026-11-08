export const CURRENCY_DIRECTION = "PHP" as const;

export const PURCHASE_ENABLED = false;
export const DOWNLOAD_ENABLED = false;
export const REQUEST_COLLECTION_ENABLED = false;

export type PackId =
  | "CLIENT WORK"
  | "BILLING & MONEY"
  | "GET CLIENTS"
  | "DAILY OPS"
  | "SMALL BUSINESS BACK OFFICE";

export type Product = {
  productId: `BLKJN-P${string}`;
  skuNumber: number;
  name: string;
  pack: PackId;
  /** Approved for display. The same PHP amount for every buyer. Checkout stays off. */
  pricePhp: number;
  currencyDirection: typeof CURRENCY_DIRECTION;
  purchaseEnabled: false;
  downloadEnabled: false;
  previewColumns: readonly [string, string, string];
  thumbnail: {
    src: string;
    width: 800;
    height: 600;
    alt: string;
  };
};

export type Pack = {
  id: PackId;
  slug: string;
  index: string;
  blurb: string;
};

const previewCycle = [
  ["TASK", "STATUS", "WEEK"],
  ["DATE", "HOURS", "TYPE"],
  ["ITEM", "STAGE", "NEXT"],
  ["NOTE", "OWNER", "DONE"],
  ["SKU", "STOCK", "CHECK"],
] as const;

function product(
  skuNumber: number,
  name: string,
  pack: PackId,
  thumbnailFile: string,
  pricePhp: number,
): Product {
  const columns = previewCycle[(skuNumber - 1) % previewCycle.length];
  if (!columns) {
    throw new Error(`Missing preview columns for SKU ${skuNumber}`);
  }
  return {
    productId: `BLKJN-P${String(skuNumber).padStart(2, "0")}`,
    skuNumber,
    name,
    pack,
    pricePhp,
    currencyDirection: CURRENCY_DIRECTION,
    purchaseEnabled: PURCHASE_ENABLED,
    downloadEnabled: DOWNLOAD_ENABLED,
    previewColumns: columns,
    thumbnail: {
      src: `/images/catalogue/${thumbnailFile}`,
      width: 800,
      height: 600,
      alt: `Example sheet from ${name}. Sample workbook data, not a price.`,
    },
  };
}

/**
 * Public catalogue only. Workbook files and pack ZIPs are intentionally
 * absent so nothing on this site can be downloaded. Store cards use example-sheet
 * thumbnails only.
 * Blank and Example editions are delivery files for the same SKU, not extra products.
 * Pack archives are bundles, not extra SKUs.
 */
export const products: readonly Product[] = [
  product(1, "VA Task & Weekly Client Update", "CLIENT WORK", "blkjn-p01-va-task-weekly-update.webp", 99),
  product(2, "Client Onboarding & Offboarding Checklist", "CLIENT WORK", "blkjn-p02-client-onboarding-offboarding.webp", 79),
  product(3, "Recurring Admin & SOP Tracker", "CLIENT WORK", "blkjn-p03-recurring-admin-sop.webp", 99),
  product(4, "Billable Hours & Retainer Balance Tracker", "BILLING & MONEY", "blkjn-p04-billable-hours-retainer.webp", 129),
  product(5, "Invoice & Payment Follow-Up Tracker", "BILLING & MONEY", "blkjn-p05-invoice-payment-followup.webp", 99),
  product(6, "Freelancer Income & Expense Tracker", "BILLING & MONEY", "blkjn-p06-freelancer-income-expense.webp", 129),
  product(7, "Simple Lead & Client Follow-Up CRM", "GET CLIENTS", "blkjn-p07-lead-client-followup-crm.webp", 129),
  product(8, "Proposal & Quote Tracker", "GET CLIENTS", "blkjn-p08-proposal-quote-tracker.webp", 99),
  product(9, "Client Feedback & Testimonial Log", "GET CLIENTS", "blkjn-p09-feedback-testimonial-log.webp", 79),
  product(10, "Meeting Notes & Action Items", "DAILY OPS", "blkjn-p10-meeting-notes-actions.webp", 79),
  product(11, "Inbox Triage & Response Log", "DAILY OPS", "blkjn-p11-inbox-triage-response-log.webp", 79),
  product(12, "Content & Social Posting Calendar", "DAILY OPS", "blkjn-p12-content-social-calendar.webp", 99),
  product(13, "Inventory & Stock Level Tracker", "SMALL BUSINESS BACK OFFICE", "blkjn-p13-inventory-stock-level.webp", 129),
  product(14, "Supplier & Purchase Order Tracker", "SMALL BUSINESS BACK OFFICE", "blkjn-p14-supplier-purchase-order.webp", 129),
  product(15, "Subscriptions & Renewals Tracker", "SMALL BUSINESS BACK OFFICE", "blkjn-p15-subscriptions-renewals.webp", 99),
];

const approvedPricesPhp = [99, 79, 99, 129, 99, 129, 129, 99, 79, 79, 79, 99, 129, 129, 99] as const;

products.forEach((item, index) => {
  if (item.pricePhp !== approvedPricesPhp[index]) {
    throw new Error(`${item.productId} price does not match the approved PHP amount.`);
  }
});

export const packs: readonly Pack[] = [
  {
    id: "CLIENT WORK",
    slug: "client-work",
    index: "01",
    blurb: "Client tasks, onboarding and handoffs",
  },
  {
    id: "BILLING & MONEY",
    slug: "billing-money",
    index: "02",
    blurb: "Hours, invoices and expense records",
  },
  {
    id: "GET CLIENTS",
    slug: "get-clients",
    index: "03",
    blurb: "Leads, quotes and follow-ups",
  },
  {
    id: "DAILY OPS",
    slug: "daily-ops",
    index: "04",
    blurb: "Meetings, inboxes and content",
  },
  {
    id: "SMALL BUSINESS BACK OFFICE",
    slug: "back-office",
    index: "05",
    blurb: "Stock, suppliers and renewals",
  },
];

if (products.length !== 15) {
  throw new Error("BLKJN catalogue must contain exactly 15 products.");
}

if (new Set(products.map((item) => item.productId)).size !== 15) {
  throw new Error("BLKJN product ids must be unique.");
}

if (new Set(products.map((item) => item.thumbnail.src)).size !== 15) {
  throw new Error("Each BLKJN product needs its own thumbnail.");
}

if (packs.length !== 5) {
  throw new Error("BLKJN catalogue must contain exactly 5 packs.");
}

for (const pack of packs) {
  const count = products.filter((item) => item.pack === pack.id).length;
  if (count !== 3) {
    throw new Error(`${pack.id} must contain exactly 3 products.`);
  }
}

export function productsInPack(packId: PackId): readonly Product[] {
  return products.filter((item) => item.pack === packId);
}
