# Dance Hive Web Application

Dance Hive is a full‑stack dance school platform built with Next.js (App Router), MongoDB, NextAuth, and payments (GoCardless in production; Stripe was used only during early testing). The core user journey is: trial → attended → converted → paid member. Public self‑sign up is intentionally disabled.

## Features

- Public classes listing with trial booking
- Admin, Teacher and Member dashboards (role‑based)
- Trial management and conversion to customers → members (via checkout)
- Member dashboard with Child/Parent cards, Enrolled Classes and Recent Payments
- Account Settings: emergency + medical, child date of birth and address
- Webhook‑driven membership activation and payments history

## Tech Stack

- Framework: Next.js 14 (App Router)
- Database: MongoDB (native driver)
- Auth: NextAuth.js (Credentials provider, JWT sessions)
- Payments: GoCardless (production)
- Styling: TailwindCSS 4
- Deployment: Vercel

## Setup

1. Clone the repo

```bash
git clone <repo>
cd dance-hive-web
```

2. Configure environment variables in `.env.local` (MongoDB, NextAuth, GoCardless, email transport).

3. Install and run

```bash
npm install
npm run dev
```

## User Flow (No Public Sign‑Up)

1. Parent books a trial (parent + child details, class selection). `trialBookings` is created.
2. Staff marks trial status (pending → attended → converted).
3. On conversion, a customer account is created; the parent logs in.
4. From the dashboard the parent chooses “Become a Member” and completes checkout (GoCardless Redirect Flow for mandate + subscription).
5. Webhook activates membership and auto‑enrols the child; the dashboard prompts to complete personal, emergency, medical, child DoB and address details.

## Recent Additions

- Dashboard and Admin payments show normalized status: `payment_status ?? status` (e.g., “pending submission”, “confirmed”).
- Success page performs a short confirmation loop, then hard‑redirects to `/dashboard?firstTime=1` to avoid a stale “customer” view.
- Dashboard does a one‑time quick re‑fetch on `firstTime=1` so users don’t need to manually refresh.
- Logs are ASCII (`[db] ...`). Atlas `collMod` denial on the `processedEvents` TTL index is logged and ignored (non‑fatal).

## Payments (GoCardless) — November 2025

- Flow
  - Checkout completes the GC Redirect Flow (creates customer + mandate), then creates a subscription billed on the 1st of each month with `start_date` = first of next month. GoCardless shifts weekends/bank holidays to the next working day.
  - Amount is derived from `enrollmentCount` via a simple tier (1=£30, 2=£55, ≥3=£75 cap).
  - Pro‑rata one‑off payment: `perClass = ceil(monthly/4)` × `classesLeftThisMonth` (weekday from latest converted trial), capped to the monthly fee. Created with ≤3 metadata keys (`email`, `reason=prorata`, `month=YYYY‑MM`). No `reference` in sandbox.
- Idempotency
  - Subscription: `sub_create:<userId>:<redirect_flow_id>`
  - Pro‑rata: `prorata:<userId>:<YYYY‑MM>:<redirect_flow_id>`
- Webhook `/api/webhook/gocardless`
  - HMAC verified with `GOCARDLESS_WEBHOOK_SECRET`; idempotent via `processedEvents`.
  - `subscriptions.created|activated`: activates membership, stores GC IDs, sets `flags.memberWelcomePending=true`, auto‑enrols the child from the latest converted trial (capacity‑checked).
  - `payments.confirmed`: trims `payment_id` (sandbox may include a leading space), enriches via GC Payments API, falls back to the seeded pending row for `email` if needed, and upserts the `payments` row by `payment_id` to `status=confirmed` (also sets `payment_status=confirmed`, `paidAt`).
  - `payments.failed`: keeps membership pending (optional enhancement: upsert the pending row to `failed`).
- UI/UX
  - Success: short confirm loop → hard redirect to `/dashboard?firstTime=1`.
  - Dashboard: one‑time quick re‑fetch on `firstTime=1` to update role to member without manual refresh.
- Sandbox specifics
  - No custom `payments.reference`; max 3 metadata keys.
  - Occasional `409/422` if a redirect flow is completed twice in dev; first success is fine.
  - Atlas may deny `collMod` on `processedEvents` TTL in dev; this is non‑fatal.

### Environment

```
GOCARDLESS_ENV=sandbox            # or live
GOCARDLESS_ACCESS_TOKEN=...
GOCARDLESS_WEBHOOK_SECRET=...
GOCARDLESS_CURRENCY=GBP
```

Expose the webhook in dev via ngrok and set the GC dashboard webhook to:

```
https://<your-ngrok>.ngrok-free.dev/api/webhook/gocardless
```

## API Cheatsheet

- `/api/account/overview` → { parent, child, address, phone, email, emergencyContact, medical, membership, enrollments[], payments[], flags }
- `/api/customers/[email]` (admin) → { user, enrollments[], payments[], enrollmentCount }
- `/api/admin/users` (admin) → list of users with parent/child summaries

## Development Guidelines

- Use the shared DB helper `getDb()` and lean route handlers that return `NextResponse.json()`.
- Keep handlers idempotent; use `processedEvents` TTL to guard webhooks.
- Avoid logging secrets; keep logs ASCII for Windows compatibility.
