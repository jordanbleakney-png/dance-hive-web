import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI as string;

// ✅ GET /api/users/status?email=user@email.com
export async function GET(req: Request) {
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

    // ✅ Find user by email (case-insensitive)
    const user = await db.collection("users").findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    await client.close();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    // ✅ Return consistent structure for dashboard
    return new Response(
      JSON.stringify({
        email: user.email,
        role: user.role || "customer",
        membership: {
          status: user.membership?.status || "inactive",
          plan: user.membership?.plan || "none",
          updatedAt: user.membership?.updatedAt || null,
          lastPaymentDate: user.membership?.lastPaymentDate || null,
        },
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
