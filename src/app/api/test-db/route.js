import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("danceHive"); // replace with your exact database name
    const collections = await db.listCollections().toArray();

    return new Response(
      JSON.stringify({ status: "✅ Connected", collections }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ status: "❌ Connection failed", error: error.message }),
      {
        status: 500,
      }
    );
  }
}
