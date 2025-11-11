import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, email, reason = "" } = await req.json();
    if (!id && !email) {
      return NextResponse.json({ error: "Provide id or email" }, { status: 400 });
    }
    const db = await getDb();

    // Find user
    let user: any = null;
    if (id) {
      let _id: ObjectId;
      try { _id = new ObjectId(String(id)); } catch { return NextResponse.json({ error: "Invalid id" }, { status: 400 }); }
      user = await db.collection("users").findOne({ _id });
    } else if (email) {
      user = await db.collection("users").findOne({ email: String(email).toLowerCase() });
    }
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userId = user._id as ObjectId;

    // Gather related docs
    const [children, enrollments] = await Promise.all([
      db.collection("children").find({ userId }).toArray(),
      db.collection("enrollments").find({ userId }).toArray(),
    ]);

    // Best-effort: cancel GoCardless subscription/mandate before removal
    let gcCancel: any = { subscription: null, mandate: null };
    try {
      const subId = user?.membership?.gocardless_subscription_id;
      const mandateId = user?.membership?.gocardless_mandate_id;
      const token = process.env.GOCARDLESS_ACCESS_TOKEN || "";
      if (token && (subId || mandateId)) {
        const base = process.env.GOCARDLESS_ENV === "live"
          ? "https://api.gocardless.com"
          : "https://api-sandbox.gocardless.com";
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "GoCardless-Version": "2015-07-06",
          "Content-Type": "application/json",
        };
        if (subId) {
          try {
            const r = await fetch(`${base}/subscriptions/${subId}/actions/cancel`, {
              method: "POST",
              headers: { ...headers, "Idempotency-Key": `admin-archive-cancel-sub:${String(userId)}` },
              body: JSON.stringify({}),
            });
            gcCancel.subscription = r.status;
          } catch (e) {
            gcCancel.subscription = "error";
          }
        }
        if (mandateId) {
          try {
            const r = await fetch(`${base}/mandates/${mandateId}/actions/cancel`, {
              method: "POST",
              headers: { ...headers, "Idempotency-Key": `admin-archive-cancel-mandate:${String(userId)}` },
              body: JSON.stringify({}),
            });
            gcCancel.mandate = r.status;
          } catch (e) {
            gcCancel.mandate = "error";
          }
        }
      }
    } catch {}

    // Write snapshot to previousCustomers (upsert by email)
    const archiveDoc: any = {
      email: String(user.email || "").toLowerCase(),
      archivedAt: new Date(),
      archivedBy: session.user.email || "admin",
      reason: String(reason || ""),
      snapshot: {
        user,
        children,
        enrollments,
      },
      gcCancellation: gcCancel,
    };

    await db.collection("previousCustomers").updateOne(
      { email: archiveDoc.email },
      { $set: archiveDoc, $unset: { restoredAt: "", restoredBy: "" } },
      { upsert: true }
    );

    // Remove active docs
    const delEnroll = await db.collection("enrollments").deleteMany({ userId });
    const delChildren = await db.collection("children").deleteMany({ userId });
    const delUser = await db.collection("users").deleteOne({ _id: userId });

    // Mark any trial bookings for this email as archived so they don't surface in admin/trials or teacher registers
    try {
      await db.collection("trialBookings").updateMany(
        { email: archiveDoc.email },
        { $set: { status: "archived", archivedAt: new Date() } }
      );
    } catch {}

    return NextResponse.json({
      ok: true,
      removed: {
        enrollments: delEnroll.deletedCount,
        children: delChildren.deletedCount,
        users: delUser.deletedCount,
      },
      gcCancellation: gcCancel,
    });
  } catch (err) {
    console.error("[admin/users/archive] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
