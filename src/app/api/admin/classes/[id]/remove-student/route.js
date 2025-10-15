import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

export async function POST(req, context) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  // 📨 Extract email safely (handles both email & email)
  const body = await req.json();
  const email = body.email || body.email;
  const { id } = await context.params; // ✅ Next.js 15 fix

  if (!email || !id) {
    console.error("❌ Missing email or class ID:", { email, id });
    return new Response(JSON.stringify({ error: "Missing data" }), {
      status: 400,
    });
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");

  // 🧾 Match users by either email type
  const userFilter = {
    $or: [{ email }, { email: email }],
  };

  // 🧠 1️⃣ Remove membership from user
  const userUpdate = await db
    .collection("users")
    .updateOne(userFilter, { $unset: { membership: "" } });

  // 🧠 2️⃣ Remove their booking entry
  const bookingDelete = await db.collection("bookings").deleteOne({
    $or: [{ email: email }, { email: email }],
    classId: id,
  });

  // 🧠 3️⃣ Downgrade user role to "customer"
  await db.collection("users").updateOne(userFilter, {
    $set: { role: "customer" },
  });

  await client.close();

  console.log("✅ Student removed successfully:", {
    email,
    id,
    userUpdate,
    bookingDelete,
  });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
