import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

const uri = process.env.MONGODB_URI;

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { email, status } = await req.json();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");

  await db
    .collection("users")
    .updateOne({ email: email }, { $set: { "membership.status": status } });

  await client.close();
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
