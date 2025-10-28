import { ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST(req, context) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").toLowerCase();
    const { id } = context.params || {};
    if (!email || !id) {
      return new Response(JSON.stringify({ error: "Missing email or id" }), { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    // Remove enrollment for this class
    let classObjectId;
    try {
      classObjectId = new ObjectId(String(id));
    } catch {
      return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400 });
    }
    await db.collection("enrollments").deleteOne({ userId: user._id, classId: classObjectId });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    console.error("[admin/classes/:id/remove-student] error", e);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

