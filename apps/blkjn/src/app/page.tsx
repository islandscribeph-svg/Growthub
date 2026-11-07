import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SheetPreview } from "@/components/sheet-preview";
import { packs } from "@/data/catalogue";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <PageShell current="home">
      <section className="hero" aria-labelledby="home-heading">
        <div className="hero-copy">
          <p className="pill">BAHALA KA JAN</p>
          <h1 id="home-heading">Simple templates for VAs and small teams.</h1>
          <p className="hero-lede">
            Premade spreadsheet templates for everyday admin, plus planned PDF
            guides for learning practical automation.
          </p>
          <Link className="button" href="/store">
            Browse Store →
          </Link>
        </div>
        <div className="hero-stage">
          <img
            className="hero-desktop"
            src="/images/hero-desktop.png"
            alt="Sunlit wooden desk with a desktop monitor, keyboard, and plants. The screen is an illustrative spreadsheet preview, proposed and not final."
            width={1536}
            height={1024}
          />
          <div className="hero-fade" aria-hidden="true" />
          <div className="monitor-preview monitor-preview-desktop" aria-hidden="true">
            <SheetPreview columns={["TASK", "STATUS", "WEEK"]} />
          </div>
          <div className="hero-mobile-frame">
            <img
              className="hero-mobile"
              src="/images/hero-mobile.png"
              alt="Sunlit desk with a full desktop monitor. The screen is an illustrative spreadsheet preview, proposed and not final."
              width={390}
              height={680}
            />
            <div className="monitor-preview monitor-preview-mobile" aria-hidden="true">
              <SheetPreview columns={["TASK", "STATUS", "WEEK"]} />
            </div>
          </div>
          <p className="hero-caption">
            Illustrative spreadsheet preview · proposed, not final.
          </p>
        </div>
      </section>

      <section className="section frame" aria-labelledby="purpose-heading">
        <h2 id="purpose-heading">Made for the everyday work behind a business.</h2>
        <p className="measure">
          BLKJN means Bahala Ka Jan. The concept brings simple admin templates
          and practical automation learning into one approachable place for
          virtual assistants and small teams.
        </p>
      </section>

      <section className="section frame" aria-labelledby="packs-heading">
        <h2 id="packs-heading">Five proposed spreadsheet packs</h2>
        <p className="section-lede">Organized by task, not by complexity.</p>
        <div className="pack-grid">
          {packs.map((pack) => (
            <article className="pack-card" key={pack.id}>
              <p className="pack-kicker">
                <span>{pack.index}</span>
                {pack.id}
              </p>
              <p>{pack.blurb}</p>
            </article>
          ))}
          <article className="pack-card pack-card-planned">
            <p className="planned-kicker">PLANNED · AUTOMATION GUIDES</p>
            <p>Separate PDF learning guides, not yet available.</p>
            <p>No guide content is tested or live.</p>
          </article>
        </div>
      </section>

      <section className="section frame path" aria-labelledby="path-heading">
        <h2 id="path-heading">A simple future path to downloads</h2>
        <ol className="path-steps">
          <li>
            <span>01</span> Explore proposed tools
          </li>
          <li>
            <span>02</span> Review details when ready
          </li>
          <li>
            <span>03</span> Authorized private access
          </li>
        </ol>
        <p className="quiet">
          Checkout and downloads are not live. Prices on the Store are in PHP
          and are the same for every buyer.
        </p>
      </section>
    </PageShell>
  );
}
