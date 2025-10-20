import { NextResponse } from "next/server";
import { getDb } from "@/lib/dbConnect";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    // ✅ Authenticate and authorize
    const session = await auth();

    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    // ✅ Use shared MongoDB connection
    const db = await getDb();

    // ✅ Fetch all trial bookings
    const trials = await db.collection("trialBookings").find().toArray();

    // ✅ Optional: fetch all users for enrichment
    const users = await db.collection("users").find().toArray();

    // ✅ Combine trials with related user info if available
    const trialsWithUsers = trials.map((trial) => {
      const user = users.find(
        (u) => u._id.toString() === trial.userId?.toString()
      );

      const parentFullName = [trial?.parent?.firstName, trial?.parent?.lastName]
        .filter(Boolean)
        .join(" ") || trial.parentName || "";

      const childFullName = [trial?.child?.firstName, trial?.child?.lastName]
        .filter(Boolean)
        .join(" ") || trial.childName || "";

      const phone = trial.phone || trial.parentPhone || null;

      return {
        ...trial,
        parentFullName,
        childFullName,
        phone,
        user: user
          ? { name: user.name, email: user.email, role: user.role }
          : null,
      };
    });

    // ✅ Return consistent JSON shape for frontend
    return NextResponse.json(
      { success: true, trials: trialsWithUsers },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching trials:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch trial bookings" },
      { status: 500 }
    );
  }
}
