import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <PageShell current="about">
      <section className="section frame about-hero">
        <div>
          <p className="pill">ABOUT BLKJN</p>
          <h1>Bahala Ka Jan.</h1>
          <p className="section-lede about-lede">
            Simple templates and practical automation learning for virtual
            assistants and small businesses.
          </p>
        </div>
        <article className="about-card">
          <img
            src="/images/about-va.png"
            alt="Fictional virtual assistant at a computer. Illustrative scene, not a BLKJN team member or customer."
            width={1536}
            height={1024}
          />
          <p className="photo-caption">
            Fictional virtual assistant · illustrative scene, not a BLKJN team
            member or customer.
          </p>
          <h2>What BLKJN is for</h2>
          <p>
            BLKJN means Bahala Ka Jan. The idea is to make everyday admin easier
            to organize with straightforward premade spreadsheets and planned
            PDF automation learning guides.
          </p>
        </article>
      </section>

      <section className="section frame" aria-labelledby="formats-heading">
        <h2 id="formats-heading">Planned formats</h2>
        <div className="format-grid">
          <article className="format-card format-card-mint">
            <h3>.xlsx spreadsheets</h3>
            <p>
              A spreadsheet can be uploaded to Google Sheets. Not every Excel
              feature transfers.
            </p>
          </article>
          <article className="format-card">
            <h3>Automation learning</h3>
            <p>
              Practical PDF learning guides are planned separately. Guides and
              downloads are not available yet.
            </p>
          </article>
        </div>
      </section>

      <section className="section frame" aria-labelledby="access-heading">
        <h2 id="access-heading">Purchases are not available yet</h2>
        <p className="quiet">
          Purchases and downloads are not available yet.
        </p>
        <p className="quiet">
          Currency: PHP only. The same price applies to every buyer and is
          shown on the Store. Purchases and downloads are not available yet.
        </p>
        <article className="safeguard-card">
          <h3>Planned payment safeguards</h3>
          <div className="safeguard-grid">
            <div>
              <h4>QR / manual</h4>
              <p>Not available yet.</p>
              <p>Owner confirmation that funds arrived would be required.</p>
            </div>
            <div>
              <h4>PayPal</h4>
              <p>Not available yet.</p>
              <p>A server-verified COMPLETED capture would be required.</p>
            </div>
          </div>
          <p className="safeguard-banner">
            Uploaded proof or a redirect/return alone never unlocks files.
          </p>
        </article>
        <p className="quiet fine-print">
          Prices are shown for reference. Purchases and file delivery are not
          available yet.
        </p>
      </section>
    </PageShell>
  );
}
