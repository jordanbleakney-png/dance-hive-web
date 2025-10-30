import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

// PATCH /api/admin/trials/update-trial-date
// Body: { id: string, trialDate: 'YYYY-MM-DD' }
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, trialDate } = await req.json();
    if (!id || !trialDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(trialDate))) {
      return NextResponse.json({ error: "Missing or invalid id/trialDate" }, { status: 400 });
    }

    if (!ObjectId.isValid(String(id))) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = await getDb();
    const _id = new ObjectId(String(id));
    const trial = await db.collection("trialBookings").findOne({ _id });
    if (!trial) return NextResponse.json({ error: "Trial not found" }, { status: 404 });

    const classId = (trial as any)?.classId;
    if (!classId || !ObjectId.isValid(String(classId))) {
      return NextResponse.json({ error: "Trial missing classId" }, { status: 400 });
    }

    const cls = await db.collection("classes").findOne({ _id: new ObjectId(String(classId)) });
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    // Validate date matches class weekday and within 28 days in the future
    const weekday = String((cls as any).day || "");
    const dayToIndex: Record<string, number> = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
    const d = new Date(String(trialDate));
    d.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    const max = new Date(today); max.setDate(max.getDate() + 28);
    if (isNaN(d.getTime()) || d < today || d > max) {
      return NextResponse.json({ error: "Selected date is out of range" }, { status: 400 });
    }
    if (weekday && d.getDay() !== dayToIndex[weekday]) {
      return NextResponse.json({ error: "Selected date does not match class day" }, { status: 400 });
    }

    await db.collection("trialBookings").updateOne({ _id }, { $set: { trialDate, updatedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/trials:update-trial-date] Error:", err);
    return NextResponse.json({ error: "Failed to update trial date" }, { status: 500 });
  }
}

