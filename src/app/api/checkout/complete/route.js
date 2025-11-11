import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";
import crypto from "crypto";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const { redirect_flow_id } = await req.json();
    if (!redirect_flow_id) {
      return new Response(JSON.stringify({ error: "Missing redirect_flow_id" }), { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ email: session.user.email });
    const sessionToken = user?.membership?.gc_session_token;
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Missing session token" }), { status: 400 });
    }

    const base = process.env.GOCARDLESS_ENV === "live"
      ? "https://api.gocardless.com"
      : "https://api-sandbox.gocardless.com";

    // Complete redirect flow to exchange for customer + mandate
    const completeResp = await fetch(`${base}/redirect_flows/${redirect_flow_id}/actions/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        "GoCardless-Version": "2015-07-06",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ data: { session_token: sessionToken } }),
    });
    if (!completeResp.ok) {
      const t = await completeResp.text();
      throw new Error(`GoCardless complete failed: ${t}`);
    }
    const completed = await completeResp.json();
    const mandateId = completed?.redirect_flows?.links?.mandate;

    if (!mandateId) {
      throw new Error("Mandate not returned by GoCardless");
    }

    // Compute amount in pence; basic default £30
    const userId = user?._id;
    let enrollmentCount = 0;
    try {
      enrollmentCount = await db.collection("enrollments").countDocuments({ userId });
    } catch {}
    const priceFor = (n) => {
      if (!n || n <= 1) return 3000; // £30
      if (n === 2) return 5500;      // £55
      if (n >= 3) return 7500;       // £75 cap
      return 3000;
    };
    const amount = String(priceFor(enrollmentCount));

    // Create a monthly subscription scheduled for the first working day each month
    // GoCardless will automatically move collections that fall on weekends/bank holidays
    // to the next working day. We request the 1st of next month and day_of_month=1.
    const now = new Date();
    const firstOfNextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );
    const toYyyyMmDd = (d) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

    // Use a stable idempotency key so accidental retries don't create multiple subscriptions
    const stableKey = `sub_create:${String(userId)}:${redirect_flow_id}`;
    const createSub = await fetch(`${base}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        "GoCardless-Version": "2015-07-06",
        "Content-Type": "application/json",
        "Idempotency-Key": stableKey,
      },
      body: JSON.stringify({
        subscriptions: {
          amount,
          currency: process.env.GOCARDLESS_CURRENCY || "GBP",
          interval: 1,
          interval_unit: "monthly",
          day_of_month: 1,
          start_date: toYyyyMmDd(firstOfNextMonth),
          retry_if_possible: true,
          links: { mandate: mandateId },
          metadata: { email: session.user.email },
        },
      }),
    });
    if (!createSub.ok) {
      const t = await createSub.text();
      throw new Error(`GoCardless subscription create failed: ${t}`);
    }
    const sub = await createSub.json();
    const subscription = sub?.subscriptions || {};
    const subscriptionId = subscription?.id || null;
    const subStatus = String(subscription?.status || "");
    // Sanity check: ensure GC returned an ID and a plausible status
    const okStatuses = new Set(["active", "pending_submission", "customer_approval_granted", "customer_approval_denied", "paused"]);
    if (!subscriptionId || (!okStatuses.has(subStatus) && subStatus)) {
      console.warn("[checkout/complete] Unexpected subscription response", { subscriptionId, subStatus });
    }

    // === Pro‑rata one‑off payment (per‑class model) ===
    // Compute number of classes left this month for the converted trial, then
    // charge perClass (monthly/4) * classesLeft as a one‑off payment.
    try {
      const trialForEmail = await db.collection("trialBookings").findOne(
        { email: session.user.email, status: "converted" },
        { sort: { updatedAt: -1, createdAt: -1 } }
      );
      if (trialForEmail && trialForEmail.classId) {
        const classId = new ObjectId(String(trialForEmail.classId));
        const cls = await db.collection("classes").findOne({ _id: classId });
        if (cls) {
          // Map weekday (e.g., 'Monday') to index
          const dayToIndex = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
          const weekday = dayToIndex[String(cls.day || "")] ?? null;
          if (weekday !== null) {
            const today = new Date();
            const utcY = today.getUTCFullYear();
            const utcM = today.getUTCMonth();
            const start = new Date(Date.UTC(utcY, utcM, today.getUTCDate()));
            const end = new Date(Date.UTC(utcY, utcM + 1, 0)); // last day of month

            // Find next occurrence on/after today for this weekday
            const startDow = start.getUTCDay();
            let delta = weekday - startDow;
            if (delta < 0) delta += 7;
            const firstOcc = new Date(start);
            firstOcc.setUTCDate(start.getUTCDate() + delta);

            // Count occurrences until end of month (inclusive)
            let classesLeft = 0;
            for (let d = new Date(firstOcc); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
              if (d < start) continue;
              classesLeft++;
            }

            if (classesLeft > 0) {
              const monthlyPence = parseInt(amount, 10);
              const perClass = Math.ceil(monthlyPence / 4);
              let prorataPence = perClass * classesLeft;
              if (prorataPence > monthlyPence) prorataPence = monthlyPence; // cap

              if (prorataPence > 0) {
                const monthTag = `${utcY}-${String(utcM + 1).padStart(2, '0')}`;
                const idemp = `prorata:${String(userId)}:${monthTag}`;
                try {
                  const payResp = await fetch(`${base}/payments`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
                      "GoCardless-Version": "2015-07-06",
                      "Content-Type": "application/json",
                      // Include redirect_flow_id so a same-month reactivation after restore
                      // does not get deduped by a previous prorata attempt.
                      "Idempotency-Key": `${idemp}:${redirect_flow_id}`,
                    },
                    body: JSON.stringify({
                      payments: {
                        amount: String(prorataPence),
                        currency: process.env.GOCARDLESS_CURRENCY || "GBP",
                        links: { mandate: mandateId },
                        // No custom reference (disabled on many sandbox SIs)
                        // GoCardless allows max 3 metadata keys
                        metadata: { email: session.user.email, reason: "prorata", month: monthTag },
                      },
                    }),
                  });
                  if (!payResp.ok) {
                    const txt = await payResp.text();
                    console.warn("[checkout/complete] Pro‑rata payment create failed:", txt);
                  } else {
                    let createdPaymentId = null;
                    try {
                      const pj = await payResp.json();
                      createdPaymentId = pj?.payments?.id || null;
                    } catch {}
                    // Optional: seed a pending payment entry; webhook will confirm later
                    try {
                      await db.collection("payments").insertOne({
                        email: session.user.email,
                        amount: parseFloat(String((prorataPence / 100).toFixed(2))),
                        currency: process.env.GOCARDLESS_CURRENCY || "GBP",
                        provider: "GoCardless",
                        payment_id: createdPaymentId,
                        status: "pending_submission",
                        createdAt: new Date(),
                        metadata: { reason: "prorata", month: monthTag },
                      });
                    } catch {}
                    try {
                      await db.collection("membershipHistory").insertOne({
                        email: session.user.email,
                        event: "prorata_issued",
                        amount: parseFloat(String((prorataPence / 100).toFixed(2))),
                        month: monthTag,
                        provider: "GoCardless",
                        timestamp: new Date(),
                      });
                    } catch {}
                  }
                } catch (e) {
                  console.warn("[checkout/complete] Pro‑rata payment error", e);
                }
              }
            }
          }
        }
      } else {
        // Fallback for restored customers (no converted trial available):
        // use the previousCustomers snapshot to infer their class.
        const prev = await db
          .collection("previousCustomers")
          .findOne({ email: session.user.email.toLowerCase() });
        const snapEnroll = prev?.snapshot?.enrollments || [];
        const firstActive = Array.isArray(snapEnroll)
          ? (snapEnroll.find((e) => (e?.status || "active") === "active") || snapEnroll[0])
          : null;
        if (firstActive?.classId) {
          const classId = new ObjectId(String(firstActive.classId));
          const cls = await db.collection("classes").findOne({ _id: classId });
          if (cls) {
            const dayToIndex = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
            const weekday = dayToIndex[String(cls.day || "")] ?? null;
            if (weekday !== null) {
              const today = new Date();
              const utcY = today.getUTCFullYear();
              const utcM = today.getUTCMonth();
              const start = new Date(Date.UTC(utcY, utcM, today.getUTCDate()));
              const end = new Date(Date.UTC(utcY, utcM + 1, 0));
              const startDow = start.getUTCDay();
              let delta = weekday - startDow;
              if (delta < 0) delta += 7;
              const firstOcc = new Date(start);
              firstOcc.setUTCDate(start.getUTCDate() + delta);
              let classesLeft = 0;
              for (let d = new Date(firstOcc); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
                if (d < start) continue;
                classesLeft++;
              }
              if (classesLeft > 0) {
                const monthlyPence = parseInt(amount, 10);
                const perClass = Math.ceil(monthlyPence / 4);
                let prorataPence = perClass * classesLeft;
                if (prorataPence > monthlyPence) prorataPence = monthlyPence;
                if (prorataPence > 0) {
                  const monthTag = `${utcY}-${String(utcM + 1).padStart(2, '0')}`;
                  const idemp = `prorata:${String(userId)}:${monthTag}`;
                  try {
                    const payResp = await fetch(`${base}/payments`, {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
                        "GoCardless-Version": "2015-07-06",
                        "Content-Type": "application/json",
                        "Idempotency-Key": `${idemp}:${redirect_flow_id}`,
                      },
                      body: JSON.stringify({
                        payments: {
                          amount: String(prorataPence),
                          currency: process.env.GOCARDLESS_CURRENCY || "GBP",
                          links: { mandate: mandateId },
                          metadata: { email: session.user.email, reason: "prorata", month: monthTag },
                        },
                      }),
                    });
                    if (!payResp.ok) {
                      const txt = await payResp.text();
                      console.warn("[checkout/complete] Pro‑rata payment create failed:", txt);
                    } else {
                      let createdPaymentId = null;
                      try {
                        const pj = await payResp.json();
                        createdPaymentId = pj?.payments?.id || null;
                      } catch {}
                      try {
                        await db.collection("payments").insertOne({
                          email: session.user.email,
                          amount: parseFloat(String((prorataPence / 100).toFixed(2))),
                          currency: process.env.GOCARDLESS_CURRENCY || "GBP",
                          provider: "GoCardless",
                          payment_id: createdPaymentId,
                          status: "pending_submission",
                          createdAt: new Date(),
                          metadata: { reason: "prorata", month: monthTag },
                        });
                      } catch {}
                      try {
                        await db.collection("membershipHistory").insertOne({
                          email: session.user.email,
                          event: "prorata_issued",
                          amount: parseFloat(String((prorataPence / 100).toFixed(2))),
                          month: monthTag,
                          provider: "GoCardless",
                          timestamp: new Date(),
                        });
                      } catch {}
                    }
                  } catch (e) {
                    console.warn("[checkout/complete] Pro‑rata payment error", e);
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[checkout/complete] Pro‑rata calculation skipped", e);
    }

    // Helper: auto-enroll from most recent converted trial for this user
    const autoEnroll = async (email) => {
      try {
        const user = await db.collection("users").findOne({ email });
        if (!user) return;
        const trial = await db.collection("trialBookings").findOne(
          { email, status: "converted" },
          { sort: { updatedAt: -1, createdAt: -1 } }
        );
        if (!trial || !trial.classId) return;

        const classId = new ObjectId(String(trial.classId));
        const split = (full) => {
          if (!full || typeof full !== "string") return { first: "", last: "" };
          const parts = full.trim().split(/\s+/);
          if (parts.length === 1) return { first: parts[0], last: "" };
          return { first: parts[0], last: parts.slice(1).join(" ") };
        };
        const childFirstName = trial?.child?.firstName || split(trial?.childName).first;
        const childLastName = trial?.child?.lastName || split(trial?.childName).last;

        let child = null;
        if (childFirstName) {
          child = await db
            .collection("children")
            .findOne({ userId: user._id, firstName: childFirstName, lastName: childLastName });
        }
        if (!child && user.primaryChildId) {
          child = await db.collection("children").findOne({ _id: new ObjectId(String(user.primaryChildId)) });
        }
        if (!child) {
          const ins = await db.collection("children").insertOne({
            userId: user._id,
            firstName: childFirstName || "",
            lastName: childLastName || "",
            dob: null,
            medical: user?.medical || "",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          child = { _id: ins.insertedId };
          await db
            .collection("users")
            .updateOne({ _id: user._id, primaryChildId: { $exists: false } }, { $set: { primaryChildId: child._id } });
        }

        const cls = await db.collection("classes").findOne({ _id: classId });
        if (!cls) return;
        const cap = Number(cls.capacity || 0);
        if (cap > 0) {
          const enrolled = await db.collection("enrollments").countDocuments({ classId, status: "active" });
          if (enrolled >= cap) return;
        }
        const payload = {
          userId: user._id,
          childId: child._id,
          classId,
          status: "active",
          attendedDates: [],
          createdAt: new Date(),
        };
        await db.collection("enrollments").updateOne(
          { userId: payload.userId, childId: payload.childId, classId: payload.classId },
          { $setOnInsert: payload },
          { upsert: true }
        );
        try {
          await db.collection("membershipHistory").insertOne({
            email,
            event: "auto_enrolled",
            classId,
            childId: child._id,
            provider: "GoCardless",
            timestamp: new Date(),
          });
        } catch {}
      } catch {}
    };

    // Store GC identifiers and activate membership immediately (webhook remains as safety net)
    await db.collection("users").updateOne(
      { email: session.user.email },
      {
        $set: {
          role: "member",
          "membership.status": "active",
          "membership.gocardless_mandate_id": mandateId,
          "membership.gocardless_subscription_id": subscriptionId,
          "membership.gc_session_token": null,
          "flags.memberWelcomePending": true,
          updatedAt: new Date(),
        },
      }
    );

    // Record membership activation and attempt auto-enroll
    try {
      await db.collection("membershipHistory").insertOne({
        email: session.user.email,
        event: "membership_activated",
        provider: "GoCardless",
        timestamp: new Date(),
      });
    } catch {}
    await autoEnroll(session.user.email);

    return new Response(JSON.stringify({ success: true, subscriptionId }), { status: 200 });
  } catch (error) {
    console.error("[checkout/complete] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
  }
}

