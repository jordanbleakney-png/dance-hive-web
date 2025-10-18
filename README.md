# Dance Hive Web Application

Dance Hive is a full-stack dance school platform built with Next.js (App Router), MongoDB, NextAuth, and Stripe. The core user journey is trial → attended → converted → paid member. Public self-sign up is disabled by design.

## Features

- Public classes listing with trial booking
- Admin and teacher dashboards (role-based)
- Trial management and conversion to customers/members
- Stripe Checkout and webhook membership activation
- Email notifications and membership history tracking

## Tech Stack

- Framework: Next.js 14 (App Router)
- Database: MongoDB (native driver)
- Auth: NextAuth.js (Credentials provider, JWT sessions)
- Payments: Stripe Checkout + webhook
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

2) Attend the trial. Admin/Teacher marks status (pending → attended → converted) in the dashboard.

3) On conversion, the system creates a customer account (email + temporary password) and the user can log in.

4) From the dashboard, the user clicks "Become a Member" and completes Stripe Checkout.

5) Stripe webhook activates membership, records history, and enrolls the child into the selected class. The dashboard prompts to set a new password and complete personal, emergency and medical details.

## Notes

- Public self-registration and the `/signup` page are removed. Any account creation occurs only via trial conversion by staff.
- Admin and Teacher dashboards provide class management, registers and attendance.
