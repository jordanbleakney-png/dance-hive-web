import { ObjectId } from 'mongodb';\nimport { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST(req, context) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const email = body.email;
  const { id } = context.params;

  if (!email || !id) {
    return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });
  }

  const db = await getDb();

  // 1) Remove membership from user and downgrade to customer
  const userFilter = { email: email.toLowerCase() };
  await db.collection("users").updateOne(userFilter, {
    $unset: { membership: "" },
    $set: { role: "customer" },
  });

  // 2) Remove their booking entry (legacy)
  await db.collection("bookings").deleteOne({ email: email.toLowerCase(), classId: id });

  // Optionally remove from enrollments (if present)
  await db.collection("enrollments").deleteOne({ classId: new ObjectId(id), userId: user._id });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

