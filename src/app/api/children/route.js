import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

// POST /api/children
// Body: { userId: string, firstName: string, lastName?: string, dob?: string(ISO), medical?: string }
export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const { userId, firstName, lastName = "", dob, medical = "" } = body || {};
    if (!userId || !firstName) {
      return new Response(JSON.stringify({ error: "Missing userId or firstName" }), { status: 400 });
    }
    let uId;
    try { uId = new ObjectId(String(userId)); } catch { return new Response(JSON.stringify({ error: "Invalid userId" }), { status: 400 }); }

    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: uId });
    if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

    let parsedDob = undefined;
    if (dob) {
      const d = new Date(dob);
      if (!isNaN(d)) parsedDob = d.toISOString();
    }

    const doc = {
      userId: uId,
      firstName: String(firstName).trim(),
      lastName: String(lastName || "").trim(),
      dob: parsedDob,
      medical: String(medical || ""),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ins = await db.collection("children").insertOne(doc);
    const child = { ...doc, _id: ins.insertedId };
    return new Response(JSON.stringify({ child }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[children] POST error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

