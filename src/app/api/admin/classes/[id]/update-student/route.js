import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { email, status } = await req.json();
  if (!email || !status) {
    return new Response(JSON.stringify({ error: "Missing email or status" }), { status: 400 });
  }

  const db = await getDb();
  await db
    .collection("users")
    .updateOne({ email: email.toLowerCase() }, { $set: { "membership.status": status } });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
