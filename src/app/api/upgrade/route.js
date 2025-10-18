import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const db = await getDb();
    const result = await db
      .collection("users")
      .updateOne({ email: session.user.email.toLowerCase() }, { $set: { role: "member" } });

    if (result.modifiedCount === 0) {
      return new Response(JSON.stringify({ message: "User not updated" }), { status: 400 });
    }

    return new Response(JSON.stringify({ message: "User upgraded to member" }), { status: 200 });
  } catch (error) {
    console.error("[upgrade] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
