import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export async function GET(_, { params }) {
  try {
    const { id } = params;
    const db = await getDb();
    const danceClass = await db.collection("classes").findOne({ _id: new ObjectId(id) });
    if (!danceClass) {
      return new Response(JSON.stringify({ error: "Class not found" }), { status: 404 });
    }
    return new Response(JSON.stringify(danceClass), { status: 200 });
  } catch (error) {
    console.error("[classes:id] GET error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch class" }), { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }
    const { id } = params;
    const updates = await req.json();
    const db = await getDb();
    const result = await db.collection("classes").updateOne({ _id: new ObjectId(id) }, { $set: updates });
    if (result.modifiedCount === 0) {
      return new Response(JSON.stringify({ message: "No changes made" }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: "Class updated successfully" }), { status: 200 });
  } catch (error) {
    console.error("[classes:id] PATCH error:", error);
    return new Response(JSON.stringify({ error: "Failed to update class" }), { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }
    const { id } = params;
    const db = await getDb();
    const result = await db.collection("classes").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return new Response(JSON.stringify({ error: "Class not found" }), { status: 404 });
    }
    return new Response(JSON.stringify({ message: "Class deleted successfully" }), { status: 200 });
  } catch (error) {
    console.error("[classes:id] DELETE error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete class" }), { status: 500 });
  }
}
