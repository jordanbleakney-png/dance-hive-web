import { NextResponse } from "next/server";
import { getDb } from "@/lib/dbConnect";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";

// GET /api/admin/follow-ups
// Returns trial bookings marked as attended (not converted/archived/previous customer)
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const db = await getDb();

    // Optional filter: ?status=attended|absent ; default includes both
    const url = new URL(req.url);
    const statusParam = String(url.searchParams.get('status') || '').toLowerCase();
    const allowed = ['attended','absent'];
    const statuses = allowed.includes(statusParam) ? [statusParam] : allowed;
    const contactedParam = url.searchParams.get('contacted');
    let contactedFilter: any = undefined;
    if (contactedParam === 'true') contactedFilter = true;
    if (contactedParam === 'false') contactedFilter = { $ne: true };

    // Pull trials with desired statuses
    const trials = await db
      .collection("trialBookings")
      .find({ status: { $in: statuses }, ...(contactedFilter !== undefined ? { contacted: contactedFilter } : {}) })
      .project({ parent: 1, child: 1, parentName: 1, childName: 1, email: 1, phone: 1, createdAt: 1, attendedAt: 1, absentAt: 1, trialDate: 1, status: 1, classId: 1, contacted: 1, contactedAt: 1, notes: 1, notesUpdatedAt: 1 })
      .toArray();

    // Build class name map for the trials' classIds
    let classNameById = new Map<string, string>();
    try {
      const rawIds = Array.from(
        new Set(
          trials
            .map((t: any) => (t?.classId != null ? String(t.classId) : null))
            .filter((v: any) => !!v)
        )
      );
      const objIds: any[] = [];
      for (const s of rawIds) {
        try { objIds.push(new ObjectId(String(s))); } catch {}
      }
      if (objIds.length) {
        const classes = await db
          .collection('classes')
          .find({ _id: { $in: objIds as any } }, { projection: { name: 1 } } as any)
          .toArray();
        classes.forEach((c: any) => {
          classNameById.set(String(c._id), String(c?.name || ''));
        });
      }
    } catch {}

    // Exclude already-active members only. Previous customers who re-booked should be included.
    const emails = Array.from(new Set(trials.map((t: any) => String(t.email || '').toLowerCase()).filter(Boolean)));
    let memberEmails = new Set<string>();
    if (emails.length) {
      const users = await db.collection('users').find({ email: { $in: emails } }).project({ email: 1, role: 1, membership: 1 } as any).toArray();
      users.forEach((u: any) => {
        if (u?.role === 'member' || u?.membership?.status === 'active') {
          memberEmails.add(String(u.email || '').toLowerCase());
        }
      });
    }

    const rows = trials
      .filter((t: any) => {
        const emailKey = String(t.email || '').toLowerCase();
        return !memberEmails.has(emailKey);
      })
      .map((t: any) => ({
        _id: t._id,
        parentFullName: [t?.parent?.firstName, t?.parent?.lastName].filter(Boolean).join(' ') || t.parentName || '',
        childFullName: [t?.child?.firstName, t?.child?.lastName].filter(Boolean).join(' ') || t.childName || '',
        phone: t.phone || '',
        email: t.email || '',
        classId: t.classId || null,
        className: classNameById.get(String(t.classId || '')) || String(t.className || ''),
        trialDate: t.trialDate || null,
        attendedAt: t.attendedAt || null,
        absentAt: t.absentAt || null,
        status: t.status || null,
        contacted: Boolean((t as any)?.contacted),
        contactedAt: (t as any)?.contactedAt || null,
        notes: (t as any)?.notes || "",
        notesUpdatedAt: (t as any)?.notesUpdatedAt || null,
      }));

    return NextResponse.json({ success: true, rows });
  } catch (err) {
    console.error("[admin/follow-ups] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch follow ups" }, { status: 500 });
  }
}

// PATCH /api/admin/follow-ups
// Body: { id: string, contacted: boolean }
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body || {};
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    let _id: ObjectId;
    try { _id = new ObjectId(String(id)); } catch { return NextResponse.json({ error: "Invalid id" }, { status: 400 }); }

    const db = await getDb();
    const update: any = { updatedAt: new Date() };
    if (typeof body.contacted === 'boolean') {
      update.contacted = body.contacted;
      update.contactedAt = body.contacted ? new Date() : null;
    }
    if (typeof body.notes === 'string') {
      update.notes = body.notes;
      update.notesUpdatedAt = new Date();
    }
    if (Object.keys(update).length <= 1) { // only updatedAt present
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    const res = await db.collection('trialBookings').updateOne({ _id }, { $set: update });
    if (res.matchedCount === 0) return NextResponse.json({ error: 'Trial not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/follow-ups] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update follow up' }, { status: 500 });
  }
}
