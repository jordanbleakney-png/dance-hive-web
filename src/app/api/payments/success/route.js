import { getDb } from "@/lib/dbConnect";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing user email in redirect" }), { status: 400 });
    }

    const db = await getDb();

    const updateRes = await db.collection("users").updateOne(
      { email: email.toLowerCase() },
      { $set: { role: "member", "membership.status": "active", "membership.upgradedAt": new Date() } }
    );

    // Redirect back to dashboard regardless (webhook will make the authoritative update)
    return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/dashboard`);
  } catch (error) {
    console.error("[payments/success] handler error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
