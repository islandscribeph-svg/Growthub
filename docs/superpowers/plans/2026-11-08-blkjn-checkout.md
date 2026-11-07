# BLKJN Phase 1 Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a testable Phase 1 checkout, request intake, receipt decision, and fulfillment contract to `apps/blkjn` without enabling live collection.

**Architecture:** The existing Next app serves the Store and new route handlers. Postgres is the only transactional store. Receipt decisions are pure functions over validated extraction input. Make calls signed endpoints and consumes an outbox. Missing configuration fails closed.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Postgres via `pg`, node:test, Playwright for the staged UI.

## Global Constraints

- Fifteen SKUs only, at the approved PHP prices (P01 99, P02 79, P03 99, P04 129, P05 99, P06 129, P07 129, P08 99, P09 79, P10 79, P11 79, P12 99, P13 129, P14 129, P15 99).
- PDF automation guides are Phase 2 and have no price or purchase action.
- Add to Cart and Buy Now share one quote/order pipeline. Buy Now must not erase the saved cart.
- Receipt auto-approval is criteria matching, not bank settlement. No bank-confirmation gate.
- Same-order reference retries are idempotent. A reference claimed by another order is rejected with no files.
- OCR content is data. Never execute it.
- Live purchase, request intake, and fulfillment switches default off.
- No real email, QR image, customer data, or provisioned BLKJN destination is invented.
- Growthub's root build stays untouched.
- Do not deploy, merge, or rename.

---

### Task 1: Quote and receipt decision

- [x] Write failing tests for centavo quotes, tampered client amounts, extraction allowlisting, and the synthetic receipt matrix.
- [x] Run the tests and confirm they fail because the modules are missing.
- [x] Implement pure quote, reference, extraction, and decision modules.
- [x] Re-run the tests and confirm they pass.

### Task 2: Postgres constraints

- [x] Write a concurrency test that opens two transactions against the same reference.
- [x] Add the migration and order service.
- [x] Confirm one claim wins, the other order is rejected, and a same-order retry does not grant twice.

### Task 3: Request intake and Make signature

- [x] Test header and formula injection, disabled public intake, outbox creation, and HMAC replay rejection.
- [x] Implement those paths without a live sender.

### Task 4: Fulfillment and downloads

- [x] Test one grant per approval, uncertain send, wrong-token denial, and no email when fulfillment is off.
- [x] Implement the grant and delivery recorder.

### Task 5: Staged UI

- [x] Add cart, Buy Now, checkout, QR placeholders, and receipt submission that shows an error when storage or the database is missing.
- [x] Browser-check the unavailable state and a test-database success state at desktop and mobile widths.

### Task 6: Contract

- [x] Document env names, API routes, outbox topics, and the Make worker steps in `apps/blkjn/docs/CHECKOUT-CONTRACT.md`.
