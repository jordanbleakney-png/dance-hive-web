import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

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

    // ✅ Update trial record
    const updateResult = await db
      .collection("trialBookings")
      .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

    if (updateResult.matchedCount === 0) {
      await client.close();
      return new Response(JSON.stringify({ error: "Trial not found" }), {
        status: 404,
      });
    }

    const updatedTrial = await db
      .collection("trialBookings")
      .findOne({ _id: new ObjectId(id) });
    console.log("✅ Trial updated:", id, "→", status);

    // 🧩 If converted → create user as "customer" ready for payment
    if (status === "converted" && updatedTrial) {
      const t = updatedTrial;
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
          role: "customer", // ✅ not member yet
          membership: {
            status: "pending",
            plan: null,
            startDate: null,
          },
          password: hashedPassword,
          createdAt: new Date(),
        });
        console.log(`👤 Created new customer: ${t.email}`);
      }
    }

    await client.close();
    return new Response(
      JSON.stringify({ message: `Trial updated to "${status}"` }),
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Update trial error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
