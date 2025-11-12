# Dance Hive – System Overview for Contributors and Tools

Purpose: Provide an accurate, current picture of product flows, data shapes, and implementation guardrails. Public self‑sign‑up is disabled. Accounts originate from trial conversions managed by staff.

---

## Product Flows

- Trials
  - Parent books a trial (parent + child + class).
  - Staff sets status: pending → attended → converted.
  - On conversion, a customer account is created and the parent logs in.

- Membership (GoCardless)
  - Parent selects “Become a Member” → GC redirect flow creates customer + mandate → subscription created for the 1st of next month.
  - Amount derives from active enrolments (e.g., 1=£30, 2=£55, 3=£75 cap).
  - Pro‑rata one‑off payment optionally created for the remainder of the current month.
  - Webhooks activate membership and record payments.

- Dashboard
  - Shows parent/child cards, enrolled classes, Upcoming Direct Debit, and Recent Payments.

---

## Latest Changes (Nov 2025)

- GoCardless hardening
  - Pro‑rata one‑off amounts stored/displayed with two decimals.
  - Idempotency keys include `redirect_flow_id` to prevent duplicate creation during reactivation.
  - Implemented in: `src/app/api/checkout/complete/route.js`.

- Webhooks upsert by `payment_id`
  - `payments.confirmed` trims the sandbox’s stray leading space in IDs, enriches when available, and upserts the `payments` document by `payment_id`; sets `status`/`payment_status` and `paidAt`.
  - `payments.failed` prepared for the same “upsert by payment_id” treatment so pending rows flip to failed instead of inserting duplicates.
  - Implemented in: `src/app/api/webhook/gocardless/route.ts`.

- Auto‑enrol fallback on activation
  - When no converted trial exists (reactivation), fall back to `previousCustomers.snapshot` to enrol the child.
  - Implemented in: webhook handler; see above route.

- Restore behavior
  - Restoring a user no longer removes `previousCustomers.snapshot` (preserved for reactivation logic).
  - Implemented in: `src/app/api/admin/users/restore/route.ts`.

- Upcoming Direct Debit card
  - API returns `nextPayment` (first of next month, amount with two decimals, status “scheduled”).
  - Implemented in: `src/app/api/account/overview/route.ts` and UI `src/app/dashboard/page.js`.

- Member Trials (existing member can try a new class for free)
  - Search members: `GET /api/admin/members/search` → `src/app/api/admin/members/search/route.ts`.
  - Create member trial: `POST /api/admin/trials/from-member` → `src/app/api/admin/trials/from-member/route.ts`.
  - List trials (includes member trials): `GET /api/admin/trials` → `src/app/api/admin/trials/route.js`.
  - Convert member trial: `POST /api/admin/trials/update-status` → `src/app/api/admin/trials/update-status/route.ts`.
  - Optional reprice: `POST /api/admin/billing/subscription/reprice` → `src/app/api/admin/billing/subscription/reprice/route.ts`.
  - Admin UI: `src/app/admin/trials/page.js` (modal for “Add Member Trial”).

---

## Collections (MongoDB)

- `classes` { name, style, day, time, capacity, instructor }
- `trialBookings` { parent{}, child{}, classId, status, trialDate?, isMemberTrial?, createdAt, updatedAt }
- `users` { email, password, role, phone, parent{}, address{}, membership{}, flags{}, previousCustomers?.snapshot }
- `children` { userId, firstName, lastName, dob?, medical?, emergencyContact?, createdAt, updatedAt }
- `enrollments` { userId, childId, classId, status, attendedDates[], createdAt }
  - Indexes: unique `{ userId:1, childId:1, classId:1 }`, plus `{ userId:1 }`, `{ classId:1 }`, `{ childId:1 }`.
- `payments` { email, amount (pounds), currency, payment_status, payment_id?, mandate_id?, createdAt, paidAt? }
- `membershipHistory` { type, notes, timestamps }
- `processedEvents` { eventId, createdAt } (TTL for webhook idempotency)

Recommended index (duplicate‑prevention for pending member trials):

```
trialBookings.createIndex(
  { childId: 1, classId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
)
```

---

## API Surface (selected)

- Account overview: `GET /api/account/overview` → parent/child/contact, membership, enrolments, payments, flags, `nextPayment`.
- Customers (admin): `GET /api/customers/[email]` → user, enrolments, payments, counts.
- Trials (admin): list, update status, update trial date, member‑trial create/convert.
- Members search (admin): search by name/email and list children for trial selection.
- Billing (admin): subscription reprice endpoint.

---

## GoCardless Notes

- Sandbox specifics
  - No custom `payments.reference`.
  - Up to 3 metadata keys (e.g., `email`, `reason`, `month`).
  - Expect `409/422` if the same redirect flow is completed twice during dev; first success wins.
- Idempotency keys
  - Subscription: `sub_create:<userId>:<redirect_flow_id>`
  - Pro‑rata: `prorata:<userId>:<YYYY‑MM>:<redirect_flow_id>`
- TTL index warning
  - Atlas may deny `collMod` when adjusting TTL on `processedEvents`. We log and continue (non‑fatal).

Environment:

```
GOCARDLESS_ENV=sandbox            # or live
GOCARDLESS_ACCESS_TOKEN=...
GOCARDLESS_WEBHOOK_SECRET=...
GOCARDLESS_CURRENCY=GBP
```

---

## Developer Guidance

- Use `getDb()`; keep route handlers lean and idempotent; return `NextResponse.json()`.
- Keep logs ASCII for Windows compatibility; avoid leaking secrets.
- Prefer server‑side upserts and unique indexes to enforce invariants.

---

## Testing Checklist

- Reactivation: archive → restore → run GC flow; verify pro‑rata pending→confirmed, auto‑enrol, dashboard updates.
- Payments: webhook confirms `payments.confirmed` upsert; amounts display with two decimals in admin/member views.
- Member Trials: create from an existing member → convert → new enrolment appears; optional reprice adjusts subscription amount for next month.
- Upcoming DD: `/api/account/overview` returns `nextPayment`; dashboard card displays date/amount/status correctly.

