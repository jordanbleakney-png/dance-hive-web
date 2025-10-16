import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect"; // ✅ use the named helper

export async function GET() {
  const session = await auth();

  // 🔒 Only admins allowed
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    // ✅ Get the database connection
    const db = await getDb();

    // ✅ Fetch all classes
    const classes = await db.collection("classes").find().toArray();

    // ✅ Count bookings per class
    const bookings = await db
      .collection("bookings")
      .aggregate([{ $group: { _id: "$classId", count: { $sum: 1 } } }])
      .toArray();

    // ✅ Merge classes with booking counts
    const classList = classes.map((cls) => ({
      ...cls,
      _id: cls._id.toString(),
      studentCount:
        bookings.find((b) => b._id === cls._id.toString())?.count || 0,
    }));

    return new Response(JSON.stringify(classList), { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching classes:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch classes" }), {
      status: 500,
    });
  }
}
