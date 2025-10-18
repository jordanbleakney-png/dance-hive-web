import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { email, newRole } = await req.json();
    if (!email || !newRole) {
      return new Response(JSON.stringify({ error: "Missing email or newRole" }), { status: 400 });
    }

    const db = await getDb();
    const result = await db
      .collection("users")
      .updateOne({ email: email.toLowerCase() }, { $set: { role: newRole } });

    return new Response(
      JSON.stringify({ success: true, updatedCount: result.modifiedCount }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[customers:update-role] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
