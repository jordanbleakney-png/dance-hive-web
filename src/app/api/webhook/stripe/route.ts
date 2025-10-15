import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/dbConnect";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown Stripe verification error";
    console.error("❌ Stripe signature verification failed:", message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  const db = await getDb();

  try {
    switch (event.type) {
      // ✅ 1️⃣ Payment success (trial → member)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email?.toLowerCase();
        if (!email) break;

        // Check if user exists in trialBookings
        const trial = await db.collection("trialBookings").findOne({ email });
        if (!trial) {
          console.warn("⚠️ No trial booking found for:", email);
          break;
        }

        // Create or update user record
        const newUser = {
          name: trial.name || "User",
          email,
          role: "member",
          membership: {
            status: "active",
            plan: "standard",
            startedAt: new Date(),
            updatedAt: new Date(),
            lastPaymentDate: new Date(),
          },
          createdAt: new Date(),
        };

        await db
          .collection("users")
          .updateOne({ email }, { $set: newUser }, { upsert: true });

        // Mark trial as converted
        await db
          .collection("trialBookings")
          .updateOne(
            { email },
            { $set: { convertedToMember: true, convertedAt: new Date() } }
          );

        // Log conversion
        await db.collection("membershipHistory").insertOne({
          email,
          event: "converted_to_member",
          source: "checkout.session.completed",
          plan: "standard",
          timestamp: new Date(),
          details: {
            amount_total: session.amount_total,
            payment_intent: session.payment_intent,
          },
        });

        console.log(`✅ ${email} converted to member and logged`);
        break;
      }

      // ✅ 2️⃣ Subscription renewal (monthly payment)
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;

        // Fetch customer to get email
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as Stripe.Customer).email?.toLowerCase();
        if (!email) break;

        // Update user's last payment info
        await db.collection("users").updateOne(
          { email },
          {
            $set: {
              "membership.status": "active",
              "membership.lastPaymentDate": new Date(),
              "membership.updatedAt": new Date(),
            },
          }
        );

        // ✅ Safely type extended invoice
        const invoiceWithIntent = invoice as Stripe.Invoice & {
          payment_intent?: string;
        };
        const paymentIntentId = invoiceWithIntent.payment_intent ?? null;

        // Log renewal
        await db.collection("membershipHistory").insertOne({
          email,
          event: "payment_renewal",
          source: "invoice.payment_succeeded",
          timestamp: new Date(),
          details: {
            invoiceId: invoice.id,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
            payment_intent: paymentIntentId,
          },
        });

        console.log(`💰 Renewal payment logged for ${email}`);
        break;
      }

      // ✅ 3️⃣ Subscription canceled
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) {
          console.warn("⚠️ No customer ID found in subscription deleted event");
          break;
        }

        // Fetch customer to get email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail =
          (customer as Stripe.Customer).email?.toLowerCase() ?? null;
        if (!customerEmail) {
          console.warn(
            "⚠️ No email found for canceled subscription:",
            customerId
          );
          break;
        }

        // Update membership
        await db.collection("users").updateOne(
          { email: customerEmail },
          {
            $set: {
              "membership.status": "canceled",
              "membership.updatedAt": new Date(),
            },
          }
        );

        // Log cancellation
        await db.collection("membershipHistory").insertOne({
          email: customerEmail,
          event: "subscription_canceled",
          source: "customer.subscription.deleted",
          timestamp: new Date(),
          details: {
            subscriptionId: sub.id,
            cancel_at_period_end: sub.cancel_at_period_end,
          },
        });

        console.log(`⚠️ Subscription canceled for ${customerEmail}`);
        break;
      }

      default:
        // Ignore unrelated events
        break;
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
