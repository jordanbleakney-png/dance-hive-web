import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import bcrypt from "bcryptjs"; // âœ… for password hashing

export async function PATCH(req: Request) {
  try {
    // âœ… Authenticate admin
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // âœ… Parse request body
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing id or status" },
        { status: 400 }
      );
    }

    // âœ… Get DB connection
    const db = await getDb();

    // âœ… Find trial first (weâ€™ll need its data if status is "converted")
    const trial = await db.collection("trialBookings").findOne({
      _id: new ObjectId(id),
    });

    if (!trial) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }

    // âœ… Update the trial booking status
    await db.collection("trialBookings").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`âœ… Updated trial ${id} â†’ ${status}`);

    // ðŸ§© If status is converted â†’ auto-create a user account
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
          parentPhone: trial.phone || trial.parentPhone || "",
          phone: trial.phone || trial.parentPhone || "",
          childName: trial.childName || "",
          age: Number(trial.childAge) || null,
          membership: { status: "none", classId: trial.classId || null },
          createdAt: new Date(),
        });

        console.log(`âœ… Created new user for ${trial.email}`);
      } else {
        console.log(
          `â„¹ï¸ User already exists for ${trial.email}, skipping creation`
        );
      }
    }

    return NextResponse.json({ success: true, status }, { status: 200 });
  } catch (err) {
    console.error("âŒ Error updating trial status:", err);
    return NextResponse.json(
      { error: "Failed to update trial" },
      { status: 500 }
    );
  }
}



