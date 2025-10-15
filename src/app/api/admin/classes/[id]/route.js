import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET(req, context) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { id } = await context.params; // ✅ must await params in Next.js 15
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");

  const classInfo = await db
    .collection("classes")
    .findOne({ _id: new ObjectId(id) });

  if (!classInfo) {
    await client.close();
    return new Response(JSON.stringify({ error: "Class not found" }), {
      status: 404,
    });
  }

  // Find all students enrolled in this class
  const students = await db
    .collection("users")
    .find({ "membership.classId": id })
    .toArray();

  await client.close();

  return new Response(JSON.stringify({ classInfo, students }), { status: 200 });
}
