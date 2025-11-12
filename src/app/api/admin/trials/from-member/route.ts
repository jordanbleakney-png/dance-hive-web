import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, childId, classId, trialDate } = await req.json();
    if (!userId || !childId || !classId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const db = await getDb();

    const uId = new ObjectId(String(userId));
    const cId = new ObjectId(String(childId));
    const clsId = new ObjectId(String(classId));

    const user = await db.collection("users").findOne({ _id: uId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const child = await db.collection("children").findOne({ _id: cId, userId: uId });
    if (!child) return NextResponse.json({ error: "Child not found for user" }, { status: 404 });
    const cls = await db.collection("classes").findOne({ _id: clsId });
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    // prevent booking a trial for a class the child is already enrolled in
    const existingEnroll = await db
      .collection("enrollments")
      .findOne({ userId: uId, childId: cId, classId: clsId, status: "active" });
    if (existingEnroll) {
      return NextResponse.json({ error: "Child is already enrolled in this class" }, { status: 409 });
    }

    // prevent duplicate pending trial for same child/class
    const dup = await db.collection("trialBookings").findOne({ childId: cId, classId: clsId, status: "pending" });
    if (dup) return NextResponse.json({ error: "Pending trial already exists for this child and class" }, { status: 409 });

    // prevent duplicate booking for the same child/class on the same date (aligns with unique index childId+classId+trialDate)
    if (trialDate) {
      const dupByDate = await db.collection("trialBookings").findOne({ childId: cId, classId: clsId, trialDate });
      if (dupByDate) {
        return NextResponse.json({ error: "A trial for this child, class and date already exists" }, { status: 409 });
      }
    }

    // derive age from child.dob when available
    const dobVal = (child as any)?.dob ? new Date((child as any).dob) : null;
    const now = new Date();
    let ageYears: number | null = null;
    if (dobVal && !isNaN(dobVal.getTime())) {
      let a = now.getFullYear() - dobVal.getFullYear();
      const m = now.getMonth() - dobVal.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dobVal.getDate())) a--;
      ageYears = a;
    }

    const doc: any = {
      isMemberTrial: (user as any).role === "member",
      existingUserId: uId,
      childId: cId,
      classId: clsId,
      trialDate: trialDate || null,
      status: "pending",
      origin: "admin",
      parent: (user as any).parent || null,
      child: { firstName: (child as any).firstName, lastName: (child as any).lastName, dob: (child as any).dob || null },
      childAge: ageYears,
      email: (user as any).email,
      phone: (user as any).phone || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const ins = await db.collection("trialBookings").insertOne(doc);
      return NextResponse.json({ trial: { ...doc, _id: ins.insertedId } }, { status: 200 });
    } catch (e: any) {
      if (e && e.code === 11000) {
        return NextResponse.json({ error: "A trial for this child, class and date already exists" }, { status: 409 });
      }
      throw e;
    }
  } catch (err) {
    console.error("[admin/trials/from-member] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
