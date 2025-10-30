import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export async function GET(_, context) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { id } = context.params;
  const db = await getDb();

  let classObjectId;
  try {
    classObjectId = new ObjectId(id);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid class id" }), { status: 400 });
  }

  const classInfo = await db.collection("classes").findOne({ _id: classObjectId });
  if (!classInfo) {
    return new Response(JSON.stringify({ error: "Class not found" }), { status: 404 });
  }

  const pipeline = [
    { $match: { classId: classObjectId } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $lookup: { from: "children", localField: "childId", foreignField: "_id", as: "child" } },
    { $unwind: { path: "$child", preserveNullAndEmptyArrays: true } },
    { $project: {
        _id: 1,
        email: "$user.email",
        parentName: { $trim: { input: { $concat: [ { $ifNull: ["$user.parent.firstName", ""] }, " ", { $ifNull: ["$user.parent.lastName", ""] } ] } } },
        parentPhone: { $ifNull: ["$user.phone", ""] },
        childFirst: { $ifNull: ["$child.firstName", "$user.child.firstName"] },
        childLast: { $ifNull: ["$child.lastName", "$user.child.lastName"] },
        childAge: "$user.age",
        membership: "$user.membership",
      } },
  ];

  const joined = await db.collection("enrollments").aggregate(pipeline).toArray();

  const idString = String(classObjectId);
  const students = [];
  for (const row of joined) {
    let childName = [row.childFirst, row.childLast].filter(Boolean).join(" ");
    let childAge = row.childAge ?? null;
    if (!childName) {
      const trial = await db
        .collection("trialBookings")
        .find({ email: row.email, classId: idString })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      if (trial[0]) {
        childName = trial[0].childName || childName;
        if (childAge == null) {
          const tAge = Number(trial[0].childAge);
          childAge = Number.isFinite(tAge) ? tAge : null;
        }
      }
    }
    students.push({
      _id: row._id,
      email: row.email,
      parentName: row.parentName || row.email,
      parentPhone: row.parentPhone || "",
      childName,
      childAge,
      membership: row.membership,
    });
  }

  return new Response(JSON.stringify({ classInfo, students }), { status: 200 });
}

export async function DELETE(_, context) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const { id } = context.params;
  const db = await getDb();
  let classObjectId;
  try { classObjectId = new ObjectId(id); } catch { return new Response(JSON.stringify({ error: "Invalid class id" }), { status: 400 }); }

  const enrolledCount = await db.collection('enrollments').countDocuments({ classId: classObjectId });
  if (enrolledCount > 0) {
    return new Response(JSON.stringify({ error: "Cannot delete: class has enrollments" }), { status: 409 });
  }
  await db.collection('classes').deleteOne({ _id: classObjectId });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

