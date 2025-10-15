import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");

  // Fetch all classes
  const classes = await db.collection("classes").find().toArray();

  // Count how many bookings per class
  const bookings = await db
    .collection("bookings")
    .aggregate([{ $group: { _id: "$classId", count: { $sum: 1 } } }])
    .toArray();

  const classList = classes.map((cls) => ({
    ...cls,
    _id: cls._id.toString(),
    studentCount:
      bookings.find((b) => b._id === cls._id.toString())?.count || 0,
  }));

  await client.close();

  return new Response(JSON.stringify(classList), { status: 200 });
}
