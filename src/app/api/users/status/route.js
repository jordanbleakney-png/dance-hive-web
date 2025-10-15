import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
      });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const user = await db.collection("users").findOne({
      $or: [{ email }, { email: email }],
    });

    await client.close();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    return new Response(
      JSON.stringify({
        email: user.email,
        role: user.role,
        membershipStatus: user.membership?.status || "none",
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ /api/users/status error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
