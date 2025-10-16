import { auth } from "@/app/api/auth/[...nextauth]/route";
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");
  const classes = await db.collection("classes").find().toArray();
  await client.close();

  return new Response(JSON.stringify(classes), { status: 200 });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const data = await req.json();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");
  await db.collection("classes").insertOne({ ...data, createdAt: new Date() });
  await client.close();

  return new Response(JSON.stringify({ message: "Class created" }), {
    status: 201,
  });
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing ID" }), {
      status: 400,
    });
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");
  await db.collection("classes").deleteOne({ _id: new ObjectId(id) });
  await client.close();

  return new Response(JSON.stringify({ message: "Class deleted" }), {
    status: 200,
  });
}

// 🧩 NEW: Edit class details
export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { id, updates } = await req.json();
  if (!id || !updates) {
    return new Response(JSON.stringify({ error: "Missing ID or updates" }), {
      status: 400,
    });
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");
  await db
    .collection("classes")
    .updateOne({ _id: new ObjectId(id) }, { $set: updates });
  await client.close();

  return new Response(
    JSON.stringify({ message: "Class updated successfully" }),
    { status: 200 }
  );
}
