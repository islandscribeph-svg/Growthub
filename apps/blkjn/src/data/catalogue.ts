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
  /** Unapproved. Stay null until a PHP amount is explicitly approved. */
  price: null;
  currencyDirection: typeof CURRENCY_DIRECTION;
  purchaseEnabled: false;
  downloadEnabled: false;
  previewColumns: readonly [string, string, string];
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
    price: null,
    currencyDirection: CURRENCY_DIRECTION,
    purchaseEnabled: PURCHASE_ENABLED,
    downloadEnabled: DOWNLOAD_ENABLED,
    previewColumns: columns,
  };
}

/**
 * Public catalogue only. Workbook filenames, pack ZIPs, and file bytes are
 * intentionally absent so nothing on this site can be downloaded.
 * Blank and Example editions are delivery files for the same SKU, not extra products.
 * Pack archives are bundles, not extra SKUs.
 */
export const products: readonly Product[] = [
  product(1, "VA Task & Weekly Client Update", "CLIENT WORK"),
  product(2, "Client Onboarding & Offboarding Checklist", "CLIENT WORK"),
  product(3, "Recurring Admin & SOP Tracker", "CLIENT WORK"),
  product(4, "Billable Hours & Retainer Balance Tracker", "BILLING & MONEY"),
  product(5, "Invoice & Payment Follow-Up Tracker", "BILLING & MONEY"),
  product(6, "Freelancer Income & Expense Tracker", "BILLING & MONEY"),
  product(7, "Simple Lead & Client Follow-Up CRM", "GET CLIENTS"),
  product(8, "Proposal & Quote Tracker", "GET CLIENTS"),
  product(9, "Client Feedback & Testimonial Log", "GET CLIENTS"),
  product(10, "Meeting Notes & Action Items", "DAILY OPS"),
  product(11, "Inbox Triage & Response Log", "DAILY OPS"),
  product(12, "Content & Social Posting Calendar", "DAILY OPS"),
  product(13, "Inventory & Stock Level Tracker", "SMALL BUSINESS BACK OFFICE"),
  product(14, "Supplier & Purchase Order Tracker", "SMALL BUSINESS BACK OFFICE"),
  product(15, "Subscriptions & Renewals Tracker", "SMALL BUSINESS BACK OFFICE"),
];

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
