import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/dbConnect";
import { wasProcessed } from "@/lib/idempotency";
import { getEmailFromStripe } from "@/lib/stripeEmail";
import { ObjectId } from "mongodb";

// Use SDK default API version to avoid invalid version strings
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    if (!sig) {
      console.error("[webhook] Missing Stripe signature");
      return new NextResponse("Missing signature", { status: 400 });
    }

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Signature verification failed:", message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  const db = await getDb();

  // Idempotency check (avoid duplicate handling)
  const alreadyProcessed = await wasProcessed(event.id);
  if (alreadyProcessed) {
    console.log(`[webhook] Event ${event.id} already processed — skipping`);
    return new NextResponse("Event already processed", { status: 200 });
  }

  const email = getEmailFromStripe(event);
  if (!email) {
    console.warn(`[webhook] Could not extract email from event ${event.type}`);
    return new NextResponse("Missing email", { status: 200 });
  }

  try {
    switch (event.type) {
      // Checkout completed — convert trial -> user and enroll
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const trial = await db.collection("trialBookings").findOne({ email });

        if (trial) {
          // Mark trial as converted
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
              $setOnInsert: { createdAt: new Date(), joinedFromTrial: true }, $set: {
                name: trial.parentName || trial.childName || "User",
                phone: trial.parentPhone || "",
                role: "member",
                membership: { status: "active", plan: "monthly", joinedAt: new Date() },
                age: Number(trial.childAge) || trial.age || null, updatedAt: new Date(),
              },
            },
            { upsert: true }
          );

          await db.collection("membershipHistory").insertOne({
            email,
            event: "converted",
            timestamp: new Date(),
            details: { source: "stripe_checkout", sessionId: session.id },
          });

          // Enroll child into the selected class if available
          if (trial?.classId) {
            const userDoc = await db.collection("users").findOne({ email });
            if (userDoc) {
              let classObjectId: ObjectId | null = null;
              try {
                classObjectId = new ObjectId(String(trial.classId));
              } catch {}
              if (classObjectId) {
                const existingEnroll = await db
                  .collection("enrollments")
                  .findOne({ userId: userDoc._id, classId: classObjectId });
                if (!existingEnroll) {
                  await db.collection("enrollments").insertOne({
                    userId: userDoc._id,
                    classId: classObjectId,
                    status: "active",
                    attendedDates: [],
                    createdAt: new Date(),
                  });
                }
              }
            }
          }

          console.log(`[webhook] Trial converted and enrollment processed for ${email}`);
        } else {
          // Existing user with no trial
          await db.collection("users").updateOne(
            { email },
            { $set: { "membership.status": "active", "membership.joinedAt": new Date() } },
            { upsert: true }
          );

          await db.collection("membershipHistory").insertOne({
            email,
            event: "new_checkout_member",
            timestamp: new Date(),
          });

          console.log(`[webhook] User activated: ${email}`);
        }

        break;
      }

      // Invoice succeeded — renewal
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        await db.collection("users").updateOne(
          { email },
          { $set: { "membership.status": "active", "membership.lastPaymentDate": new Date() } }
        );

        await db.collection("membershipHistory").insertOne({
          email,
          event: "payment_renewal",
          timestamp: new Date(),
          details: { invoiceId: invoice.id, amount_paid: invoice.amount_paid, currency: invoice.currency },
        });

        console.log(`[webhook] Payment renewed for ${email}`);
        // Insert a payment record for invoice payments
        try {
          const inv: any = event.data.object as any;
          const amountPounds = Math.round(Number(inv.amount_paid || inv.amount_due || 0) / 100);
          await db.collection("payments").insertOne({
            email,
            amount: amountPounds,
            currency: String(inv.currency || "gbp").toUpperCase(),
            payment_status: "paid",
            payment_intent: inv.payment_intent || null,
            createdAt: new Date(),
          });
        } catch (e) {
          console.warn("[webhook] failed to write invoice payment record", e);
        }
        break;
      }

      // Subscription canceled
      case "customer.subscription.deleted": {
        await db.collection("users").updateOne(
          { email },
          { $set: { "membership.status": "canceled", "membership.updatedAt": new Date() } }
        );

        await db.collection("membershipHistory").insertOne({
          email,
          event: "subscription_canceled",
          timestamp: new Date(),
        });

        console.log(`[webhook] Subscription canceled for ${email}`);
        break;
      }

      default:
        break;
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error: unknown) {
    console.error("[webhook] handler error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}



