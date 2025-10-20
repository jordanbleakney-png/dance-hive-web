import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne(
      { email: session.user.email.toLowerCase() },
      {
        projection: {
          parent: 1,
          child: 1,
          medical: 1,
          emergencyContact: 1,
          membership: 1,
        },
      }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = (user as any)._id as ObjectId;
    const enrollments = await db
      .collection("enrollments")
      .aggregate([
        { $match: { userId } },
        {
          $lookup: {
            from: "classes",
            localField: "classId",
            foreignField: "_id",
            as: "class",
          },
        },
        { $unwind: "$class" },
        {
          $project: {
            _id: 1,
            status: 1,
            class: {
              _id: "$class._id",
              name: "$class.name",
              day: "$class.day",
              time: "$class.time",
              instructor: "$class.instructor",
            },
          },
        },
      ])
      .toArray();

    // Recent payments (last 5)
    const payments = await db
      .collection("payments")
      .find(
        { email: session.user.email.toLowerCase() },
        { projection: { amount: 1, currency: 1, payment_status: 1, createdAt: 1, timestamp: 1 } }
      )
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return NextResponse.json({
      parent: (user as any).parent || null,
      child: (user as any).child || null,
      medical: (user as any).medical || null,
      emergencyContact: (user as any).emergencyContact || null,
      membership: (user as any).membership || null,
      enrollments,
      payments,
    });
  } catch (err) {
    console.error("[account/overview] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
