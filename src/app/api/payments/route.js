import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const db = await getDb();

    // Load payments first
    const raw = await db
      .collection("payments")
      .find({}, { projection: { email: 1, amount: 1, currency: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray();

    const emails = Array.from(new Set(raw.map((p) => String(p.email).toLowerCase())));

    // Users by email
    const users = await db
      .collection("users")
      .find(
        { email: { $in: emails } },
        { projection: { email: 1, name: 1, parentName: 1, parent: 1 } }
      )
      .toArray();
    const userByEmail = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));

    // Latest trial per email
    const trials = await db
      .collection("trialBookings")
      .aggregate([
        { $match: { email: { $in: emails } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { $toLower: "$email" }, doc: { $first: "$ROOT" } } },
      ])
      .toArray();
    const trialByEmail = new Map(trials.map((t) => [t._id, t.doc]));

    const payments = raw.map((p) => {
      const key = String(p.email).toLowerCase();
      const u = userByEmail.get(key);
      const t = trialByEmail.get(key);
      let parentName = null;
      // Prefer nested user.parent first
      if (u?.parent && (u.parent.firstName || u.parent.lastName)) {
        parentName = `${u.parent.firstName || ""}${u.parent.firstName && u.parent.lastName ? " " : ""}${u.parent.lastName || ""}`.trim();
      }
      // Then legacy fields (name/parentName) if present
      if (!parentName) parentName = u?.name || u?.parentName || null;
      // Then nested trial parent
      if (!parentName && t?.parent && (t.parent.firstName || t.parent.lastName)) {
        parentName = `${t.parent.firstName || ""}${t.parent.firstName && t.parent.lastName ? " " : ""}${t.parent.lastName || ""}`.trim();
      }
      if (!parentName) {
        const local = String(p.email).split("@")[0] || "";
        parentName = local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
      }
      return { ...p, parentName };
    });

    return new Response(JSON.stringify({ payments }), { status: 200 });
  } catch (error) {
    console.error("[payments] Error loading payments:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
