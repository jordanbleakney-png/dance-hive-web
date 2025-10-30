import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/dbConnect";
import { wasProcessed } from "@/lib/idempotency";
import { getEmailFromStripe } from "@/lib/stripeEmail";
import { ObjectId } from "mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function split(full?: string) {
  if (!full || typeof full !== "string") return { first: "", last: "" };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!sig) return new NextResponse("Missing signature", { status: 400 });
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  const db = await getDb();

  // Idempotency guard
  if (await wasProcessed(event.id)) {
    return new NextResponse("Event already processed", { status: 200 });
  }

  const email = getEmailFromStripe(event);
  if (!email) return new NextResponse("Missing email", { status: 200 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const trial = await db.collection("trialBookings").findOne({ email });

        if (trial) {
          // Mark trial converted
          await db
            .collection("trialBookings")
            .updateOne(
              { email },
              { $set:{ status: "converted", convertedAt: new Date() } }
            );

          // Build normalized names/phone
          const parentFirstName =
            (trial as any)?.parent?.firstName ||
            split((trial as any)?.parentName).first;
          const parentLastName =
            (trial as any)?.parent?.lastName ||
            split((trial as any)?.parentName).last;
          const fullParentName =
            `${parentFirstName || ""}${
              parentFirstName && parentLastName ? " " : ""
            }${parentLastName || ""}`.trim() || "User";
          const phone =
            (trial as any)?.phone || (trial as any)?.parentPhone || "";
          const childFirstName =
            (trial as any)?.child?.firstName ||
            split((trial as any)?.childName).first;
          const childLastName =
            (trial as any)?.child?.lastName ||
            split((trial as any)?.childName).last;
          const childName = `${childFirstName || ""}${
            childFirstName && childLastName ? " " : ""
          }${childLastName || ""}`.trim();

          // Upsert user with nested parent/child to mirror trialBookings
          await db.collection("users").updateOne(
            { email },
            {
              $setOnInsert: { createdAt: new Date(), joinedFromTrial: true },
              $set: {
                phone,
                role: "member",
                membership:{
                  status: "active",
                  plan: "monthly",
                  joinedAt: new Date(),
                  classId: (trial as any)?.classId || null,
                }, "flags.memberWelcomePending": true,
                parent: {
                  firstName: parentFirstName,
                  lastName: parentLastName,
                },
                child: { firstName: childFirstName, lastName: childLastName },
                age:
                  Number((trial as any)?.childAge) ||
                  (trial as any)?.age ||
                  null,
                updatedAt: new Date(),
              },
              $unset: { "flags.reactivationPending": "" }, // ✅ CLEAR FLAG HERE
            },
            { upsert: true }
          );

          // Enrollment if classId exists (attach childId so UI can group by child)
          if ((trial as any)?.classId) {
            const userDoc = await db.collection("users").findOne({ email });
            if (userDoc) {
              let classObjectId: ObjectId | null = null;
              try {
                classObjectId = new ObjectId(String((trial as any)?.classId));
              } catch {}

              // Ensure a child document exists for this user; create from trial names if needed
              let childDoc = await db
                .collection("children")
                .findOne({ userId: (userDoc as any)._id });
              if (!childDoc) {
                const chFirst =
                  (trial as any)?.child?.firstName ||
                  split((trial as any)?.childName).first;
                const chLast =
                  (trial as any)?.child?.lastName ||
                  split((trial as any)?.childName).last;
                const ins = await db.collection("children").insertOne({
                  userId: (userDoc as any)._id,
                  firstName: chFirst || "",
                  lastName: chLast || "",
                  medical: (userDoc as any)?.medical || "",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
                childDoc = { _id: ins.insertedId } as any;
              }
              // If child exists but medical empty and user has medical, backfill
              else if (
                !(childDoc as any).medical &&
                (userDoc as any)?.medical
              ) {
                await db.collection("children").updateOne(
                  { _id: (childDoc as any)._id },
                  {
                    $set: {
                      medical: (userDoc as any).medical,
                      updatedAt: new Date(),
                    },
                  }
                );
              }

              if (classObjectId) {
                const enrollmentsCol = db.collection("enrollments");
                const existingEnroll = await enrollmentsCol.findOne({
                  userId: (userDoc as any)._id,
                  classId: classObjectId,
                });
                if (existingEnroll) {
                  // Heal legacy rows missing childId
                  if (!(existingEnroll as any).childId) {
                    await enrollmentsCol.updateOne(
                      { _id: (existingEnroll as any)._id },
                      { $set: { childId: (childDoc as any)._id } }
                    );
                  }
                } else {
                  await enrollmentsCol.insertOne({
                    userId: (userDoc as any)._id,
                    childId: (childDoc as any)._id,
                    classId: classObjectId,
                    status: "active",
                    attendedDates: [],
                    createdAt: new Date(),
                  });
                }
              }
            }
          }

          await db.collection("membershipHistory").insertOne({
            email,
            event: "converted",
            timestamp: new Date(),
            details: { source: "stripe_checkout", sessionId: session.id },
          });
        } else {
          // No trial found; activate membership
          await db.collection("users").updateOne(
            { email },
            {
              $set: {
                "membership.status": "active",
                "membership.joinedAt": new Date(), "flags.memberWelcomePending": true,
              },
              $unset: { "flags.reactivationPending": "" }, // ✅ CLEAR FLAG HERE TOO
            },
            { upsert: true }
          );

          await db.collection("membershipHistory").insertOne({
            email,
            event: "new_checkout_member",
            timestamp: new Date(),
          });
        }

        break;
      }

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
        // lightweight payments record
        try {
          const amountPounds = Math.round(
            Number(invoice.amount_paid || invoice.amount_due || 0) / 100
          );
          await db.collection("payments").insertOne({
            email,
            amount: amountPounds,
            currency: String(invoice.currency || "gbp").toUpperCase(),
            payment_status: "paid",
            payment_intent: (invoice as any).payment_intent || null,
            createdAt: new Date(),
          });
        } catch (e) {
          console.warn("[webhook] failed to write invoice payment record", e);
        }
        break;
      }

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



