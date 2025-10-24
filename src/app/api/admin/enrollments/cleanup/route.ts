import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

// POST /api/admin/enrollments/cleanup
// Body (optional): { mode?: 'purge' | 'dry-run' }
// - Removes enrollments that have:
//   1) missing/null childId
//   2) childId that no longer resolves to a child document
//   3) exact duplicates of (userId, childId, classId) keeping the oldest
// Returns counts for transparency. Admin-only.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "dry-run" ? "dry-run" : "purge";

    const db = await getDb();
    const enrollments = db.collection("enrollments");

    // 1) Missing or null childId
    const missingFilter = { $or: [{ childId: { $exists: false } }, { childId: null }] } as any;
    const missingCount = await enrollments.countDocuments(missingFilter);

    // 2) childId that doesn't correspond to an existing child
    const invalidChildIds = await enrollments
      .aggregate([
        { $match: { childId: { $exists: true, $ne: null } } },
        {
          $lookup: {
            from: "children",
            localField: "childId",
            foreignField: "_id",
            as: "child",
          },
        },
        { $match: { $expr: { $eq: [{ $size: "$child" }, 0] } } },
        { $project: { _id: 1 } },
      ])
      .toArray();

    const invalidIds = invalidChildIds.map((d: any) => d._id as ObjectId);
    const invalidCount = invalidIds.length;

    // 3) exact duplicates by triple key (userId, childId, classId)
    const dups = await enrollments
      .aggregate([
        { $group: { _id: { userId: "$userId", childId: "$childId", classId: "$classId" }, ids: { $push: { _id: "$_id", createdAt: "$createdAt" } }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]).toArray();

    let duplicateIds: ObjectId[] = [];
    for (const g of dups as any[]) {
      const sorted = [...g.ids].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      const keep = sorted.shift();
      const remove = sorted.map((x) => x._id as ObjectId);
      duplicateIds.push(...remove);
    }

    let removedMissing = 0;
    let removedInvalid = 0;
    let removedDuplicates = 0;
    if (mode === "purge") {
      if (missingCount > 0) {
        const res = await enrollments.deleteMany(missingFilter);
        removedMissing = res.deletedCount || 0;
      }
      if (invalidCount > 0) {
        const res = await enrollments.deleteMany({ _id: { $in: invalidIds } });
        removedInvalid = res.deletedCount || 0;
      }
      if (duplicateIds.length > 0) {
        const res = await enrollments.deleteMany({ _id: { $in: duplicateIds } });
        removedDuplicates = res.deletedCount || 0;
      }
    }

    return NextResponse.json(
      {
        mode,
        summary: {
          missingChildId: { detected: missingCount, removed: removedMissing },
          invalidChildId: { detected: invalidCount, removed: removedInvalid },
          exactDuplicates: { detected: dups.length, removed: removedDuplicates },
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[admin/enrollments/cleanup] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
