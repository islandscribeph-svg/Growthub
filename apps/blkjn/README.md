# BLKJN

Draft site for BLKJN (Bahala Ka Jan): simple spreadsheet templates for virtual assistants and small teams, plus a planned Automation Guides section. This directory is a separate app from the Growthub dashboard at the repository root.

**Status: draft for review. Not live.** Checkout, purchases, downloads, and request collection are disabled. Prices are null. There is no payment setup and no email delivery.

## Build

From this directory:

```bash
npm install
npm run build
npm run test:gates
npm run dev
```

`npm run dev` serves http://localhost:3210. `npm run build` writes a static export to `out/`. The root Growthub command `npm run build` does not build this app, and this app does not run Growthub's Prisma migration.

Do not add this app to a root npm workspace. That would change how the Growthub app installs.

## What this draft includes

- Home, Store, Request, and About.
- The approved Home v4 hero: the attached monitor photograph is the hero background, with the headline and Browse Store link on top. The mobile hero uses the attached mobile background and keeps the full monitor visible.
- All 15 catalogue products in five packs. Pack archives are not extra products. Automation Guides are a separate planned section, not SKUs.
- An illustrative Make.com-style scenario with three sticky notes. It is not a scenario, connection, or running automation.
- Request fields are Name, Email, and Request message. The intended future address `peps@blkjn.com` is shown as not connected. The form cannot be submitted.
- About uses the attached fictional virtual-assistant photograph. It is not a team member, customer, or testimonial.

## What this draft does not include

- Prices. Every product amount is null. The only currency direction is PHP, with no selector and no geolocation.
- Workbook files, pack ZIPs, or public download URLs. Blank and Example editions are not published here.
- A claim that Excel or Google Sheets compatibility was tested. Planned `.xlsx` files are macro-free in the source catalogue, and native Excel and Google Sheets were not verified.
- PayPal, QR codes, payee details, checkout credentials, or email tests.
- Make.com, Google Drive, or Google Sheets connectors. A later website automation may use the owner's personal Make.com account. BLKJN email, Drive, and Sheets stay BLKJN-owned. None of that is connected in this app.
- PDF automation guides. Those are planned and not built.

## Deployment

This app is not deployed. Leave the existing Growthub Vercel project on the repository root so its build command stays `prisma migrate deploy && next build`.

A later BLKJN deployment should be a separate static host or a separate Vercel project whose root directory is `apps/blkjn`. It needs no database and no payment or email secrets. Do not attach it to the Growthub production project, and do not publish this draft as the live site until checkout, prices, and file delivery are intentionally built.

## Repository name

The GitHub repository is still `islandscribeph-svg/Growthub`. It was not renamed to `peps-personal`. This environment's GitHub CLI is limited to read-only use, so `gh repo rename` was not run, and there is no other authorized rename tool. The Vercel GitHub App has already created Production deployments for this repository. Those recorded deployments failed, but a rename can still disturb that integration. The rename was left for the repository owner.

## Images

Photographic files in `public/images/` are the attached review assets, copied byte-for-byte. See `docs/IMAGE-PROVENANCE.md`.
