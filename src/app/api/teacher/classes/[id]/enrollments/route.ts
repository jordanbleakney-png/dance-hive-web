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
          $addFields: {
            "user.name": {
              $ifNull: [
                "$user.name",
                {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ["$user.parent.firstName", ""] },
                        " ",
                        { $ifNull: ["$user.parent.lastName", ""] },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            classId: 1,
            status: 1,
            attendedDates: 1,
            "user.name": 1,
            "user.email": 1,
            "user.phone": 1,
            "user.child": 1,
            "user.parent": 1,
            "user.medical": 1,
            "user.emergencyContact": 1,
          },
        },
      ])
      .toArray();

    // Also fetch trial bookings linked to this class by string classId
    const trialsRaw = await db
      .collection("trialBookings")
      .find({ classId: String(classId) })
      .project({
        parent: 1,
        child: 1,
        parentName: 1,
        childName: 1,
        email: 1,
        phone: 1,
        status: 1,
        createdAt: 1,
      })
      .toArray();

    // Exclude trials for users who are already members
    const emails = Array.from(new Set(trialsRaw.map((t: any) => String(t.email || '').toLowerCase()).filter(Boolean)));
    let memberEmails = new Set<string>();
    if (emails.length) {
      const users = await db.collection('users').find({ email: { $in: emails } }).project({ email: 1, role: 1, membership: 1 } as any).toArray();
      users.forEach((u: any) => {
        if (u?.role === 'member' || u?.membership?.status === 'active') {
          memberEmails.add(String(u.email || '').toLowerCase());
        }
      });
    }
    const trials = trialsRaw.filter((t: any) => !memberEmails.has(String(t.email || '').toLowerCase()));

    return NextResponse.json({ enrollments, trials });
  } catch (err) {
    console.error("[teacher/classes/:id/enrollments] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
