import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").toLowerCase();
    const db = await getDb();
    const baseMatch: any = { $or: [{ restoredAt: { $exists: false } }, { restoredAt: null }] };
    const match: any = q ? { ...baseMatch, email: { $regex: q, $options: "i" } } : baseMatch;
    const raw = await db
      .collection("previousCustomers")
      .find(match, { projection: { email: 1, archivedAt: 1, archivedBy: 1, reason: 1, restoredAt: 1, "snapshot.user.parent": 1, "snapshot.user.child": 1, "snapshot.children": 1 } })
      .sort({ archivedAt: -1 })
      .limit(200)
      .toArray();

    const items = raw.map((doc: any) => {
      const parent = doc?.snapshot?.user?.parent || {};
      const childrenArr: any[] = Array.isArray(doc?.snapshot?.children) ? doc.snapshot.children : [];
      const firstChild = childrenArr[0] || doc?.snapshot?.user?.child || {};
      const parentName = [parent.firstName, parent.lastName].filter(Boolean).join(" ");
      const childName = [firstChild.firstName, firstChild.lastName].filter(Boolean).join(" ");
      return {
        email: doc.email,
        archivedAt: doc.archivedAt,
        archivedBy: doc.archivedBy,
        restoredAt: doc.restoredAt,
        reason: doc.reason,
        parentName,
        childName,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[admin/previous-customers] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
