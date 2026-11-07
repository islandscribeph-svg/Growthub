import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { ProductCard } from "@/components/product-card";
import { packs, productsInPack } from "@/data/catalogue";

export const metadata: Metadata = {
  title: "Store",
};

const scenario = [
  {
    step: "1",
    kicker: "SAMPLE INPUT",
    text: "Fictional email subject: invoice",
    note: "Inspect the fictional sample",
  },
  {
    step: "2",
    kicker: "FILTER",
    text: "Subject contains “invoice”",
    note: "Check the filter condition",
  },
  {
    step: "3",
    kicker: "ACTION",
    text: "Append a row to a spreadsheet",
    note: "Review the mapped output",
  },
] as const;

export default function StorePage() {
  return (
    <PageShell current="store">
      <section className="section frame store-intro">
        <p className="pill">CATALOGUE · PROPOSED</p>
        <h1>Spreadsheet templates</h1>
        <p className="section-lede">
          15 products across five packs. One PHP price for every buyer. Checkout
          and downloads are disabled.
        </p>
      </section>

      {packs.map((pack) => (
        <section
          className="section frame pack-section"
          id={pack.slug}
          key={pack.id}
          aria-labelledby={`${pack.slug}-heading`}
        >
          <h2 id={`${pack.slug}-heading`}>{pack.id}</h2>
          <div className="product-grid">
            {productsInPack(pack.id).map((product) => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>
        </section>
      ))}

      <section
        className="section frame guides"
        id="automation-guides"
        aria-labelledby="guides-heading"
      >
        <h2 id="guides-heading">Automation Guides</h2>
        <p className="section-lede">
          Phase 2 · Separate from the 15 spreadsheets · Not priced · No guides
          available yet.
        </p>
        <p className="scenario-label">ILLUSTRATIVE MAKE.COM-STYLE SCENARIO</p>
        <div className="guide-panel">
          <p className="guide-kicker">ILLUSTRATIVE GUIDE PREVIEW</p>
          <ol className="scenario">
            {scenario.map((item) => (
              <li key={item.step}>
                <div className="scenario-node">
                  <p className="node-kicker">{item.kicker}</p>
                  <p>{item.text}</p>
                </div>
                <p className="sticky-note">
                  <span>{item.step}</span>
                  {item.note}
                </p>
              </li>
            ))}
          </ol>
          <p className="guide-note">
            Conceptual only — not tested, functioning, or connected. No live
            scenario or integrations.
          </p>
        </div>
        <p className="quiet">
          Compatibility untested. Compatible .xlsx files can be uploaded to
          Google Sheets; not all Excel features transfer.
        </p>
        <p className="quiet">
          All products are proposed — not final. Purchase and download actions
          are disabled.
        </p>
      </section>
    </PageShell>
  );
}
