import { getDb } from "@/lib/dbConnect";

export async function GET() {
  try {
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    return new Response(JSON.stringify({ status: "Connected", collections }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ status: "Connection failed", error: String(error?.message || error) }), { status: 500 });
  }
}
