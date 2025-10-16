import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import bcrypt from "bcryptjs"; // ✅ for password hashing

export async function PATCH(req: Request) {
  try {
    // ✅ Authenticate admin
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Parse request body
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing id or status" },
        { status: 400 }
      );
    }

    // ✅ Get DB connection
    const db = await getDb();

    // ✅ Find trial first (we’ll need its data if status is "converted")
    const trial = await db.collection("trialBookings").findOne({
      _id: new ObjectId(id),
    });

    if (!trial) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }

    // ✅ Update the trial booking status
    await db.collection("trialBookings").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ Updated trial ${id} → ${status}`);

    // 🧩 If status is converted → auto-create a user account
    if (status === "converted") {
      const existingUser = await db
        .collection("users")
        .findOne({ email: trial.email });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash("dancehive123", 10);

        await db.collection("users").insertOne({
          name: trial.parentName || trial.childName || "New User",
          email: trial.email,
          password: hashedPassword,
          role: "customer",
          createdAt: new Date(),
        });

        console.log(`✅ Created new user for ${trial.email}`);
      } else {
        console.log(
          `ℹ️ User already exists for ${trial.email}, skipping creation`
        );
      }
    }

    return NextResponse.json({ success: true, status }, { status: 200 });
  } catch (err) {
    console.error("❌ Error updating trial status:", err);
    return NextResponse.json(
      { error: "Failed to update trial" },
      { status: 500 }
    );
  }
}
