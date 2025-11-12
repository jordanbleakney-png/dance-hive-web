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
    const q = String(url.searchParams.get("q") || "").trim();
    const db = await getDb();

    // Allow searching both members and customers (restored previous members will be customers)
    const match: any = { role: { $in: ["member", "customer"] } };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      match.$or = [
        { email: { $regex: rx } },
        { "parent.firstName": { $regex: rx } },
        { "parent.lastName": { $regex: rx } },
      ];
    }

    const users = await db
      .collection("users")
      .find(match, { projection: { parent: 1, email: 1, role: 1 } as any })
      .limit(20)
      .toArray();

    // attach children for each user, including enrolled class ids per child
    const results = [] as any[];
    for (const u of users) {
      const children = await db
        .collection("children")
        .find({ userId: u._id })
        .project({ firstName: 1, lastName: 1, dob: 1 })
        .toArray();

      const childrenWithEnrollments = [] as any[];
      for (const c of children) {
        const enrols = await db
          .collection("enrollments")
          .find({ childId: c._id, status: "active" })
          .project({ classId: 1 })
          .toArray();
        const enrolledClassIds = enrols.map((e: any) => String(e.classId));
        childrenWithEnrollments.push({
          _id: c._id,
          firstName: (c as any).firstName,
          lastName: (c as any).lastName,
          dob: (c as any).dob || null,
          enrolledClassIds,
        });
      }

      results.push({ userId: String(u._id), parent: u.parent || null, email: u.email, role: u.role, children: childrenWithEnrollments });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[admin/members/search] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
