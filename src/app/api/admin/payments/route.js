import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // 🔒 Ensure admin access
    if (!session?.user || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // ✅ Fetch all payments
    const payments = await db
      .collection("payments")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // ✅ Auto repair & consistency
    for (const payment of payments) {
      if (!payment.email && payment.email) {
        await db
          .collection("payments")
          .updateOne({ _id: payment._id }, { $set: { email: payment.email } });
      } else if (!payment.email && payment.email) {
        await db
          .collection("payments")
          .updateOne({ _id: payment._id }, { $set: { email: payment.email } });
      }
    }

    await client.close();

    return new Response(JSON.stringify({ payments }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Error fetching payments:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch payments" }), {
      status: 500,
    });
  }
}
