import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect"; // use the named helper

export async function GET() {
  const session = await auth();

  // Only admins allowed
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    // Get the database connection
    const db = await getDb();

    // Fetch all classes
    const classes = await db.collection("classes").find().toArray();

    // Count bookings per class
    const enrollmentCounts = await db
      .collection("enrollments")
      .aggregate([{ $group: { _id: "$classId", count: { $sum: 1 } } }])
      .toArray();

    // Merge classes with booking counts
    const classList = classes.map((cls) => ({
      ...cls,
      _id: cls._id.toString(),
      studentCount: enrollmentCounts.find((e) => String(e._id) === String(cls._id))?.count || 0,
    }));

    return new Response(JSON.stringify(classList), { status: 200 });
  } catch (error) {
    console.error("[admin/classes] Error fetching classes:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch classes" }), {
      status: 500,
    });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const style = String(body.style || "").trim();
    const instructor = String(body.instructor || "").trim();
    const day = String(body.day || "").trim();
    const time = String(body.time || "").trim();
    const capacity = Number(body.capacity || 0);
    if (!name || !day || !time) {
      return new Response(JSON.stringify({ error: "Missing required fields (name, day, time)" }), { status: 400 });
    }
    const db = await getDb();
    const doc = {
      name,
      style,
      instructor,
      day,
      time,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 0,
      createdAt: new Date(),
    };
    const ins = await db.collection("classes").insertOne(doc);
    return new Response(JSON.stringify({ success: true, _id: String(ins.insertedId) }), { status: 201 });
  } catch (error) {
    console.error("[admin/classes] POST error:", error);
    return new Response(JSON.stringify({ error: "Failed to create class" }), { status: 500 });
  }
}
