import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const payments = await db.collection("payments").find({}).toArray();

    console.log("✅ Admin loaded payments:", payments.length);

    return new Response(JSON.stringify({ payments }), { status: 200 });
  } catch (error) {
    console.error("❌ Error loading payments:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
