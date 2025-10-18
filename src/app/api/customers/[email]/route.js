import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

const uri = process.env.MONGODB_URI;

export async function GET(req, context) {
  try {
    const params = await context.params; // ✅ await the params
    const session = await auth();

    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const decodedEmail = decodeURIComponent(params.email);
    console.log("🔍 Looking up customer by email:", decodedEmail);

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // ✅ Case-insensitive match
    const user = await db.collection("users").findOne({
      email: { $regex: new RegExp(`^${decodedEmail}$`, "i") },
    });

    if (!user) {
      console.log("⚠️ No user found for email:", decodedEmail);
      return new Response(
        JSON.stringify({ user: null, bookings: [], payments: [] }),
        { status: 200 }
      );
    }

    const bookings = await db
      .collection("bookings")
      .find({ email: { $regex: new RegExp(`^${decodedEmail}$`, "i") } })
      .toArray();

    const payments = await db
      .collection("payments")
      .find({ email: { $regex: new RegExp(`^${decodedEmail}$`, "i") } })
      .toArray();

    console.log(
      "✅ Found user:",
      user.email,
      "| Bookings:",
      bookings.length,
      "| Payments:",
      payments.length
    );

    return new Response(JSON.stringify({ user, bookings, payments }), {
      status: 200,
    });
  } catch (error) {
    console.error("❌ Error fetching customer details:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function GET(_req, context) {
  try {
    const { email } = context.params;
    const session = await auth();

    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const decodedEmail = decodeURIComponent(email);
    const db = await getDb();

    // Case-insensitive match
    const ci = { $regex: new RegExp(`^${decodedEmail}$`, "i") };
    const user = await db.collection("users").findOne({ email: ci });

    if (!user) {
      return new Response(
        JSON.stringify({ user: null, bookings: [], payments: [] }),
        { status: 200 }
      );
    }

    const bookings = await db.collection("bookings").find({ email: ci }).toArray();
    const payments = await db.collection("payments").find({ email: ci }).toArray();

    return new Response(JSON.stringify({ user, bookings, payments }), { status: 200 });
  } catch (error) {
    console.error("[customers:email] Error fetching customer details:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
