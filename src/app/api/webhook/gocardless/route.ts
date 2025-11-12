import { NextResponse } from "next/server";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";
import { wasProcessed } from "@/lib/idempotency";
import crypto from "crypto";

async function getEmailFromGcByLinks(links: any): Promise<string | null> {
  try {
    const base = process.env.GOCARDLESS_ENV === "live"
      ? "https://api.gocardless.com"
      : "https://api-sandbox.gocardless.com";
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN || ""}`,
      "GoCardless-Version": "2015-07-06",
    };
    // Prefer subscription metadata (we set email there at creation)
    if (links?.subscription) {
      const r = await fetch(`${base}/subscriptions/${links.subscription}`, { headers });
      if (r.ok) {
        const js = await r.json();
        const email = js?.subscriptions?.metadata?.email;
        if (email) return String(email).toLowerCase();
      }
    }
    // Try payment metadata if available
    if (links?.payment) {
      const r = await fetch(`${base}/payments/${links.payment}`, { headers });
      if (r.ok) {
        const js = await r.json();
        const email = js?.payments?.metadata?.email;
        if (email) return String(email).toLowerCase();
        // Chain via the payment's subscription if present
        const subId = js?.payments?.links?.subscription;
        if (subId) {
          const rs = await fetch(`${base}/subscriptions/${subId}`, { headers });
          if (rs.ok) {
            const sj = await rs.json();
            const email2 = sj?.subscriptions?.metadata?.email;
            if (email2) return String(email2).toLowerCase();
          }
        }
      }
    }
  } catch (e) {
    console.warn("[gc webhook] lookup email by links failed", e);
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get("Webhook-Signature");
  const rawBody = await req.text();
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET || "";

  if (!secret) {
    console.warn("[gc webhook] Missing GOCARDLESS_WEBHOOK_SECRET env. Returning 200 to avoid retries.");
    return new NextResponse("ok", { status: 200 });
  }
  if (!signature) {
    console.warn("[gc webhook] Missing Webhook-Signature header");
    return new NextResponse("ok", { status: 200 });
  }

  let payload: any;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");
    if (!signature.includes(expected)) {
      console.warn("[gc webhook] Signature mismatch");
      return new NextResponse("ok", { status: 200 });
    }
    payload = JSON.parse(rawBody || "{}");
  } catch (e) {
    console.error("[gc webhook] parse/verify error", e);
    return new NextResponse("ok", { status: 200 });
  }
  const events: any[] = Array.isArray(payload?.events) ? payload.events : [];
  const db = await getDb();

  // Helper: auto-enroll a child into the class from the most recent converted trial
  async function autoEnrollFromLatestConvertedTrial(email: string) {
    try {
      const user = await db.collection("users").findOne({ email });
      if (!user) return;

      // Find latest converted trial for this email
      const trial = await db.collection("trialBookings").findOne(
        {
          email,
          $or: [
            { status: "converted" },
            // legacy flag used in some older flows
            { convertedToMember: true },
          ],
        },
        { sort: { updatedAt: -1, createdAt: -1 } as any }
      );
      let classId: ObjectId | null = null;
      if (trial?.classId) {
        classId = new ObjectId(String(trial.classId));
      } else {
        // Fallback for restored users (trial archived): use previousCustomers snapshot
        try {
          const prev = await db.collection("previousCustomers").findOne({ email });
          const snap = (prev as any)?.snapshot?.enrollments || [];
          if (Array.isArray(snap) && snap.length > 0) {
            const firstActive = snap.find((e: any) => (e?.status || "active") === "active") || snap[0];
            if (firstActive?.classId) classId = new ObjectId(String(firstActive.classId));
          }
        } catch {}
        if (!classId) return;
      }

      // Determine child to enroll (prefer trial child names)
      const split = (full?: string) => {
        if (!full || typeof full !== "string") return { first: "", last: "" };
        const parts = full.trim().split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: "" };
        return { first: parts[0], last: parts.slice(1).join(" ") };
      };
      const childFirstName = (trial as any)?.child?.firstName || split((trial as any)?.childName).first;
      const childLastName = (trial as any)?.child?.lastName || split((trial as any)?.childName).last;

      let child = null as any;
      if (childFirstName) {
        child = await db
          .collection("children")
          .findOne({ userId: (user as any)._id, firstName: childFirstName, lastName: childLastName });
      }
      if (!child && (user as any).primaryChildId) {
        child = await db.collection("children").findOne({ _id: new ObjectId(String((user as any).primaryChildId)) });
      }
      if (!child) {
        // Create a child doc as a fallback using whatever we have
        const ins = await db.collection("children").insertOne({
          userId: (user as any)._id,
          firstName: childFirstName || "",
          lastName: childLastName || "",
          dob: null,
          medical: (user as any)?.medical || "",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        child = { _id: ins.insertedId } as any;
        // backfill primaryChildId if missing
        await db
          .collection("users")
          .updateOne({ _id: (user as any)._id, primaryChildId: { $exists: false } }, { $set: { primaryChildId: child._id } });
      }

      // Optional capacity guard similar to admin enroll API
      const cls = await db.collection("classes").findOne({ _id: classId });
      if (!cls) return;
      const cap = Number((cls as any).capacity || 0);
      if (cap > 0) {
        const enrolledCount = await db
          .collection("enrollments")
          .countDocuments({ classId, status: "active" });
        if (enrolledCount >= cap) {
          try { console.warn("[gc webhook] auto-enroll skipped: class full", { email, classId: String(classId) }); } catch {}
          return;
        }
      }

      // Upsert enrollment (unique on userId+childId+classId)
      const payload = {
        userId: (user as any)._id,
        childId: (child as any)._id,
        classId,
        status: "active",
        attendedDates: [] as any[],
        createdAt: new Date(),
      };
      await db.collection("enrollments").updateOne(
        { userId: payload.userId, childId: payload.childId, classId: payload.classId },
        { $setOnInsert: payload },
        { upsert: true }
      );

      // Record history (best-effort)
      try {
        await db.collection("membershipHistory").insertOne({
          email,
          event: "auto_enrolled",
          classId,
          childId: (child as any)._id,
          provider: "GoCardless",
          timestamp: new Date(),
        });
      } catch {}

      try { console.log("[gc webhook] auto-enrolled child", { email, classId: String(classId) }); } catch {}

      // Mark the converted trial we used as processed so we don't enroll it again
      try {
        await db.collection("trialBookings").updateOne(
          { _id: (trial as any)._id },
          { $set: { enrolledFromWebhookAt: new Date() } }
        );
      } catch {}

      // Enroll any other converted trials for this email that haven't been processed yet
      try {
        const others = await db
          .collection("trialBookings")
          .find({
            email,
            $or: [{ status: "converted" }, { convertedToMember: true }],
            classId: { $ne: classId },
            $or_2: [{ enrolledFromWebhookAt: { $exists: false } }, { enrolledFromWebhookAt: null }],
          } as any)
          .toArray();

        for (const ot of others) {
          let otherClassId: ObjectId | null = null;
          try { otherClassId = new ObjectId(String((ot as any).classId)); } catch { otherClassId = null; }
          if (!otherClassId) continue;

          const split = (full?: string) => {
            if (!full || typeof full !== "string") return { first: "", last: "" };
            const parts = full.trim().split(/\s+/);
            if (parts.length === 1) return { first: parts[0], last: "" };
            return { first: parts[0], last: parts.slice(1).join(" ") };
          };
          const childFirstName2 = (ot as any)?.child?.firstName || split((ot as any)?.childName).first;
          const childLastName2 = (ot as any)?.child?.lastName || split((ot as any)?.childName).last;

          let child2 = null as any;
          if (childFirstName2) {
            child2 = await db
              .collection("children")
              .findOne({ userId: (user as any)._id, firstName: childFirstName2, lastName: childLastName2 });
          }
          if (!child2 && (user as any).primaryChildId) {
            child2 = await db.collection("children").findOne({ _id: new ObjectId(String((user as any).primaryChildId)) });
          }
          if (!child2) {
            const ins2 = await db.collection("children").insertOne({
              userId: (user as any)._id,
              firstName: childFirstName2 || "",
              lastName: childLastName2 || "",
              dob: null,
              medical: (user as any)?.medical || "",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            child2 = { _id: ins2.insertedId } as any;
          }

          // Capacity guard
          const cls2 = await db.collection("classes").findOne({ _id: otherClassId });
          if (cls2) {
            const cap2 = Number((cls2 as any).capacity || 0);
            if (cap2 > 0) {
              const enrolledCount2 = await db
                .collection("enrollments")
                .countDocuments({ classId: otherClassId, status: "active" });
              if (enrolledCount2 >= cap2) continue;
            }
          }

          await db.collection("enrollments").updateOne(
            { userId: (user as any)._id, childId: (child2 as any)._id, classId: otherClassId },
            { $setOnInsert: { userId: (user as any)._id, childId: (child2 as any)._id, classId: otherClassId, status: "active", attendedDates: [], createdAt: new Date() } },
            { upsert: true }
          );

          try {
            await db.collection("membershipHistory").insertOne({
              email,
              event: "auto_enrolled",
              classId: otherClassId,
              childId: (child2 as any)._id,
              provider: "GoCardless",
              timestamp: new Date(),
            });
          } catch {}

          try {
            await db.collection("trialBookings").updateOne(
              { _id: (ot as any)._id },
              { $set: { enrolledFromWebhookAt: new Date() } }
            );
          } catch {}
        }
      } catch {}
    } catch (e) {
      console.warn("[gc webhook] auto-enroll failed", e);
    }
  }

  for (const event of events) {
    const id = String(event.id || "");
    if (!id) continue;
    if (await wasProcessed(id)) continue; // idempotency

    const type = `${event.resource_type}.${event.action}`; // e.g., payments.confirmed
    const links = event.links || {};
    try { console.log("[gc webhook] event", type, { links, metadata: event.metadata || null }); } catch {}

    try {
      switch (type) {
        case "payments.confirmed": {
          const paymentId = String(links.payment || event.details?.origin || "").trim();
          let amountPence = 0;
          let currency = "GBP";
          let paymentMeta: any = null;

          // If the subscription was created with metadata.email, use that first
          let email = String(event.metadata?.email || "").toLowerCase();

          // Try to enrich from the Payments API
          try {
            const base = process.env.GOCARDLESS_ENV === "live" ? "https://api.gocardless.com" : "https://api-sandbox.gocardless.com";
            const headers: Record<string, string> = {
              Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN || ""}`,
              "GoCardless-Version": "2015-07-06",
            };
            if (paymentId) {
              const pr = await fetch(`${base}/payments/${paymentId}`, { headers });
              if (pr.ok) {
                const pj = await pr.json();
                amountPence = Number(pj?.payments?.amount || 0);
                currency = String(pj?.payments?.currency || "GBP").toUpperCase();
                paymentMeta = pj?.payments?.metadata || null;
                if (!email) {
                  email = String(pj?.payments?.metadata?.email || "").toLowerCase();
                }
                // If still no email, follow the subscription link
                if (!email) {
                  const subId = pj?.payments?.links?.subscription;
                  if (subId) {
                    const rs = await fetch(`${base}/subscriptions/${subId}`, { headers });
                    if (rs.ok) {
                      const sj = await rs.json();
                      email = String(sj?.subscriptions?.metadata?.email || "").toLowerCase();
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn("[gc webhook] payments.confirmed enrichment failed", e);
          }

          // As a final fallback, try generic link-based email lookup
          if (!email) {
            email = (await getEmailFromGcByLinks(links)) || "";
          }
          // Try to backfill email from our seeded pending payment if enrichment failed
          try {
            if (!email && paymentId) {
              const seeded = await db.collection("payments").findOne({ payment_id: paymentId });
              if (seeded?.email) email = String(seeded.email).toLowerCase();
            }
          } catch {}

          try { console.log("[gc webhook] payments.confirmed resolvedEmail=", email || "<none>"); } catch {}

          const now = new Date();

          // Update user membership only if we resolved an email
          if (email) {
            try {
              const res = await db.collection("users").updateOne(
                { email },
                { $set: { role: "member", "membership.status": "active", "membership.lastPaymentDate": now, "flags.memberWelcomePending": true, updatedAt: now } }
              );
              try { console.log("[gc webhook] payment confirmed -> member", { email, matched: res.matchedCount, modified: res.modifiedCount }); } catch {}
            } catch {}
            // Also mark any previousCustomers snapshot as restored so it no longer appears in the list
            try {
              await db.collection("previousCustomers").updateOne(
                { email },
                { $set: { restoredAt: now, restoredBy: "system:webhook" } }
              );
            } catch {}
          }

          // Upsert the seeded pending payment (match by payment_id if available)
          try {
            const payments = db.collection("payments");
            const docSet: any = {
              amount: amountPence ? parseFloat(String((amountPence / 100).toFixed(2))) : null,
              currency,
              provider: "GoCardless",
              status: "confirmed",
              payment_status: "confirmed",
              paidAt: now,
              updatedAt: now,
            };
            if (email) docSet.email = email;
            if (paymentMeta) docSet.metadata = paymentMeta;

            if (paymentId) {
              await payments.updateOne(
                { payment_id: paymentId },
                { $set: docSet, $setOnInsert: { createdAt: now, payment_id: paymentId } },
                { upsert: true }
              );
            } else {
              // Fallback: create a new record if no payment_id link is present
              await payments.insertOne({
                ...docSet,
                createdAt: now,
                payment_id: null,
              });
            }
          } catch {}
          break;
        }
        case "payments.failed": {
          const paymentId = String(links.payment || event.details?.origin || "").trim();
          let email = String(event.metadata?.email || "").toLowerCase();
          let amountPence = 0;
          let currency = "GBP";
          let paymentMeta: any = null;

          // Enrich from GoCardless Payments API if possible
          try {
            const base = process.env.GOCARDLESS_ENV === "live" ? "https://api.gocardless.com" : "https://api-sandbox.gocardless.com";
            const headers: Record<string, string> = {
              Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN || ""}`,
              "GoCardless-Version": "2015-07-06",
            };
            if (paymentId) {
              const pr = await fetch(`${base}/payments/${paymentId}`, { headers });
              if (pr.ok) {
                const pj = await pr.json();
                amountPence = Number(pj?.payments?.amount || 0);
                currency = String(pj?.payments?.currency || "GBP").toUpperCase();
                paymentMeta = pj?.payments?.metadata || null;
                if (!email) email = String(pj?.payments?.metadata?.email || "").toLowerCase();
                if (!email) {
                  const subId = pj?.payments?.links?.subscription;
                  if (subId) {
                    const rs = await fetch(`${base}/subscriptions/${subId}`, { headers });
                    if (rs.ok) {
                      const sj = await rs.json();
                      email = String(sj?.subscriptions?.metadata?.email || "").toLowerCase();
                    }
                  }
                }
              }
            }
          } catch {}

          // Fallbacks: generic lookup or seeded pending row
          if (!email) email = (await getEmailFromGcByLinks(links)) || "";
          try {
            if (!email && paymentId) {
              const seeded = await db.collection("payments").findOne({ payment_id: paymentId });
              if (seeded?.email) email = String(seeded.email).toLowerCase();
            }
          } catch {}

          const now = new Date();
          try { console.log("[gc webhook] payments.failed resolvedEmail=", email || "<none>"); } catch {}

          // Membership back to pending (only if we know the user)
          if (email) {
            try {
              await db.collection("users").updateOne(
                { email },
                { $set: { "membership.status": "pending", updatedAt: now } }
              );
            } catch {}
          }

          // Upsert payment row to failed using payment_id when available
          try {
            const payments = db.collection("payments");
            const docSet: any = {
              status: "failed",
              payment_status: "failed",
              updatedAt: now,
            };
            if (email) docSet.email = email;
            if (currency) docSet.currency = currency;
            if (amountPence) docSet.amount = parseFloat(String((amountPence / 100).toFixed(2)));
            if (paymentMeta) docSet.metadata = paymentMeta;

            if (paymentId) {
              await payments.updateOne(
                { payment_id: paymentId },
                { $set: docSet, $setOnInsert: { createdAt: now, provider: "GoCardless", payment_id: paymentId } },
                { upsert: true }
              );
            } else {
              await payments.insertOne({
                email: email || null,
                amount: amountPence ? parseFloat(String((amountPence / 100).toFixed(2))) : null,
                currency,
                provider: "GoCardless",
                status: "failed",
                payment_status: "failed",
                createdAt: now,
                updatedAt: now,
                payment_id: null,
                metadata: paymentMeta || undefined,
              });
            }
          } catch {}
          break;
        }
        case "subscriptions.activated":
        case "subscriptions.created": {
          let email = String(event.metadata?.email || "").toLowerCase();
          if (!email) email = (await getEmailFromGcByLinks(links)) || "";
          try { console.log("[gc webhook] subscriptions.active/create resolvedEmail=", email); } catch {}
          if (email) {
            const res = await db.collection("users").updateOne(
              { email },
              {
                $set: {
                  role: "member",
                  "membership.status": "active",
                  "membership.gocardless_subscription_id": links?.subscription || null,
                  updatedAt: new Date(),
                  "flags.memberWelcomePending": true,
                },
              }
            );
            try { console.log("[gc webhook] subs.* -> member", { email, matched: res.matchedCount, modified: res.modifiedCount }); } catch {}

            // Best-effort auto-enroll the child into the class from the latest converted trial
            await autoEnrollFromLatestConvertedTrial(email);

            // Ensure previousCustomers snapshot is marked restored
            try {
              await db.collection("previousCustomers").updateOne(
                { email },
                { $set: { restoredAt: new Date(), restoredBy: "system:webhook" } }
              );
            } catch {}
          }
          break;
        }
        case "subscriptions.cancelled": {
          let email = String(event.metadata?.email || "").toLowerCase();
          if (!email) email = (await getEmailFromGcByLinks(links)) || "";
          try { console.log("[gc webhook] subscriptions.cancelled resolvedEmail=", email); } catch {}
          if (email) {
            await db.collection("users").updateOne(
              { email },
              { $set: { "membership.status": "none", updatedAt: new Date() } }
            );
          }
          break;
        }
        default:
          // no-op; you can extend handling as needed
          break;
      }
    } catch (e) {
      console.error("[gc webhook] handler error", e);
    }
  }

  return new NextResponse("ok", { status: 200 });
}
