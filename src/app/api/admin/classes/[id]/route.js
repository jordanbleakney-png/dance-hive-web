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

  // Load enrollments for this class
  const enrollments = await db.collection("enrollments").find({ classId: classObjectId }).toArray();
  const userIds = enrollments.map((e) => e.userId);

  // Load users for enrollments
  const users = await db
    .collection("users")
    .find({ _id: { $in: userIds } })
    .project({ email: 1, name: 1, phone: 1, parent: 1, child: 1, childName: 1, studentName: 1, age: 1, membership: 1 })
    .toArray();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  // For users missing child details, try to backfill from latest trial for this class
  const idString = String(classObjectId);
  const students = [];
  for (const e of enrollments) {
    const u = userById.get(String(e.userId));
    if (!u) continue;
    let childName = (u.child && `${u.child.firstName || ""} ${u.child.lastName || ""}`.trim()) || u.childName || u.studentName || "";
    let childAge = u.age || null;
    if (!childName || childAge == null) {
      const trial = await db
        .collection("trialBookings")
        .find({ email: u.email, classId: idString })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      if (trial[0]) {
        childName = childName || trial[0].childName || "";
        if (childAge == null) {
          const tAge = Number(trial[0].childAge);
          childAge = Number.isFinite(tAge) ? tAge : null;
        }
      }
    }
    const parentName = (u.parent && `${u.parent.firstName || ""} ${u.parent.lastName || ""}`.trim()) || u.name || "";

    students.push({
      _id: u._id,
      email: u.email,
      parentName,
      parentPhone: u.phone || "",
      childName,
      childAge,
      membership: u.membership,
    });
  }

  return new Response(JSON.stringify({ classInfo, students }), { status: 200 });
}



