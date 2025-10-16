import { MongoClient, ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";

const uri = process.env.MONGODB_URI;

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
      });
    }

    const { userId, classId } = await req.json();
    if (!userId || !classId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or classId" }),
        { status: 400 }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const enrollment = {
      userId: new ObjectId(userId),
      classId: new ObjectId(classId),
      status: "active",
      attendedDates: [],
      createdAt: new Date(),
    };

    await db.collection("enrollments").insertOne(enrollment);
    await client.close();

    return new Response(
      JSON.stringify({ message: "Student enrolled successfully" }),
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("POST /api/enrollments error:", error);
    return new Response(JSON.stringify({ error: "Failed to enroll student" }), {
      status: 500,
    });
  }
}
