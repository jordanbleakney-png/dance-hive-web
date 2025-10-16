import { getDb } from "@/lib/dbConnect";

const uri = process.env.MONGODB_URI;

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
      });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // ✅ Activate membership in database
    const result = await db.collection("users").updateOne(
      { email },
      {
        $set: {
          "membership.status": "active",
          "membership.startDate": new Date(),
        },
      }
    );

    await client.close();

    if (result.matchedCount === 0) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    return new Response(
      JSON.stringify({ message: "Membership activated successfully" }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Membership activation error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to activate membership" }),
      { status: 500 }
    );
  }
}
