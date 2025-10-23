import { getDb } from "@/lib/dbConnect";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
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
