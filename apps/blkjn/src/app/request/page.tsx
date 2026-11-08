import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { REQUEST_COLLECTION_ENABLED } from "@/data/catalogue";

export const metadata: Metadata = {
  title: "Request",
};

export default function RequestPage() {
  const collectionEnabled: false = REQUEST_COLLECTION_ENABLED;
  void collectionEnabled;

  return (
    <PageShell current="request">
      <section className="section frame request-layout">
        <div>
          <p className="pill">REQUEST</p>
          <h1>Have a template idea?</h1>
          <p className="section-lede">
            Describe the admin work you have in mind. Requests are not being
            collected yet.
          </p>
          <aside className="destination-card">
            <p className="destination-kicker">Intended destination</p>
            <p className="destination-address">peps@blkjn.com</p>
            <p className="quiet">Not available yet</p>
            <p>No message is sent from this page.</p>
          </aside>
        </div>
        <form
          className="request-card"
          data-collection="disabled"
          aria-disabled="true"
          aria-describedby="request-status"
        >
          <h2>Request a template</h2>
          <p id="request-status" className="request-status">
            Requests are not being collected yet. Nothing is sent.
          </p>
          <fieldset disabled>
            <label htmlFor="request-name">Name</label>
            <input id="request-name" name="name" type="text" autoComplete="off" />
            <label htmlFor="request-email">Email</label>
            <input
              id="request-email"
              name="email"
              type="email"
              autoComplete="off"
            />
            <label htmlFor="request-message">Request message</label>
            <textarea id="request-message" name="message" rows={5} />
            <button type="button" disabled data-action="submit-request">
              Submit unavailable
            </button>
          </fieldset>
        </form>
      </section>
    </PageShell>
  );
}
