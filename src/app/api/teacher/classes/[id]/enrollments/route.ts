import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

// GET /api/teacher/classes/[id]/enrollments
// Returns enrollments for a class with basic user info
export async function GET(req: Request, { params }: { params: { id: string } }) {
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
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $lookup: { from: "children", localField: "childId", foreignField: "_id", as: "child" } },
        { $unwind: { path: "$child", preserveNullAndEmptyArrays: true } },
        // Backward compatibility: if child lookup fails, fall back to any embedded user.child fields
        {
          $addFields: {
            _childFirst: { $ifNull: ["$child.firstName", "$user.child.firstName"] },
            _childLast: { $ifNull: ["$child.lastName", "$user.child.lastName"] },
            _childDob: { $ifNull: ["$child.dob", "$user.child.dob"] },
            _childMedical: { $ifNull: ["$child.medical", "$user.medical"] },
          }
        },
        {
          $addFields: {
            "user.name": {
              $ifNull: [
                "$user.name",
                { $trim: { input: { $concat: [ { $ifNull: ["$user.parent.firstName", ""] }, " ", { $ifNull: ["$user.parent.lastName", ""] } ] } } }
              ]
            }
          }
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            childId: 1,
            classId: 1,
            status: 1,
            attendedDates: 1,
            "user.name": 1,
            "user.email": 1,
            "user.phone": 1,
            "user.parent": 1,
            "user.emergencyContact": 1,
            child: { firstName: "$_childFirst", lastName: "$_childLast", dob: "$_childDob", medical: "$_childMedical" }
          }
        }
      ])
      .toArray();

    // Also fetch trial bookings linked to this class (support string or ObjectId classId)
    const url = new URL(req.url);
    const selectedDate = url.searchParams.get('date'); // YYYY-MM-DD
    const trialsQuery: any = { $or: [ { classId }, { classId: String(classId) } ] };
    if (selectedDate) {
      // Prefer server-side filtering for efficiency; include legacy records without trialDate
      trialsQuery.$or = [
        { trialDate: selectedDate },
        { trialDate: { $exists: false } },
        { trialDate: null },
      ];
    }

    const trialsRaw = await db
      .collection("trialBookings")
      .find(trialsQuery)
      .project({
        parent: 1,
        child: 1,
        parentName: 1,
        childName: 1,
        email: 1,
        phone: 1,
        status: 1,
        isMemberTrial: 1,
        trialDate: 1,
        createdAt: 1,
      })
      .toArray();

    // Exclude trials for users who are already members
    const emails = Array.from(new Set(trialsRaw.map((t: any) => String(t.email || '').toLowerCase()).filter(Boolean)));
    let memberEmails = new Set<string>();
    let existingUserEmails = new Set<string>();
    if (emails.length) {
      const users = await db.collection('users').find({ email: { $in: emails } }).project({ email: 1, role: 1, membership: 1 } as any).toArray();
      users.forEach((u: any) => {
        const key = String(u.email || '').toLowerCase();
        existingUserEmails.add(key);
        if (u?.role === 'member' || u?.membership?.status === 'active') {
          memberEmails.add(key);
        }
      });
    }
    const prevEmailsArr = await db.collection('previousCustomers').find({}).project({ email: 1 } as any).toArray();
    const prevEmails = new Set(prevEmailsArr.map((d:any)=> String(d.email || '').toLowerCase()));
    const trials = trialsRaw.filter((t: any) => {
      const emailKey = String(t.email || '').toLowerCase();
      const st = String(t.status || '').toLowerCase();
      const archivedTrial = st === 'archived';
      const attendedTrial = st === 'attended';
      const absentTrial = st === 'absent';
      const convertedTrial = st === 'converted';
      // Keep member-originated trials even if the user is a member
      if (!t?.isMemberTrial) {
        if (memberEmails.has(emailKey)) return false;
      }
      // Do not hide restored users just because a previousCustomers snapshot exists
      const isArchivedOnly = prevEmails.has(emailKey) && !existingUserEmails.has(emailKey);
      if (isArchivedOnly || archivedTrial || attendedTrial || absentTrial || convertedTrial) return false;
      if (selectedDate) {
        if (t.trialDate) return String(t.trialDate).slice(0,10) === selectedDate;
        // legacy: shown on all dates until backfilled
        return true;
      }
      return true;
    });

    return NextResponse.json({ enrollments, trials });
  } catch (err) {
    console.error("[teacher/classes/:id/enrollments] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/teacher/classes/[id]/enrollments
// Body: { userId: string }
// Creates an enrollment for the selected class with capacity enforcement.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.role || (session.user.role !== "teacher" && session.user.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, childId } = await req.json();
    if (!userId || !childId) {
      return NextResponse.json({ error: "Missing userId or childId" }, { status: 400 });
    }

    let classId: ObjectId;
    let uId: ObjectId;
    let cId: ObjectId;
    try {
      classId = new ObjectId(params.id);
      uId = new ObjectId(String(userId));
      cId = new ObjectId(String(childId));
    } catch {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const db = await getDb();

    // If already enrolled, no-op
    const existing = await db.collection("enrollments").findOne({ userId: uId, childId: cId, classId });
    if (existing) {
      return NextResponse.json({ message: "Already enrolled" }, { status: 200 });
    }

    // Capacity check
    const cls = await db.collection("classes").findOne({ _id: classId });
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    const cap = Number((cls as any)?.capacity || 0);
    if (cap > 0) {
      const enrolledCount = await db
        .collection("enrollments")
        .countDocuments({ classId, status: "active" });
      if (enrolledCount >= cap) {
        return NextResponse.json(
          { error: "Class is full", capacity: cap, enrolled: enrolledCount },
          { status: 409 }
        );
      }
    }

    await db.collection("enrollments").updateOne(
      { userId: uId, childId: cId, classId },
      { $setOnInsert: { userId: uId, childId: cId, classId, status: "active", attendedDates: [], createdAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ message: "Student enrolled" }, { status: 201 });
  } catch (err) {
    console.error("[teacher/classes/:id/enrollments] POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
