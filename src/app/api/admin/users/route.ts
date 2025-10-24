import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const users = await db
      .collection("users")
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $project: { email: 1, role: 1, membership: 1, parent: 1, phone: 1, createdAt: 1, updatedAt: 1 } },
        {
          $lookup: {
            from: "children",
            localField: "_id",
            foreignField: "userId",
            as: "children",
          },
        },
        {
          $addFields: {
            childrenCount: { $size: { $ifNull: ["$children", []] } },
            firstChild: { $first: "$children" },
          },
        },
        // For UI compatibility, also surface a 'child' field derived from firstChild
        {
          $addFields: {
            child: {
              firstName: "$firstChild.firstName",
              lastName: "$firstChild.lastName",
              dob: "$firstChild.dob",
            },
          },
        },
        { $project: { children: 0 } },
      ])
      .toArray();

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin/users] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
