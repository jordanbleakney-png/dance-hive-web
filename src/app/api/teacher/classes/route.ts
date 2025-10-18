import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

// GET /api/teacher/classes
// Returns classes for the logged-in teacher, filtered by instructor name match
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.role || (session.user.role !== "teacher" && session.user.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();

    // For now, match classes by instructor = session.user.name, admins see all
    const query = session.user.role === "admin" ? {} : { instructor: session.user.name };
    const classes = await db.collection("classes").find(query).toArray();
    return NextResponse.json(classes);
  } catch (err) {
    console.error("[teacher/classes] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

