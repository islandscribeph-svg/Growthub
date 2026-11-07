import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const outDir = new URL("../out/", import.meta.url);

const productNames = [
  "VA Task & Weekly Client Update",
  "Client Onboarding & Offboarding Checklist",
  "Recurring Admin & SOP Tracker",
  "Billable Hours & Retainer Balance Tracker",
  "Invoice & Payment Follow-Up Tracker",
  "Freelancer Income & Expense Tracker",
  "Simple Lead & Client Follow-Up CRM",
  "Proposal & Quote Tracker",
  "Client Feedback & Testimonial Log",
  "Meeting Notes & Action Items",
  "Inbox Triage & Response Log",
  "Content & Social Posting Calendar",
  "Inventory & Stock Level Tracker",
  "Supplier & Purchase Order Tracker",
  "Subscriptions & Renewals Tracker",
];

const packNames = [
  "CLIENT WORK",
  "BILLING & MONEY",
  "GET CLIENTS",
  "DAILY OPS",
  "SMALL BUSINESS BACK OFFICE",
];

function readOut(relativePath) {
  return readFileSync(new URL(relativePath, outDir), "utf8");
}

function visibleMarkup(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function asHtml(value) {
  return value.replaceAll("&", "&amp;");
}

function buttons(html, action) {
  return [...html.matchAll(new RegExp(`<button\\b[^>]*data-action="${action}"[^>]*>`, "g"))].map(
    (match) => match[0],
  );
}

const home = visibleMarkup(readOut("index.html"));
const store = visibleMarkup(readOut("store/index.html"));
const about = visibleMarkup(readOut("about/index.html"));
const request = visibleMarkup(readOut("request/index.html"));
const pages = { home, store, about, request };

for (const [name, html] of Object.entries(pages)) {
  assert.match(html, /DRAFT FOR REVIEW/, `${name} is marked as a draft`);
  assert.doesNotMatch(html, /href="[^"]+\.xlsx(?:["?#]|$)/i, `${name} has no workbook links`);
  assert.doesNotMatch(html, /href="[^"]+\.zip(?:["?#]|$)/i, `${name} has no archive links`);
  assert.doesNotMatch(html, /mailto:/i, `${name} drafts no email`);
  assert.doesNotMatch(html, /paypal\.com|stripe\.com|checkout\.paypal/i, `${name} has no payment links`);
  assert.doesNotMatch(html, /₱\s*\d|\$\s*\d|\bPHP\s*\d|\bUSD\b|\bEUR\b|geolocation/i, `${name} has no price amount`);
}

function decode(html) {
  return html
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", "\"");
}

assert.match(home, /Simple templates for VAs and small teams\./);
assert.match(home, /Browse Store/);
assert.match(home, /Made for the everyday work behind a business\./);
assert.match(home, /virtual assistants and small teams/);
assert.match(home, /Five proposed spreadsheet packs/);
assert.match(home, /PLANNED · AUTOMATION GUIDES/);
assert.match(home, /No guide content is tested or live\./);
assert.match(home, /hero-desktop\.png/);
assert.match(home, /hero-mobile\.png/);
assert.doesNotMatch(home, /product-card|data-product-id/, "Home has no product gallery");
const homeText = decode(home);
for (const name of productNames) {
  assert.equal(homeText.includes(name), false, `Home listed a product: ${name}`);
}

for (const pack of packNames) {
  assert.match(store, new RegExp(asHtml(pack).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const [index, name] of productNames.entries()) {
  const id = `BLKJN-P${String(index + 1).padStart(2, "0")}`;
  assert.match(store, new RegExp(`data-product-id="${id}"`));
  assert.match(store, new RegExp(asHtml(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.equal(buttons(store, "purchase").length, 15);
assert.equal(buttons(store, "download").length, 15);
for (const tag of [...buttons(store, "purchase"), ...buttons(store, "download")]) {
  assert.match(tag, /\bdisabled\b/);
  assert.match(tag, /type="button"/);
}
assert.equal((store.match(/Price pending/g) ?? []).length, 15);
assert.equal((store.match(/data-price="null"/g) ?? []).length, 15);
assert.match(store, /ILLUSTRATIVE MAKE\.COM-STYLE SCENARIO/);
assert.match(store, /Inspect the fictional sample/);
assert.match(store, /Check the filter condition/);
assert.match(store, /Review the mapped output/);
assert.match(store, /No guides available yet/);
assert.match(store, /not tested, functioning, or connected/);
assert.doesNotMatch(store, /BLKJN-G\d+|guide-sku|Basic VA Admin Kit/i);
assert.doesNotMatch(store, /BLKJN-Pack-/);

assert.match(about, /Bahala Ka Jan\./);
assert.match(about, /Fictional virtual assistant/);
assert.match(about, /not a BLKJN team member or customer/);
assert.match(about, /about-va\.png/);
assert.match(about, /Compatibility is untested, and not all Excel features transfer\./);
assert.match(about, /Currency direction: PHP only\. Prices pending\./);
assert.match(about, /Uploaded proof or a redirect\/return alone never unlocks files\./);
assert.match(about, /server-verified COMPLETED capture/);
assert.doesNotMatch(about, /testimonial|customer story|our team/i);

assert.match(request, /Have a template idea\?/);
assert.match(request, /data-collection="disabled"/);
assert.match(request, /<fieldset\b[^>]*\bdisabled\b/);
assert.match(request, /peps@blkjn\.com/);
assert.match(request, /\(not connected\)/);
assert.match(request, /No email is drafted or sent\./);
assert.match(request, /Mockup only — not connected; no requests are sent\./);
const submit = buttons(request, "submit-request");
assert.equal(submit.length, 1);
assert.match(submit[0], /\bdisabled\b/);
assert.match(submit[0], /type="button"/);
assert.match(request, /id="request-name"/);
assert.match(request, /id="request-email"/);
assert.match(request, /id="request-message"/);
assert.doesNotMatch(request, /type="submit"/);
assert.doesNotMatch(request, /<form\b[^>]*\saction="/);

const catalogue = readFileSync(new URL("../src/data/catalogue.ts", import.meta.url), "utf8");
assert.equal((catalogue.match(/product\(\d+,/g) ?? []).length, 15);
assert.match(catalogue, /price: null/);
assert.doesNotMatch(catalogue, /price:\s*\d|blank_file|example_file|pack_zip|\.xlsx/);
assert.match(catalogue, /REQUEST_COLLECTION_ENABLED = false/);
assert.match(catalogue, /PURCHASE_ENABLED = false/);
assert.match(catalogue, /DOWNLOAD_ENABLED = false/);

const publicFiles = walk(new URL("../public", import.meta.url).pathname);
for (const file of publicFiles) {
  assert.doesNotMatch(file, /\.(xlsx|xlsm|xls|zip)$/i, `public file exposed: ${file}`);
}

const sourceFiles = walk(new URL("../src", import.meta.url).pathname).filter((file) =>
  /\.(tsx|ts|css)$/.test(file),
);
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /fetch\(|mailto:|paypal\.com|sk_live|api\.stripe/i, file);
}

console.log("BLKJN gates passed: 15 products, prices null, purchase/download/request disabled.");
