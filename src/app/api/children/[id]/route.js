import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

// PUT /api/children/[id]
// Body: { firstName?, lastName?, dob?, medical? }
export async function PUT(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params || {};
    let _id;
    try { _id = new ObjectId(String(id)); } catch { return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400 }); }

    const body = await req.json().catch(() => ({}));
    const set = {};
    if (body.firstName != null) set.firstName = String(body.firstName).trim();
    if (body.lastName != null) set.lastName = String(body.lastName).trim();
    if (body.medical != null) set.medical = String(body.medical);
    if (body.dob != null) {
      const d = new Date(body.dob);
      if (!isNaN(d)) set.dob = d.toISOString();
      else set.dob = null;
    }
    if (Object.keys(set).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields" }), { status: 400 });
    }

    const db = await getDb();
    const res = await db.collection("children").updateOne({ _id }, { $set: { ...set, updatedAt: new Date() } });
    if (!res.matchedCount) return new Response(JSON.stringify({ error: "Child not found" }), { status: 404 });
    const child = await db.collection("children").findOne({ _id });
    return new Response(JSON.stringify({ child }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[children/:id] PUT error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

// DELETE /api/children/[id]
// Query: ?force=true allows deleting even if enrollments exist (not recommended by default)
export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { id } = params || {};
    let _id;
    try { _id = new ObjectId(String(id)); } catch { return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400 }); }

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    const db = await getDb();
    // Prevent deleting a child that has enrollments unless force
    const existingEnrollments = await db.collection("enrollments").countDocuments({ childId: _id });
    if (existingEnrollments > 0 && !force) {
      return new Response(
        JSON.stringify({ error: "Child has enrollments. Remove them first or use force=true." }),
        { status: 400 }
      );
    }

    await db.collection("enrollments").deleteMany({ childId: _id, ...(force ? {} : { _forceNoop: undefined }) });
    const res = await db.collection("children").deleteOne({ _id });
    if (!res.deletedCount) return new Response(JSON.stringify({ error: "Child not found" }), { status: 404 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("[children/:id] DELETE error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

