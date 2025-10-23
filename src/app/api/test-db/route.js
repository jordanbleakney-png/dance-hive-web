import { getDb } from "@/lib/dbConnect";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    return new Response(JSON.stringify({ status: "Connected", collections }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ status: "Connection failed", error: String(error?.message || error) }), { status: 500 });
  }
}
