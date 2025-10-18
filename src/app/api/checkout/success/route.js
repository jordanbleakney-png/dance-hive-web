import { getDb } from "@/lib/dbConnect";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });
    }

    const db = await getDb();

    const result = await db.collection("users").updateOne(
      { email: email.toLowerCase() },
      { $set: { "membership.status": "active", "membership.startDate": new Date() } }
    );

    if (result.matchedCount === 0) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    return new Response(JSON.stringify({ message: "Membership activated successfully" }), { status: 200 });
  } catch (err) {
    console.error("[checkout/success] Membership activation error:", err);
    return new Response(JSON.stringify({ error: "Failed to activate membership" }), { status: 500 });
  }
}
