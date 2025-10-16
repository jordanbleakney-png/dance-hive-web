import { getDb } from "@/lib/dbConnect";

const uri = process.env.MONGODB_URI;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
    });
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");

  try {
    const user = await db
      .collection("users")
      .findOne({ $or: [{ email }, { email }] });

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    return new Response(
      JSON.stringify({
        role: user.role,
        membership: user.membership || {},
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Error fetching user status:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  } finally {
    await client.close();
  }
}
