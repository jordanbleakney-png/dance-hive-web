import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect"; // âœ… use the named helper

export async function GET() {
  const session = await auth();

  // ðŸ”’ Only admins allowed
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    // âœ… Get the database connection
    const db = await getDb();

    // âœ… Fetch all classes
    const classes = await db.collection("classes").find().toArray();

    // âœ… Count bookings per class
    const enrollmentCounts = await db
      .collection("enrollments").aggregate([{ $group: { _id: "$classId", count: { $sum: 1 } } }]).toArray();

    // âœ… Merge classes with booking counts
    const classList = classes.map((cls) => ({
      ...cls,
      _id: cls._id.toString(),
      studentCount:
        (enrollmentCounts.find((e) => String(e._id) === String(cls._id))?.count) || 0,
    }));

    return new Response(JSON.stringify(classList), { status: 200 });
  } catch (error) {
    console.error("âŒ Error fetching classes:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch classes" }), {
      status: 500,
    });
  }
}

