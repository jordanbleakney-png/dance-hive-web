import { MongoClient, ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const uri = process.env.MONGODB_URI;

/**
 * POST  → Create a new trial booking (public)
 * GET   → Fetch all trial bookings (admin only)
 * PUT   → Update trial status (admin)
 */

export async function POST(req) {
  try {
    const data = await req.json();
    const { childName, childAge, parentName, email, parentPhone, classId } =
      data;

    if (!childName || !childAge || !parentName || !email || !classId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
        }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const result = await db.collection("trialBookings").insertOne({
      childName,
      childAge,
      parentName,
      email,
      parentPhone,
      classId,
      status: "pending", // "pending" → "attended" → "converted"
      createdAt: new Date(),
    });

    await client.close();
    return new Response(
      JSON.stringify({
        message: "✅ Trial booking created",
        id: result.insertedId,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Trial POST error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}

// 🧑‍💼 Admin: Get all trial bookings
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");
    const trials = await db.collection("trialBookings").find().toArray();
    await client.close();

    return new Response(JSON.stringify(trials), { status: 200 });
  } catch (error) {
    console.error("Trial GET error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}

// 🧑‍💼 Admin: Update trial status (e.g., attended / converted)
export async function PUT(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return new Response(JSON.stringify({ error: "Missing id or status" }), {
        status: 400,
      });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const result = await db
      .collection("trialBookings")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    await client.close();
    return new Response(JSON.stringify({ message: "Trial updated", result }), {
      status: 200,
    });
  } catch (error) {
    console.error("Trial PUT error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
