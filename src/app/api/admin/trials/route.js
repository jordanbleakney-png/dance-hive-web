import { NextResponse } from "next/server";
import { getDb } from "@/lib/dbConnect";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const db = await getDb();
    const trials = await db.collection("trialBookings").find().toArray();
    const users = await db.collection("users").find().toArray();

    const userByEmail = new Map(
      users.map((u) => [String(u.email || "").toLowerCase(), u])
    );

    const enriched = trials.map((trial) => {
      const u = userByEmail.get(String(trial.email || "").toLowerCase());
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
        user: u
          ? { name: u.name, email: u.email, role: u.role, membership: u.membership || null }
          : null,
      };
    });

    // Remove trials once the associated user is a member or trial/user archived
    const prevEmailsArr = await db.collection('previousCustomers').find({}).project({ email: 1 }).toArray();
    const prevEmails = new Set(prevEmailsArr.map((d)=> String(d.email || '').toLowerCase()));
    const filtered = enriched.filter((t) => {
      const m = t.user?.membership?.status;
      const isMember = t.user?.role === "member" || m === "active";
      const isArchivedTrial = String(t.status || '').toLowerCase() === 'archived';
      const isArchivedUser = prevEmails.has(String(t.email || '').toLowerCase());
      return !isMember && !isArchivedTrial && !isArchivedUser;
    });

    return NextResponse.json({ success: true, trials: filtered }, { status: 200 });
  } catch (error) {
    console.error("[admin/trials] Error fetching trials:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch trial bookings" },
      { status: 500 }
    );
  }
}
