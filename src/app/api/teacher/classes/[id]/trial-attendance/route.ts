import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

// POST /api/teacher/classes/[id]/trial-attendance
// Body: { trialId: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.role || (session.user.role !== "teacher" && session.user.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { trialId } = await req.json();
    if (!trialId) return NextResponse.json({ error: "Missing trialId" }, { status: 400 });

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(String(trialId));
    } catch {
      return NextResponse.json({ error: "Invalid trialId" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("trialBookings").updateOne(
      { _id: objectId },
      { $set: { status: "attended", updatedAt: new Date(), attendedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[teacher/classes/:id/trial-attendance] POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

