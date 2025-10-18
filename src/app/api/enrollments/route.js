import { ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const { userId, classId } = await req.json();
    if (!userId || !classId) {
      return new Response(JSON.stringify({ error: "Missing userId or classId" }), { status: 400 });
    }

    const db = await getDb();
    const payload = {
      userId: new ObjectId(String(userId)),
      classId: new ObjectId(String(classId)),
      status: "active",
      attendedDates: [],
      createdAt: new Date(),
    };

    await db.collection("enrollments").updateOne(
      { userId: payload.userId, classId: payload.classId },
      { $setOnInsert: payload },
      { upsert: true }
    );

    return new Response(JSON.stringify({ message: "Student enrolled successfully" }), { status: 201 });
  } catch (error) {
    console.error("POST /api/enrollments error:", error);
    return new Response(JSON.stringify({ error: "Failed to enroll student" }), { status: 500 });
  }
}
