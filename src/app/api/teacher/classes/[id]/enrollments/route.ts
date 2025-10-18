import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

// GET /api/teacher/classes/[id]/enrollments
// Returns enrollments for a class with basic user info
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.role || (session.user.role !== "teacher" && session.user.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    let classId: ObjectId;
    try {
      classId = new ObjectId(params.id);
    } catch {
      return NextResponse.json({ error: "Invalid class id" }, { status: 400 });
    }

    const enrollments = await db
      .collection("enrollments")
      .aggregate([
        { $match: { classId } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            _id: 1,
            userId: 1,
            classId: 1,
            status: 1,
            attendedDates: 1,
            "user.name": 1,
            "user.email": 1,
            "user.parentPhone": 1,
            "user.medical": 1,
            "user.emergencyContact": 1,
          },
        },
      ])
      .toArray();

    return NextResponse.json({ enrollments });
  } catch (err) {
    console.error("[teacher/classes/:id/enrollments] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

