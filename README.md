# Growthub

Weekly call-tracking dashboard synced from a Google Calendar. Replicates a manually-kept spreadsheet's format: calls grouped by week, broken down by lead channel (Content/Ads/Cold Email/Referral), each scored Qualified/Unqualified/No-Show, with a free-text "Concerns" note per week.

Stack: Next.js (App Router, TypeScript) + Prisma + Postgres, Tailwind. Standalone app — no connection to any CRM.

## How the data gets in

There's no live Google OAuth integration; instead it reads a calendar's **private iCal feed URL** (Google Calendar → gear icon → Settings → select the calendar under "Settings for my calendars" → "Secret address in iCal format"). Set that URL as `CALLS_CALENDAR_ICS_URL`.

Clicking **Sync from calendar** on the dashboard pulls events from roughly the last 26 weeks through 2 weeks out, and best-effort guesses each call's source/qualified/no-show from keywords in the event title/description (see `src/lib/call-parsing.ts`). Those guesses are just a starting point — every field stays editable in the dashboard, and re-syncing never overwrites a manual correction; it only refreshes the title/time/description if the calendar event itself changed.

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Database.** Any Postgres works, including a free [Supabase](https://supabase.com) project — use its "Connect" dialog → **ORM** tab (Prisma) to get both connection strings it expects. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (pooled, port 6543), `DIRECT_URL` (direct, port 5432 — used only for running migrations), `SESSION_SECRET` (`openssl rand -base64 32`), and `CALLS_CALENDAR_ICS_URL`.

3. **Run migrations**
   ```bash
   npm run db:migrate
   ```

4. **Create your first login.** Set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`, then:
   ```bash
   npm run db:seed
   ```

5. **Run the app**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000, sign in with the admin login from step 4, then click **Sync from calendar**.

## Deploying

Deploy to Vercel and set `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) to your Supabase (or other) Postgres instance, plus `SESSION_SECRET` and `CALLS_CALENDAR_ICS_URL`. The build (`npm run build`) runs `prisma migrate deploy` before `next build`, so every deploy automatically applies any pending schema migrations.

### First-time bootstrap on a fresh deploy

Right after the first deploy, the database has tables but no admin login. A one-time setup endpoint handles that, gated by an `x-setup-key` header that must match your `SESSION_SECRET` (it self-disables — returns 409 — once a user already exists, so it's safe to leave deployed):

```bash
# Create the first admin login
curl -X POST https://<your-deploy>.vercel.app/api/setup/admin \
  -H "x-setup-key: $SESSION_SECRET" -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"you@example.com","password":"choose-a-real-password"}'

# Check current state at any time
curl https://<your-deploy>.vercel.app/api/setup/status -H "x-setup-key: $SESSION_SECRET"
```

Local dev can still use `npm run db:seed` directly against a local or dev database if you prefer — `/api/setup/*` exists specifically so a fresh Vercel+Supabase deploy can be bootstrapped without shell access to the production database.
