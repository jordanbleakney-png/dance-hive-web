import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

const uri = process.env.MONGODB_URI;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const result = await db
      .collection("users")
      .updateOne({ email: session.user.email }, { $set: { role: "member" } });

    if (result.modifiedCount === 0) {
      return new Response(JSON.stringify({ message: "User not updated" }), {
        status: 400,
      });
    }

    return new Response(
      JSON.stringify({ message: "✅ User upgraded to member" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Upgrade error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
