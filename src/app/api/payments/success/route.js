import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing user email in redirect" }),
        { status: 400 }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // 🧩 Update user's role and membership status
    const updateRes = await db.collection("users").updateOne(
      { $or: [{ email }, { email }] },
      {
        $set: {
          role: "member",
          "membership.status": "active",
          "membership.upgradedAt": new Date(),
        },
      }
    );

    console.log(`✅ Upgraded ${email} to member`, updateRes.modifiedCount);

    await client.close();

    // ✅ Redirect user back to dashboard
    return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`);
  } catch (error) {
    console.error("❌ Payment success handler error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
