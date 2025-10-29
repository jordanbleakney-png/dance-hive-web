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

    const { email, restoreEnrollments = false } = await req.json();
    if (!email)
      return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const db = await getDb();
    const archived: any = await db
      .collection("previousCustomers")
      .findOne({ email: String(email).toLowerCase() });
    if (!archived)
      return NextResponse.json(
        { error: "Archived record not found" },
        { status: 404 }
      );

    // Do not overwrite existing active user
    const existing = await db
      .collection("users")
      .findOne({ email: archived.email });
    if (existing) {
      await db.collection("previousCustomers").updateOne(
        { email: archived.email },
        {
          $set: { restoredAt: new Date(), restoredBy: session.user.email },
          $unset: { snapshot: "" },
        }
      );
      return NextResponse.json({ ok: true, note: "already_exists" });
    }

    // Recreate user as customer with reactivation pending so dashboard prompts checkout
    const userSnap = { ...(archived.snapshot?.user || {}) };
    delete (userSnap as any)._id;
    (userSnap as any).role = "customer";
    (userSnap as any).membership = { status: "none" };
    (userSnap as any).flags = {
      ...(userSnap as any).flags,
      reactivationPending: true,
    };
    (userSnap as any).updatedAt = new Date();
    (userSnap as any).createdAt = (userSnap as any).createdAt || new Date();

    const insUser = await db.collection("users").insertOne(userSnap);
    const newUserId = insUser.insertedId as ObjectId;

    // Recreate children; map old childId -> new childId
    const oldChildren: any[] = Array.isArray(archived.snapshot?.children)
      ? archived.snapshot.children
      : [];
    const childIdMap = new Map<string, ObjectId>();
    for (const ch of oldChildren) {
      const doc: any = { ...ch };
      const oldId = String(doc._id);
      delete doc._id;
      doc.userId = newUserId;
      doc.createdAt = doc.createdAt || new Date();
      doc.updatedAt = new Date();
      const ins = await db.collection("children").insertOne(doc);
      childIdMap.set(oldId, ins.insertedId as ObjectId);
    }

    // Optionally restore enrollments
    if (restoreEnrollments) {
      const oldEnrs: any[] = Array.isArray(archived.snapshot?.enrollments)
        ? archived.snapshot.enrollments
        : [];
      for (const e of oldEnrs) {
        const doc: any = { ...e };
        delete doc._id;
        doc.userId = newUserId;
        if (doc.childId) {
          const mapped = childIdMap.get(String(doc.childId));
          doc.childId = mapped || null;
        }
        doc.createdAt = doc.createdAt || new Date();
        await db.collection("enrollments").insertOne(doc);
      }
    }

    // Mark archive as restored (keep minimal record)
    await db.collection("previousCustomers").updateOne(
      { email: archived.email },
      {
        $set: { restoredAt: new Date(), restoredBy: session.user.email },
        $unset: { snapshot: "" },
      }
    );

    return NextResponse.json({ ok: true, userId: String(newUserId) });
  } catch (err) {
    console.error("[admin/users/restore] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
