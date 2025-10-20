# Dance Hive – System Overview & Development Guide

Purpose: Give contributors and AI tools a precise, up‑to‑date picture of Dance Hive’s product flow and implementation guardrails. Self‑service sign‑up is disabled. All accounts originate from trial conversions managed by staff.

---

## 1) Public Experience

- Home: marketing content + CTAs.
- Classes (public): shows available classes with descriptions and details.
  - Hive Tots (18 months – 3 years)
  - Hive Preschool Ballet (3 – 4 years)
  - Hive Preschool Acro (2.5 – 4 years)
- Trial booking: parent selects a class and submits details.

Required fields

- Parent: firstName, lastName, email, phone
- Child: firstName, lastName, age
- Class: classId

trialBookings schema (effective)

- parent{}, child{}, classId, status (pending|attended|converted), createdAt, updatedAt, convertedAt (nullable)
- For legacy data, flat fields (parentName, childName, childAge, phone) may also exist. APIs handle both shapes.

## 2) Trial → Account Creation

- Admin/Teacher updates a trial to converted.
- If user doesn’t exist, create with role customer and temporary password (hashed).
- The parent receives login instructions.

## 3) Membership & Payments (Stripe)

- Flow: user clicks “Become a Member” → Stripe Checkout (subscription).
- Webhook is the single source of truth for charges:
  - invoice.payment_succeeded: activates membership, records membershipHistory, writes a payment record (in GBP pounds), and updates lastPaymentDate.
  - checkout.session.completed: converts a matching trial (if found), upserts the user (name/phone/child details), enrolls the child in classId from the trial, and records membershipHistory. It no longer writes a payment row (to avoid double entries); renewals/charges are recorded via invoices.
- Idempotency: processedEvents collection prevents double‑handling.
- payments collection: amount stored in pounds (e.g., 30), currency stored as GBP.
- Admin payments page derives Parent Name by joining (case‑insensitive) to users or latest trialBookings; if still unknown, it derives a readable fallback from the email local part.

## 4) Dashboards & UX

- Member dashboard: shows role, hides “Upgrade to Member” when role === member or membership.status === active. Onboarding card uses a single “Update Details” button (password + personal/emergency/medical info) and includes a back link from settings.
- Teacher dashboard: class list + register page backed by enrollments. Teachers can mark attendance (attendedDates on enrollments).
- Admin dashboard:
  - Users: search by email.
  - Trials: update status (pending → attended → converted).
  - Payments: transactions (GBP), parent name from users/trials.
  - Classes: list shows student counts via enrollments; detail shows child name, age, parent contact and email.

## 5) Collections (MongoDB)

- classes: name, style, day, time, capacity, instructor
- trialBookings: parent{}, child{}, classId, status, createdAt, updatedAt, convertedAt
- users: email, password (hashed), role (trial|customer|member|teacher|admin), parentPhone/phone, childName, age, membership{status, plan, classId, timestamps}
- enrollments: userId, classId, status, attendedDates[], createdAt
- payments: email, amount (pounds), currency (GBP), payment_status, payment_intent, createdAt
- membershipHistory: conversions/renewals/cancellations with timestamps
- processedEvents: Stripe webhook idempotency keys

## 6) Guardrails & Conventions

- No public sign‑up: `/signup` removed; `/api/register` disabled.
- Auth: NextAuth Credentials (JWT). `session.user.role` drives routing and access.
- API: validate inputs (Zod where practical), return `NextResponse.json()`, and use the shared DB helper `getDb()`.
- Stripe: Checkout for subscription; rely on invoices for payment records; keep handlers idempotent.
- Styling: Tailwind v4; keep components accessible and minimal.

## 7) Developer Utilities

- scripts/backfillUsers.js: backfill names/child details/membership.classId from trialBookings; create enrollments. Optional purge flags.
- scripts/normalizePayments.js: convert payment amounts from pence → pounds and (optionally) remove near‑duplicates.

## 8) Coding Do/Don’t

- Do enforce the trial → conversion → membership flow.
- Do gate routes and UI by role.
- Do keep `/api/register` disabled; don’t add public sign‑up.
- Do standardize on `getDb()` for Mongo access.
- Don’t log secrets or credentials; don’t store plaintext passwords.
