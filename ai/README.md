# Dance Hive - System Overview & Development Guide

Purpose: Give contributors and AI tools a precise, up-to-date picture of Dance Hive's product flow and implementation guardrails. Self-service sign-up is disabled. All accounts originate from trial conversions managed by staff.

---

## 1) Public Experience

- Home: marketing content + CTAs.
- Classes (public): shows available classes with descriptions and details.
  - Hive Tots (18 months - 3 years)
  - Hive Preschool Ballet (3 - 4 years)
  - Hive Preschool Acro (2.5 - 4 years)
- Trial booking: parent selects a class and submits details.

Required fields

- Parent: firstName, lastName, email, phone
- Child: firstName, lastName, age
- Class: classId

trialBookings schema (effective)

- parent{}, child{}, classId, status (pending|attended|converted), createdAt, updatedAt, convertedAt (nullable)
- For legacy data, flat fields (parentName, childName, childAge, phone) may also exist. APIs handle both shapes.

## 2) Trial -> Account Creation

- Admin/Teacher updates a trial to converted.
- If user doesn't exist, create with role customer and temporary password (hashed).
- The parent receives login instructions.

## 3) Membership & Payments (GoCardless plan)

- Testing used Stripe, but production will use GoCardless (GC).
- Flow: user clicks "Become a Member" -> GC hosted redirect to create customer + mandate -> create GC subscription.
- Billing amount is computed from enrollmentCount (see Section 5/8):
  - Linear (£30 × active classes) or tiered mapping (e.g., 1=£30, 2=£55, 3=£75).
  - Update GC subscription amount when enrollments change (effective from next collection date). For mid‑cycle proration, optionally create a one‑off Payment.
- Webhooks: record successful payments, activate/keep membership, and handle mandate or subscription failures.
- payments collection: store amount in pounds, currency GBP; add provider identifiers (payment_id, mandate_id) when GC is integrated.

## 4) Dashboards & UX

- Member dashboard: shows role, hides "Upgrade to Member" when role === member or membership.status === active. Onboarding card uses a single "Update Details" button (password + personal/emergency/medical info). Settings now also collects Child date of birth + Address.
- Teacher dashboard: class list + register page backed by enrollments. Teachers can mark attendance (attendedDates on enrollments). Register is weekly, pinned to the class weekday. Future weeks are view‑only (no marking).
- Admin dashboard:
  - Users: search by name/email/role; table shows Parent, Child, Email, Role, Membership, Phone. Clicking a row opens an inline modal with user, bookings and payments (via `/api/customers/[email]`).
  - Trials: update status (pending -> attended -> converted).
  - Payments: transactions (GBP), parent name from users/trials.
  - Classes: list shows student counts via enrollments; detail shows child name, age, parent contact and email.

## 5) Collections (MongoDB)

- classes: name, style, day, time, capacity, instructor
- trialBookings: parent{}, child{}, classId, status, createdAt, updatedAt, convertedAt
- users: email, password (hashed), role (trial|customer|member|teacher|admin), phone, parent{firstName,lastName}, child{firstName,lastName,dob?}, address{houseNumber,street,city,county,postcode}, membership{status, plan, classId, timestamps}
- enrollments: userId, classId, status, attendedDates[], createdAt
  - Indexes: unique { userId:1, classId:1 }, plus { userId:1 }, { classId:1 }
- payments: email, amount (pounds), currency (GBP), payment_status, payment_intent, createdAt
- membershipHistory: conversions/renewals/cancellations with timestamps
- processedEvents: Stripe webhook idempotency keys

## 6) Guardrails & Conventions

- No public sign-up: `/signup` removed; `/api/register` disabled.
- Auth: NextAuth Credentials (JWT). `session.user.role` drives routing and access.
- API: validate inputs (Zod where practical), return `NextResponse.json()`, and use the shared DB helper `getDb()`.
- Payments: Stripe (testing) shifting to GoCardless (production). Keep handlers idempotent; use processedEvents for idempotency.
- Styling: Tailwind v4; keep components accessible and minimal. Prefer ASCII logs (avoid emojis) to prevent mojibake on Windows terminals. If Atlas denies `collMod` while altering the TTL index, log once and continue.

## 7) Developer Utilities

- scripts/backfillUsers.js: backfill names/child details/membership.classId from trialBookings; create enrollments. Optional purge flags.
- scripts/normalizePayments.js: convert payment amounts from pence -> pounds and (optionally) remove near-duplicates.

## 8) Coding Do/Don't

- Do enforce the trial -> conversion -> membership flow.
- Do gate routes and UI by role.
- Do keep `/api/register` disabled; don't add public sign-up.
- Do standardize on `getDb()` for Mongo access.
- Don't log secrets or credentials; don't store plaintext passwords.

### Billing Implementation Notes (GC)
- Keep enrollments as the source of truth for class participation.
- Derive `enrollmentCount` from enrollments (active only) when updating subscriptions.
- Store in users.membership:
  - gocardless_customer_id, gocardless_mandate_id, gocardless_subscription_id
  - status, optional cached enrollmentCount
- Apply changes from next charge date (simple). For proration, create one‑off Payments.

## Project Status (Summary)

- DB is clean of legacy test data. Normalized model is live: `children` collection + `enrollments` with `childId` (unique by `{ userId, childId, classId }`).
- Admin → Users modal: edit profile details and per‑child enrollments (change/add/remove) with capacity display and enforcement.
- Teacher register: weekly (locked to class weekday), mark/unmark only for current/past weeks; per‑child attendance via enrollments.
- API returns `children[]`, `enrollments[]` (with class + child), `payments[]`, and `enrollmentCount` for admin tools.
- Authorization checks in admin/teacher endpoints are consistent; success redirect is read‑only (webhook is authoritative).

## Next Steps

- Add minimal Admin “Add Child” UI and per‑child views in member dashboard.
- Integrate GoCardless: redirect flow (mandate), create subscription with amount computed from `enrollmentCount`, and webhook processing.
- Optional: tiered pricing rules and one‑off payment handling for mid‑cycle changes.

## 9) Migration From Stripe → GoCardless (Checklist)

Prereqs
- GoCardless sandbox account + access token
- Webhook endpoint URL reachable from GC (ngrok in dev)
- Decide pricing rule (linear £30 × count, or tiered map)
- Policy for proration (recommend: apply changes next charge date; optionally create one‑off Payments)

Environment variables (proposed)
- `GOCARDLESS_ACCESS_TOKEN`
- `GOCARDLESS_WEBHOOK_SECRET`
- `GOCARDLESS_REDIRECT_SUCCESS_URL` (where GC returns to after mandate setup)
- `GOCARDLESS_REDIRECT_CANCEL_URL`
- Optional: `GOCARDLESS_CURRENCY` default `GBP`

Data model additions (users.membership)
- `gocardless_customer_id`
- `gocardless_mandate_id`
- `gocardless_subscription_id`
- Optional cache: `enrollmentCount`, `nextChargeDate`

API changes (high level)
- Replace `/api/checkout`:
  - Start GC Redirect Flow → return `redirect_url`
  - On return, exchange for customer/mandate and create subscription with `amount = priceFor(enrollmentCount)` and monthly interval
  - Persist GC IDs on user and write `membershipHistory`
- Add `/api/webhook/gocardless` handler:
  - Handle `payment_confirmed/payment_created`, `subscription_activated/updated/cancelled`, `mandate_*` failures
  - Write `payments` with `{ provider: 'GoCardless', payment_id, mandate_id, amount, currency, createdAt }`
  - Update `users.membership.status` and `lastPaymentDate` as needed
  - Use existing `processedEvents` idempotency guard

Enrollment-driven updates
- After any enrollment add/remove:
  - Recompute active `enrollmentCount`
  - Compute new amount and update GC subscription amount (effective next collection)
  - Optionally create one‑off Payment for proration
  - Store cached `membership.enrollmentCount`

UI notes
- Member dashboard: show enrollment count and next charge amount/date (if cached)
- Admin modal already shows/edit enrollments; after change, optionally trigger a billing sync endpoint

Cutover steps
1) Deploy webhook endpoint for GC and verify signature locally
2) Implement redirect flow + subscription creation in sandbox
3) Switch `/api/checkout` to GC path; keep Stripe path disabled
4) Update README billing notes and ops runbook
5) QA: mandate created → subscription created → payment confirmed webhook → payments row written → membership active
6) Optional migration: keep Stripe payments as read‑only history; do not mix providers for the same user

Ops/failure handling
- Mandate failure or bank details changed → pause membership and notify admin
- Payment failure → keep membership pending and surface in admin payments
- Retries: GC will retry; webhook handler must be idempotent
