import { getDb } from "@/lib/dbConnect";

export async function GET() {
  try {
    const db = await getDb();
    const allBookings = await db
      .collection("bookings")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return new Response(JSON.stringify(allBookings), { status: 200 });
  } catch (error) {
    console.error("[bookings] Error fetching bookings:", error);
    return new Response(
      JSON.stringify({ message: "Error fetching bookings", error: String(error?.message || error) }),
      { status: 500 }
    );
  }
}
