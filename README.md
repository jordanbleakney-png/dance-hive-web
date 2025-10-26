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
- Payments: Stripe (testing only) â†’ GoCardless (planned production). Webhooks used for membership activation and payments recording.
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
  - Registers are per-week and tied to the classâ€™s scheduled weekday. Quick navigation shows last/this/next week only on that weekday.
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
- Admin › Users modal:
  - Always shows User Details. With multiple children, renders one "Enrolled Classes - Child Name" section per child; with a single child the header reads "Enrolled Classes - Child Name".
  - Add Child: collapsed by default — shows only an "Add Child" button; clicking enters Edit mode where fields appear; submitting creates the child.
  - Enrollment UX: duplicate prevention in UI and API; capacity enforced. A cleanup endpoint exists for legacy duplicates.
- Teacher register (weekly): class-day anchored; future-week marking disabled (UI + API). Attendance updates per-child enrollments.
- API hardening: admin/teacher routes check roles server-side; payment webhooks are the source of truth.
- `enrollmentCount` returned by customer APIs; designed to drive GoCardless subscription amounts.
## Billing Plan (GoCardless)

- Replace the Stripe test flow with GoCardless hosted redirect to create a customer + mandate, then create a subscription.
- Compute the monthly amount from `enrollmentCount` (e.g., Â£30 Ã— active classes, or a tiered mapping) and update the GC subscription amount. GC uses a fixed amount per subscription (no quantity field).
- Prefer applying amount changes from the next collection date. If you need midâ€‘cycle adjustments, create oneâ€‘off Payments for proration.

## Next Steps

- Admin modal: optional â€œAdd Childâ€ form to create children quickly and attach enrollments.
- Member dashboard: show perâ€‘child enrollments and â€œClasses: Nâ€ summary.
- GoCardless integration: redirect flow, webhooks, and subscription amount updates driven by `enrollmentCount`.

### Data/Index Notes
- `enrollments` is the source of truth for who is in which class. Indexes:
  - Unique `{ userId: 1, classId: 1 }` (prevents duplicate enrollment)
  - `{ userId: 1 }`, `{ classId: 1 }` for lookups
- `enrollmentCount` is derived as `enrollments.length` and returned by `/api/customers/[email]` for convenience.

### Billing Notes (GoCardless)
- Compute monthly price from `enrollmentCount` (e.g., Â£30 Ã— count or tiered mapping) and update the GoCardless subscription amount. GC does not support quantities; amount is fixed per subscription.
- Prefer applying the new amount from the next collection date (simple to operate). If you need mid-cycle adjustments, create one-off payments for proration.


