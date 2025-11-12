# Dance Hive Web Application

Dance Hive is a full-stack dance school platform built with Next.js (App Router), MongoDB, NextAuth, and GoCardless for payments (Stripe was used only during early testing). The core journey is: trial → attended → converted → paid member. Public self‑sign up is intentionally disabled.

## Features

- Public classes listing with trial booking
- Admin, Teacher and Member dashboards (role‑based)
- Trial management and conversion to customers → members (via checkout)
- Member dashboard with Child/Parent cards, Enrolled Classes, Upcoming Direct Debit and Recent Payments
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

1) Clone the repo

```bash
git clone <repo>
cd dance-hive-web
```

2) Configure environment variables in `.env.local` (MongoDB, NextAuth, GoCardless, email transport).

3) Install and run

```bash
npm install
npm run dev
```

## User Flow (No Public Sign‑Up)

1) Parent books a trial (parent + child details, class selection). `trialBookings` is created.
2) Staff marks trial status (pending → attended → converted).
3) On conversion, a customer account is created; the parent logs in.
4) From the dashboard the parent chooses “Become a Member” and completes checkout (GoCardless Redirect Flow for mandate + subscription).
5) Webhook activates membership and auto‑enrols the child; the dashboard prompts to complete personal, emergency, medical, child DoB and address details.

## What’s New (Nov 2025)

- GoCardless hardening
  - Pro‑rata one‑off payment amounts stored/displayed with two decimals.
  - Idempotency keys include `redirect_flow_id` to prevent duplicate creation in reactivation.
- Webhook upserts
  - `payments.confirmed` upserts by `payment_id` (trims stray spaces), sets `status`/`payment_status` and timestamps.
  - `payments.failed` ready for the same upsert treatment (optional toggle).
- Auto‑enrol fallback
  - On subscription activation, enrolment falls back to `previousCustomers.snapshot` when no converted trial exists (reactivation case).
- Archive/restore behavior
  - Restoring a user preserves `previousCustomers.snapshot` so reactivation can infer classes for pro‑rata/enrolment.
- Upcoming Direct Debit
  - Dashboard card added; API returns `nextPayment` (first of next month, amount with two decimals, status “scheduled”).
- Member Trials (existing members can trial a new class for free)
  - Admin search endpoint; create member trial; convert trial to an additional enrolment; optional subscription reprice endpoint.

## Payments (GoCardless)

- Flow
  - Checkout completes the Redirect Flow (creates customer + mandate), then creates a subscription billed on the 1st of each month with `start_date` set to the first of next month. GoCardless shifts weekends/bank holidays to the next working day.
  - Monthly amount derives from `enrollmentCount` (e.g., 1=£30, 2=£55, 3=£75 cap).
  - Pro‑rata one‑off payment: `perClass = ceil(monthly/4)` × `classesLeftThisMonth` (weekday from latest converted trial); capped at the monthly fee. Uses up to 3 metadata keys (`email`, `reason=prorata`, `month=YYYY‑MM`). No `reference` in sandbox.
- Idempotency
  - Subscription: `sub_create:<userId>:<redirect_flow_id>`
  - Pro‑rata: `prorata:<userId>:<YYYY‑MM>:<redirect_flow_id>`
- Webhook `/api/webhook/gocardless`
  - HMAC verified with `GOCARDLESS_WEBHOOK_SECRET`; idempotent via `processedEvents` TTL collection.
  - `subscriptions.created|activated`: activates membership, stores GC IDs, sets `flags.memberWelcomePending=true`, auto‑enrols the child (capacity‑checked) with snapshot fallback.
  - `payments.confirmed`: trims `payment_id`, enriches if available, upserts by `payment_id` to `status=confirmed` and sets `paidAt`.
  - `payments.failed`: optional enhancement to upsert the pending row to `failed`.
- Sandbox specifics
  - No custom `payments.reference`; max 3 metadata keys.
  - Occasional `409/422` when a redirect flow is completed twice; first success is OK.
  - Atlas may deny `collMod` on the `processedEvents` TTL index; we log and continue (non‑fatal).

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

## Member Trials (Admin)

- Search members: `GET /api/admin/members/search`
- Create member trial: `POST /api/admin/trials/from-member`
- List trials (includes member trials): `GET /api/admin/trials`
- Convert member trial: `POST /api/admin/trials/update-status` (on `converted`, creates an additional enrolment if capacity allows)
- Optional: `POST /api/admin/billing/subscription/reprice` after conversion to update subscription amount for the next collection

Recommended index to prevent duplicate pending trials for the same child/class:

```
trialBookings.createIndex(
  { childId: 1, classId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
)
```

## Dashboard API

- Account overview: `GET /api/account/overview` → returns parent, child, contact details, membership, enrolments, payments, flags and `nextPayment` for the Upcoming Direct Debit card.

## Testing Hints

- Reactivation path: remove user → restore → run GC flow; verify pro‑rata (pending→confirmed) and auto‑enrol.
- Member trials: add member trial → mark converted → verify new enrolment; then call reprice endpoint and confirm subscription amount update.
- Expect Atlas `collMod` warnings on TTL adjustments in dev; they are non‑fatal.

## Development Guidelines

- Use the shared DB helper `getDb()` and lean route handlers that return `NextResponse.json()`.
- Keep handlers idempotent; use `processedEvents` TTL to guard webhooks.
- Avoid logging secrets; keep logs ASCII for Windows compatibility.

