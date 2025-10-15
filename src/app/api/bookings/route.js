import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("danceHive");
    const bookings = db.collection("bookings");

    const allBookings = await bookings
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return new Response(JSON.stringify(allBookings), { status: 200 });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return new Response(
      JSON.stringify({
        message: "Error fetching bookings",
        error: error.message,
      }),
      { status: 500 }
    );
  }
}
