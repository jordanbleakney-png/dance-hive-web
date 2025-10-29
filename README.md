# Dance Hive Web Application

 Dance Hive is a full-stack dance school platform built with Next.js (App Router), MongoDB, NextAuth, and payments (Stripe for testing, moving to GoCardless in production). The core user journey is trial -> attended -> converted -> paid member. Public self-sign up is disabled by design.

## Features

- Public classes listing with trial booking
- Admin, teacher and member dashboards (role-based)
- Trial management and conversion to customers -> members (via checkout)
- Member dashboard with Child/Parent cards, Enrolled Classes and Recent Payments
- Account Settings collects emergency + medical, Child date of birth and Address
- Stripe Checkout and webhook membership activation
- Email notifications and membership history tracking

## Tech Stack

- Framework: Next.js 14 (App Router)
- Database: MongoDB (native driver)
- Auth: NextAuth.js (Credentials provider, JWT sessions)
- Payments: Stripe (testing only) ‚Üí GoCardless (planned production). Webhooks used for membership activation and payments recording.
- Styling: TailwindCSS 4
- Deployment: Vercel

## Setup

1. Clone this repo
   ```bash
   git clone https://github.com/jordanbleakney-png/dance-hive-web.git
   cd dance-hive-web
   ```

2. Configure environment variables in `.env.local` (MongoDB, NextAuth, Stripe, email transport).

3. Install dependencies and run dev server:
   ```bash
   npm install
   npm run dev
   ```

## User Flow (No Public Sign-Up)

1) Browse classes and book a trial (parent + child details, class selection). A confirmation page and email are sent; `trialBookings` is updated.

2) Attend the trial. Admin/Teacher marks status (pending -> attended -> converted) in the dashboard.

3) On conversion, the system creates a customer account (email + temporary password) and the user can log in.

4) From the dashboard, the user clicks "Become a Member" and completes checkout (Stripe for testing; GoCardless planned for production mandate + subscription setup).

5) The payment provider webhook activates membership, records history, and enrolls the child into the selected class. The dashboard prompts to set a new password and complete personal, emergency, medical details, Child date of birth and Address.

### Converted customers welcome pop-up

When a user logs in with role `customer` and membership status `none`, a welcome modal encourages upgrade with an "Upgrade to Member" button. It is shown on every login until the user upgrades.

## Notes

- Public self-registration and the `/signup` page are removed. Any account creation occurs only via trial conversion by staff.
- Admin and Teacher dashboards provide class management, registers and attendance.
- Teacher register includes a Trial Students section. Teachers may mark "Attended" or "Convert" a trial. Convert creates/updates a customer account (not member) so the parent can upgrade later.

## Recent Additions

- Dashboard
  - Child Details card now shows Child name | Age | Date of birth and "Medical information" + "Emergency contact details".
  - Parent Details card shows Parent name | Phone | Email and Address details.
  - Enrolled Classes and Recent Payments render in separate cards below Child Details and Parent Details respectively.
- Account Settings
  - Added Child date of birth (ISO date), Address (houseNumber, street, city, county, postcode) plus existing emergency/medical details.
  - Prefills from `/api/account/overview`. For legacy addresses with `line1`, the UI attempts to split into houseNumber/street.
- Admin - Users
  - New "Child" column between Parent and Email.
  - Clicking a row opens an inline modal with user details. Admins can now edit user details (parent/child/address/emergency/medical), view payments, and fully manage enrollments:
    - Change an existing enrollment to a different class
    - Enroll the student into additional classes (multi-class membership)
    - Remove an enrollment
  - The modal pulls `/api/customers/[email]` which now returns `enrollments[]`, `payments[]`, and `enrollmentCount`.
- Logs
  - Replaced emojis/unicode with ASCII `[db] ...` logs.
  - If Atlas denies `collMod` when adjusting the `processedEvents` TTL, the app logs a single informational line. Either ignore it or change TTL in Atlas.

- Teacher Register (weekly)
  - Registers are per-week and tied to the class‚Äôs scheduled weekday. Quick navigation shows last/this/next week only on that weekday.
  - Attendance cannot be marked for future weeks (UI disabled + API validation). Unmarking is supported.

## API Cheatsheet

- `/api/account/overview` -> { parent, child, address, phone, email, emergencyContact, medical, membership, enrollments[], payments[] }
- `/api/account/profile` PATCH -> saves { childDob, address{houseNumber,street,city,county,postcode}, emergencyContact{name,phone,relation}, medical }
- `/api/customers/[email]` GET (admin) -> { user, enrollments[], payments[], enrollmentCount }
- `/api/admin/users` GET (admin) -> list of users with parent/child summaries

## Development Guidelines

- Prefer the shared DB helper `getDb()` and lean route handlers that return `NextResponse.json`.
- Keep JSX/TSX clean UTF-8 (avoid literal escaped sequences like `\n`, stray mojibake or encoded emojis).
- UI: Tailwind utility classes; keep components accessible and responsive.
- Security & Auth: gate admin/teacher/member pages in both UI and API. Use `auth()` from NextAuth route for API.
- Payments:
  - Current test: Stripe webhooks to record payments and activate membership.
  - Production plan: GoCardless mandates + subscriptions. Use `enrollmentCount` to compute monthly amount and update the GC subscription accordingly (see Billing Notes below).
- Avoid introducing public sign-up flows - all accounts are created via trial conversion.

## Project Status

- Unified child model: `children` collection is the source of truth. Trials convert to a user (parent) + a child document. No new writes to `users.child`.
- Enrollments are per-child: `enrollments` documents carry `childId` and are unique by `{ userId, childId, classId }` (index ensured on startup).
- Admin õ Users modal:
  - Always shows User Details. With multiple children, renders one "Enrolled Classes - Child Name" section per child; with a single child the header reads "Enrolled Classes - Child Name".
  - Add Child: collapsed by default ó shows only an "Add Child" button; clicking enters Edit mode where fields appear; submitting creates the child.
  - Enrollment UX: duplicate prevention in UI and API; capacity enforced. A cleanup endpoint exists for legacy duplicates.
- Teacher register (weekly): class-day anchored; future-week marking disabled (UI + API). Attendance updates per-child enrollments.
- API hardening: admin/teacher routes check roles server-side; payment webhooks are the source of truth.
- `enrollmentCount` returned by customer APIs; designed to drive GoCardless subscription amounts.
## Billing Plan (GoCardless)

- Replace the Stripe test flow with GoCardless hosted redirect to create a customer + mandate, then create a subscription.
- Compute the monthly amount from `enrollmentCount` (e.g., ¬£30 √ó active classes, or a tiered mapping) and update the GC subscription amount. GC uses a fixed amount per subscription (no quantity field).
- Prefer applying amount changes from the next collection date. If you need mid‚Äëcycle adjustments, create one‚Äëoff Payments for proration.

## Next Steps

- Admin modal: optional ‚ÄúAdd Child‚Äù form to create children quickly and attach enrollments.
- Member dashboard: show per‚Äëchild enrollments and ‚ÄúClasses: N‚Äù summary.
- GoCardless integration: redirect flow, webhooks, and subscription amount updates driven by `enrollmentCount`.

### Data/Index Notes
 - `enrollments` is the source of truth for who is in which class. Indexes:
  - Unique `{ userId: 1, classId: 1 }` (prevents duplicate enrollment)
  - `{ userId: 1 }`, `{ classId: 1 }` for lookups
 - `enrollmentCount` is derived as `enrollments.length` and returned by `/api/customers/[email]` for convenience.

## Admin Archive/Restore & Reactivation (Overview)

- Archive (Admin): moves a memberís `user`, `children`, and `enrollments` to `previousCustomers` and deletes them from active collections. Archived users are excluded from Admin Trials and Teacher registers.
- Previous Customers page: `/admin/previous-customers` lists archived users with columns Parent, Child, Email, Archived (date only), Reason, and Actions (Restore). Restoring removes the row immediately.
- Restore (Admin): recreates the user + children from the snapshot and normalizes the account to `role = "customer"`, `membership.status = "none"`, and `flags.reactivationPending = true`.
- Reactivation journey: on the next login after restore, the dashboard shows a ìWelcome backî modal with a "Re-activate Membership" CTA. After checkout completes, the Stripe webhook activates membership and clears the `flags.reactivationPending` flag.

## API and Data Model Updates (2025-10)

- Account Overview: `/api/account/overview` now returns `children[]` and includes `flags` alongside `membership` so the dashboard can show the returning-customer copy.
- Admin Endpoints:
  - `/api/admin/users/archive` archives a member to `previousCustomers`.
  - `/api/admin/users/restore` restores a previous customer and sets `reactivationPending`.
  - `/api/admin/previous-customers` lists archived users (restored entries are excluded).
- Enrollments per child: `enrollments` documents include `childId`. The unique index is `{ userId: 1, childId: 1, classId: 1 }` to prevent duplicates per child.
- Stripe webhook: upon successful membership activation, the handler also clears `flags.reactivationPending`.

## Developer Utilities

- `npm run reset-test-data` wipes and reseeds test data (see `scripts/resetTestData.js`).
- `npm run create-indexes` creates required MongoDB indexes (unique and TTL), including the webhook idempotency TTL on `processedEvents`.

### Billing Notes (GoCardless)
- Compute monthly price from `enrollmentCount` (e.g., ¬£30 √ó count or tiered mapping) and update the GoCardless subscription amount. GC does not support quantities; amount is fixed per subscription.
- Prefer applying the new amount from the next collection date (simple to operate). If you need mid-cycle adjustments, create one-off payments for proration.




## Reactivation QA Checklist

- Prepare
  - Run 
pm run reset-test-data (optional) and 
pm run create-indexes.
  - Ensure Stripe webhook secret is configured and the webhook handler is reachable in dev.
- Archive a member
  - From Admin Users, archive a member (or call /api/admin/users/archive).
  - Verify previousCustomers contains a snapshot. Confirm users, children, and enrollments are removed.
  - Confirm Admin Trials and Teacher registers do not list the archived user/trials.
- Restore the customer
  - Use /admin/previous-customers ? Restore. Row should disappear after success.
  - Verify restored user has ole = customer, membership.status = none, and lags.reactivationPending = true.
  - Verify children are recreated for the user.
- Member login (returning)
  - Log in as the restored user. A modal should show ìWelcome back, {FirstName}!î with the returning copy and a "Re-activate Membership" CTA.
  - Close with "Not now" hides the modal; reloading should show it again until activation.
- Checkout and webhook
  - Click CTA to start checkout; complete the flow.
  - Confirm webhook sets membership.status = active and unsets lags.reactivationPending.
  - Next login: modal no longer appears; dashboard reflects active membership.
- Enrollments and UI
  - Verify enrolled classes render per child (grouped by childId) where applicable.
  - Admin/Class detail pages show the correct child for multi-child households.
- Previous Customers hygiene
  - Restored user should no longer appear in /admin/previous-customers.
  - Archived entries show date only in the "Archived" column.
