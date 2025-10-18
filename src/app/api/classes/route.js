import { auth } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/dbConnect";

// Public: list classes
export async function GET() {
  const db = await getDb();
  const classes = await db.collection("classes").find().toArray();
  return new Response(JSON.stringify(classes), { status: 200 });
}

// Admin: create class
export async function POST(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const data = await req.json();
  const db = await getDb();
  await db.collection("classes").insertOne({ ...data, createdAt: new Date() });
  return new Response(JSON.stringify({ message: "Class created" }), { status: 201 });
}

// Admin: delete class
export async function DELETE(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400 });
  }
  const db = await getDb();
  await db.collection("classes").deleteOne({ _id: new ObjectId(id) });
  return new Response(JSON.stringify({ message: "Class deleted" }), { status: 200 });
}

// Admin: update class
export async function PUT(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const { id, updates } = await req.json();
  if (!id || !updates) {
    return new Response(JSON.stringify({ error: "Missing ID or updates" }), { status: 400 });
  }
  const db = await getDb();
  await db.collection("classes").updateOne({ _id: new ObjectId(id) }, { $set: updates });
  return new Response(JSON.stringify({ message: "Class updated successfully" }), { status: 200 });
}
