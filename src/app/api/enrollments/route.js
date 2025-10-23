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
    const userObjectId = new ObjectId(String(userId));
    const classObjectId = new ObjectId(String(classId));

    // If already enrolled, no-op
    const existing = await db
      .collection("enrollments")
      .findOne({ userId: userObjectId, classId: classObjectId });
    if (existing) {
      return new Response(
        JSON.stringify({ message: "Already enrolled" }),
        { status: 200 }
      );
    }

    // Capacity check: only count active enrollments
    const cls = await db.collection("classes").findOne({ _id: classObjectId });
    if (!cls) {
      return new Response(JSON.stringify({ error: "Class not found" }), { status: 404 });
    }
    const cap = Number(cls.capacity || 0);
    if (cap > 0) {
      const enrolledCount = await db
        .collection("enrollments")
        .countDocuments({ classId: classObjectId, status: "active" });
      if (enrolledCount >= cap) {
        return new Response(
          JSON.stringify({ error: "Class is full", capacity: cap, enrolled: enrolledCount }),
          { status: 409 }
        );
      }
    }

    const payload = {
      userId: userObjectId,
      classId: classObjectId,
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

export async function DELETE(req) {
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
    await db.collection("enrollments").deleteOne({
      userId: new ObjectId(String(userId)),
      classId: new ObjectId(String(classId)),
    });

    return new Response(JSON.stringify({ message: "Enrollment removed" }), { status: 200 });
  } catch (error) {
    console.error("DELETE /api/enrollments error:", error);
    return new Response(JSON.stringify({ error: "Failed to remove enrollment" }), { status: 500 });
  }
}
