import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

const uri = process.env.MONGODB_URI;

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const { email, newRole } = await req.json();
    if (!email || !newRole) {
      return new Response(
        JSON.stringify({ error: "Missing email or newRole" }),
        { status: 400 }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const result = await db
      .collection("users")
      .updateOne({ email }, { $set: { role: newRole } });

    return new Response(
      JSON.stringify({ success: true, updatedCount: result.modifiedCount }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating user role:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
