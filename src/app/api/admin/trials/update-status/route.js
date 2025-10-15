import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    console.log("🧠 DEBUG SESSION:", session);

    // 🔒 Must be admin
    if (!session?.user || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // 📦 Parse request
    const { id, status } = await req.json();
    if (!id || !status) {
      return new Response(
        JSON.stringify({ error: "Missing trial ID or status" }),
        { status: 400 }
      );
    }

    // 🗃️ Connect to MongoDB
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // ✅ Update the trial safely
    const updateResult = await db
      .collection("trialBookings")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    if (updateResult.matchedCount === 0) {
      return new Response(JSON.stringify({ error: "Trial not found" }), {
        status: 404,
      });
    }

    // 🧩 Fetch the updated trial
    const updatedTrial = await db
      .collection("trialBookings")
      .findOne({ _id: new ObjectId(id) });

    console.log("✅ Trial updated:", id, "→", status);

    // 🧩 If converted → create user + booking
    if (status === "converted") {
      const t = updatedTrial;

      // Check if user already exists
      const existingUser = await db
        .collection("users")
        .findOne({ email: t.email });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash("dancehive123", 10); // temp password
        await db.collection("users").insertOne({
          parentName: t.parentName,
          email: t.email,
          parentPhone: t.parentPhone,
          childName: t.childName,
          childAge: t.childAge,
          role: "customer",
          membership: {
            status: "active",
            price: 30,
            classId: t.classId,
            startDate: new Date(),
          },
          password: hashedPassword,
          createdAt: new Date(),
        });
      }

      // Create booking record
      await db.collection("bookings").insertOne({
        classId: t.classId,
        email: t.email,
        childName: t.childName,
        status: "member",
        createdAt: new Date(),
      });
    }

    await client.close();

    // ✅ Success response
    return new Response(
      JSON.stringify({
        message: `Trial updated to "${status}"`,
        trial: updatedTrial,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Update trial error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
