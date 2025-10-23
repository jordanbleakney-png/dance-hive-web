import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect"; // shared DB connection

export async function GET() {
  try {
    const session = await auth();

    // Ensure admin access
    if (!session?.user || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // Use shared database connection
    const db = await getDb();

    // Fetch all payments
    const payments = await db
      .collection("payments")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Optional: data cleanup / repair
    for (const payment of payments) {
      if (!payment.email && payment.userEmail) {
        await db
          .collection("payments")
          .updateOne(
            { _id: payment._id },
            { $set: { email: payment.userEmail } }
          );
      }
    }

    return new Response(JSON.stringify({ payments }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[admin/payments] Error fetching payments:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch payments" }), {
      status: 500,
    });
  }
}

