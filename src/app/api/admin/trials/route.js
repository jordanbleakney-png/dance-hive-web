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
      // derive child age if missing
      let childAge = trial.childAge;
      if (childAge == null) {
        const embeddedAge = trial?.child?.age;
        if (typeof embeddedAge === 'number') childAge = embeddedAge;
        else {
          const dob = trial?.child?.dob || trial?.childDob || trial?.dob;
          if (dob) {
            const d = new Date(dob);
            if (!isNaN(d.getTime())) {
              const now = new Date();
              let a = now.getFullYear() - d.getFullYear();
              const m = now.getMonth() - d.getMonth();
              if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
              childAge = a;
            }
          }
        }
      }
      return {
        ...trial,
        parentFullName,
        childFullName,
        phone,
        childAge: childAge ?? null,
        user: u
          ? { name: u.name, email: u.email, role: u.role, membership: u.membership || null }
          : null,
      };
    });

    // Remove trials once the associated user is a member or trial/user archived
    const prevEmailsArr = await db.collection('previousCustomers').find({}).project({ email: 1 }).toArray();
    const prevEmails = new Set(prevEmailsArr.map((d)=> String(d.email || '').toLowerCase()));
    const filtered = enriched.filter((t) => {
      const status = String(t.status || '').toLowerCase();
      const isConverted = status === 'converted';
      if (isConverted) return false; // hide converted trials from list (incl. member trials)
      const m = t.user?.membership?.status;
      const isMember = t.user?.role === "member" || m === "active";
      const hasUserNow = Boolean(t.user);
      const isArchivedTrial = status === 'archived';
      // Always show newly created public trials (pending) even if the email exists in previousCustomers
      // so that archived users who re-book are visible for action
      if (status === 'pending') return true;
      // Show attended/absent trials for follow-up, but not for already-active members,
      // and hide if they are already contacted (cold list)
      if (status === 'attended' || status === 'absent') return !isMember && !Boolean(t.contacted);
      // Member-originated trials should only be shown while the user still exists and the trial isn't archived
      if (t?.isMemberTrial) return hasUserNow && !isArchivedTrial;
      // Only treat as archived when the user no longer exists. Restored users keep a snapshot in previousCustomers.
      const isArchivedUser = prevEmails.has(String(t.email || '').toLowerCase()) && !hasUserNow;
      const isContacted = Boolean(t.contacted);
      return !isMember && !isArchivedTrial && !isArchivedUser && !isContacted;
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
