import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

// POST /api/teacher/classes/[id]/attendance
// Body: { userId: string, date?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.role || (session.user.role !== "teacher" && session.user.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, date } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    let classId: ObjectId;
    let uId: ObjectId;
    try {
      classId = new ObjectId(params.id);
      uId = new ObjectId(String(userId));
    } catch {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const when = date ? new Date(date) : new Date();
    const ymd = new Date(when.getFullYear(), when.getMonth(), when.getDate());

    const db = await getDb();
    await db.collection("enrollments").updateOne(
      { userId: uId, classId },
      { $addToSet: { attendedDates: ymd } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[teacher/classes/:id/attendance] POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

