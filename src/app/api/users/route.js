import { getDb } from "@/lib/dbConnect";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get("email") || "").toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
    }

    const session = await auth();
    const isAdmin = session?.user?.role === "admin";
    const isSelf = session?.user?.email && session.user.email.toLowerCase() === email;
    if (!isAdmin && !isSelf) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne({ email }, { projection: { _id: 0, role: 1, membership: 1 } });

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(user), { status: 200 });
  } catch (err) {
    console.error("[users] Error fetching user status:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
