import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // 🔒 Check admin access
    if (!session?.user || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // ✅ Fetch all trial bookings
    const trials = await db
      .collection("trialBookings")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    await client.close();

    return new Response(JSON.stringify({ trials }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error fetching trials:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch trials" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
