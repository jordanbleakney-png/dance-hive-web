import clientPromise from "@/lib/mongodb";

export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db("danceHive");
    const bookings = db.collection("bookings");

    const data = await request.json();

    // Add a timestamp and default status
    const booking = {
      ...data,
      status: "trial",
      createdAt: new Date(),
    };

    const result = await bookings.insertOne(booking);

    return new Response(
      JSON.stringify({
        message: "✅ Booking added successfully",
        insertedId: result.insertedId,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Booking insert error:", error);
    return new Response(
      JSON.stringify({
        message: "❌ Error adding booking",
        error: error.message,
      }),
      { status: 500 }
    );
  }
}
