import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

// POST /api/teacher/classes/[id]/convert-trial
// Body: { trialId: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.role || (session.user.role !== "teacher" && session.user.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { trialId } = await req.json();
    if (!trialId) return NextResponse.json({ error: "Missing trialId" }, { status: 400 });

    let classId: ObjectId;
    let tId: ObjectId;
    try {
      classId = new ObjectId(params.id);
      tId = new ObjectId(String(trialId));
    } catch {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = await getDb();
    const trial = await db.collection("trialBookings").findOne({ _id: tId });
    if (!trial) return NextResponse.json({ error: "Trial not found" }, { status: 404 });

    // Basic splitter for legacy combined names
    const split = (full?: string) => {
      if (!full || typeof full !== "string") return { first: "", last: "" };
      const parts = full.trim().split(/\s+/);
      if (parts.length === 1) return { first: parts[0], last: "" };
      return { first: parts[0], last: parts.slice(1).join(" ") };
    };

    const parentFirstName = (trial as any)?.parent?.firstName || split((trial as any)?.parentName).first;
    const parentLastName = (trial as any)?.parent?.lastName || split((trial as any)?.parentName).last;
    const childFirstName = (trial as any)?.child?.firstName || split((trial as any)?.childName).first;
    const childLastName = (trial as any)?.child?.lastName || split((trial as any)?.childName).last;
    const phone = (trial as any)?.phone || (trial as any)?.parentPhone || "";

    // Upsert user
    const email = String((trial as any)?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Trial missing email" }, { status: 400 });

    const user = await db.collection("users").findOne({ email });
    let userId: ObjectId;
    if (!user) {
      const hashedPassword = await bcrypt.hash("dancehive123", 10);
      const insert = await db.collection("users").insertOne({
        email,
        role: "customer",
        phone,
        parent: { firstName: parentFirstName, lastName: parentLastName },
        child: { firstName: childFirstName, lastName: childLastName },
        age: Number((trial as any)?.childAge) || null,
        membership: { status: "none", classId: (trial as any)?.classId || null },
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      userId = insert.insertedId as ObjectId;
    } else {
      userId = (user as any)._id as ObjectId;
      await db.collection("users").updateOne(
        { _id: userId },
        {
          $set: {
            role: (user as any)?.role || "customer",
            phone: (user as any)?.phone || phone,
            parent: (user as any)?.parent || { firstName: parentFirstName, lastName: parentLastName },
            child: (user as any)?.child || { firstName: childFirstName, lastName: childLastName },
            "membership.status": (user as any)?.membership?.status || "none",
            "membership.classId": (trial as any)?.classId || (user as any)?.membership?.classId || null,
            updatedAt: new Date(),
          },
        }
      );
    }

    // Update trial status
    await db.collection("trialBookings").updateOne(
      { _id: tId },
      { $set: { status: "converted", convertedAt: new Date(), updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[teacher/classes/:id/convert-trial] POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
