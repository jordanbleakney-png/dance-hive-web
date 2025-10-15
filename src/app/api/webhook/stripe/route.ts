import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/dbConnect";
import { wasProcessed } from "@/lib/idempotency";
import { getEmailFromStripe } from "@/lib/stripeEmail";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover" as Stripe.LatestApiVersion,
});

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    if (!sig) {
      console.error("❌ Missing Stripe signature");
      return new NextResponse("Missing signature", { status: 400 });
    }

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Stripe signature verification failed:", message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  const db = await getDb();

  // 🧠 Idempotency check (avoid duplicate handling)
  const alreadyProcessed = await wasProcessed(event.id);
  if (alreadyProcessed) {
    console.log(`⚠️ Event ${event.id} already processed — skipping`);
    return new NextResponse("Event already processed", { status: 200 });
  }

  const email = getEmailFromStripe(event);
  if (!email) {
    console.warn(`⚠️ Could not extract email from event ${event.type}`);
    return new NextResponse("Missing email", { status: 200 });
  }

  try {
    switch (event.type) {
      // ✅ Checkout completed — convert trial → user
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const trial = await db.collection("trialBookings").findOne({ email });

        if (trial) {
          // Mark trial as converted instead of deleting
          await db
            .collection("trialBookings")
            .updateOne(
              { email },
              { $set: { status: "converted", convertedAt: new Date() } }
            );

          // Upsert user (copy relevant fields)
          await db.collection("users").updateOne(
            { email },
            {
              $setOnInsert: {
                createdAt: new Date(),
                joinedFromTrial: true,
              },
              $set: {
                name: trial.name,
                studentName: trial.studentName || "",
                phone: trial.phone || "",
                classType: trial.classType || "",
                role: "member",
                membership: {
                  status: "active",
                  plan: "monthly",
                  joinedAt: new Date(),
                },
                updatedAt: new Date(),
              },
            },
            { upsert: true }
          );

          await db.collection("membershipHistory").insertOne({
            email,
            event: "converted",
            timestamp: new Date(),
            details: {
              source: "stripe_checkout",
              sessionId: session.id,
            },
          });

          console.log(`✅ Trial migrated to member: ${email}`);
        } else {
          // Existing user with no trial
          await db.collection("users").updateOne(
            { email },
            {
              $set: {
                "membership.status": "active",
                "membership.joinedAt": new Date(),
              },
            },
            { upsert: true }
          );

          await db.collection("membershipHistory").insertOne({
            email,
            event: "new_checkout_member",
            timestamp: new Date(),
          });

          console.log(`✅ User activated: ${email}`);
        }

        break;
      }

      // ✅ Invoice succeeded — renewal
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        await db.collection("users").updateOne(
          { email },
          {
            $set: {
              "membership.status": "active",
              "membership.lastPaymentDate": new Date(),
            },
          }
        );

        await db.collection("membershipHistory").insertOne({
          email,
          event: "payment_renewal",
          timestamp: new Date(),
          details: {
            invoiceId: invoice.id,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
          },
        });

        console.log(`💰 Payment renewed for ${email}`);
        break;
      }

      // ✅ Subscription canceled
      case "customer.subscription.deleted": {
        await db.collection("users").updateOne(
          { email },
          {
            $set: {
              "membership.status": "canceled",
              "membership.updatedAt": new Date(),
            },
          }
        );

        await db.collection("membershipHistory").insertOne({
          email,
          event: "subscription_canceled",
          timestamp: new Date(),
        });

        console.log(`⚠️ Subscription canceled for ${email}`);
        break;
      }

      default:
        // No spam logs for unhandled events
        break;
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error: unknown) {
    console.error("💥 Webhook handler error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
