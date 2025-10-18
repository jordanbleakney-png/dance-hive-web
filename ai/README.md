# Dance Hive – System Overview & Development Guide

Purpose: Give contributors and AI tools a clear, accurate picture of the intended product experience and constraints. Self‑service sign‑up is disabled. All accounts originate from trial conversions managed by staff.

---

## 1) Public Experience

- Home: Marketing content about Dance Hive and clear CTA to view classes.
- Classes Page (public): Lists available classes with descriptions and details. Initial classes:
  - Hive Tots (18 months – 3 years)
    - A buzzing blend of ballet, acrobatics and general dance skills for toddlers and their grown-ups. Movement, music, rhythm; builds coordination, balance and confidence.
  - Hive Preschool Ballet (3 – 4 years)
    - A sweet swirl of ballet. Magical adventures exploring music and rhythm while developing ballet skills, coordination, balance and confidence.
  - Hive Preschool Acro (2.5 – 4 years)
    - A fusion of acrobatics and dance. Strength, balance, flexibility; foundations for forward rolls, cartwheels and handstands; introduces jazz/street and rhythm through play.
- Trial Booking: Parent selects a class and submits details. A confirmation page and email are sent.

Required fields at booking:
- Parent: firstName, lastName, email, phone
- Child: firstName, lastName, age
- Class: classId

Data recorded in `trialBookings`: parent{}, child{}, classId, status (pending|attended|converted), createdAt, updatedAt, convertedAt (nullable).

## 2) After the Trial

- Admin/Teacher marks each trial as pending, attended, or converted.
- If marked converted:
  - A user record is created (if not exists) with role `customer` and temporary password `dancehive123` (hashed).
  - The parent receives an email with login instructions.

## 3) Becoming a Member

- Logged-in customers see a “Become a Member” button in the dashboard.
- Clicking it starts Stripe Checkout.
- On payment success, the webhook:
  - Activates membership (`users.membership.status = "active"`).
  - Records an entry in `membershipHistory`.
  - Enrolls the child into the originally selected class (when class enrollment linkage is present).
- The dashboard then prompts the user to:
  - Set a new password.
  - Complete personal/contact info, emergency contacts, and medical info.

## 4) Dashboards

- Member Dashboard:
  - Shows account details, payment history, child’s class schedule.
  - Allows updating personal/emergency/medical information.
- Teacher Dashboard:
  - Shows teacher’s profile and weekly classes.
  - Class detail view: register, mark attendance, open a child’s profile with name, address, contacts, medical and emergency info.
- Admin Dashboard:
  - Users tab: view/search users, open user detail.
  - Trials tab: manage trial statuses (pending→attended→converted).
  - Payments tab: transactions and paying members.
  - Classes tab: add/edit/delete classes, move users across classes, remove users from classes.

## 5) Collections (MongoDB)

- `classes`: name, style, day, time, capacity, instructor
- `trialBookings`: parent{}, child{}, classId, status, createdAt, updatedAt, convertedAt
- `users`: email, password (hashed), role (trial|customer|member|teacher|admin), membership{status, plan, timestamps}
- `payments`: Stripe payment snapshots (and/or inferred from events)
- `membershipHistory`: conversions/renewals/cancellations with timestamps
- `processedEvents`: idempotency keys for Stripe webhook

## 6) Guardrails & Conventions

- No public sign-up:
  - `/signup` page removed.
  - `/api/register` endpoint disabled. Do not reintroduce public registration.
  - Accounts must be created via trial conversion or admin tooling.
- Auth:
  - NextAuth Credentials provider (JWT sessions). `session.user.role` drives UI routing and access.
- API:
  - Validate input (Zod where practical). Return `NextResponse.json()` consistently.
  - Use shared DB helper `getDb()` from `src/lib/dbConnect.ts` (avoid ad hoc clients).
- Stripe:
  - Use Checkout for payments; webhook updates membership + history. Keep handlers idempotent using `processedEvents`.
- Styling:
  - Tailwind v4. Keep components minimal and accessible.

## 7) Roadmap

- Replace Stripe with GoCardless for monthly direct debits.
- Analytics dashboard (conversion, attendance, retention).
- Teacher notes per class session.
- Expand class types/age brackets.
- Email/SMS reminders.

## 8) Do/Don’t for Code Generation

- Do enforce the trial → conversion → membership flow.
- Do gate routes and UI by role.
- Do keep `/api/register` disabled; don’t add public sign-up UIs.
- Do standardize on `getDb()` for Mongo access.
- Don’t log secrets or credentials. Don’t store plaintext passwords.
