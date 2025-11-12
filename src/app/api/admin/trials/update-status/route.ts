import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = await getDb();
    const objectId = new ObjectId(id);

    const trial = await db.collection("trialBookings").findOne({ _id: objectId });
    if (!trial) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }

    const now = new Date();
    const setUpdate: any = { status, updatedAt: now };
    const unsetUpdate: any = {} as any;
    if (status === "attended") {
      setUpdate.attendedAt = now;
      unsetUpdate.absentAt = "";
    } else if (status === "absent") {
      setUpdate.absentAt = now;
      unsetUpdate.attendedAt = "";
    } else if (status === "pending") {
      // Reset attendance timestamps when moving back to pending
      unsetUpdate.attendedAt = "";
      unsetUpdate.absentAt = "";
    }
    await db.collection("trialBookings").updateOne(
      { _id: objectId },
      { $set: setUpdate, ...(Object.keys(unsetUpdate).length ? { $unset: unsetUpdate } : {}) }
    );

    if (status === "converted") {
      // If this is a member trial, just enroll the child into the class (no user creation)
      if ((trial as any)?.isMemberTrial) {
        try {
          const userId = new ObjectId(String((trial as any).existingUserId));
          const childId = new ObjectId(String((trial as any).childId));
          const classId = new ObjectId(String((trial as any).classId));

          const cls = await db.collection("classes").findOne({ _id: classId });
          if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
          const cap = Number((cls as any).capacity || 0);
          if (cap > 0) {
            const enrolled = await db.collection("enrollments").countDocuments({ classId, status: "active" });
            if (enrolled >= cap) {
              return NextResponse.json({ error: "Class is at capacity" }, { status: 400 });
            }
          }

          const payload: any = {
            userId,
            childId,
            classId,
            status: "active",
            attendedDates: [],
            createdAt: new Date(),
          };
          await db.collection("enrollments").updateOne(
            { userId: payload.userId, childId: payload.childId, classId: payload.classId },
            { $setOnInsert: payload },
            { upsert: true }
          );

          try {
            await db.collection("membershipHistory").insertOne({
              email: (trial as any)?.email || null,
              event: "trial_converted_extra_class",
              classId,
              childId,
              provider: "internal",
              timestamp: new Date(),
            });
          } catch {}

          return NextResponse.json({ success: true, status }, { status: 200 });
        } catch (e) {
          console.error("[admin/trials:update-status] member-trial convert error", e);
          return NextResponse.json({ error: "Conversion failed" }, { status: 500 });
        }
      }

      const split = (full?: string) => {
        if (!full || typeof full !== "string") return { first: "", last: "" };
        const parts = full.trim().split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: "" };
        return { first: parts[0], last: parts.slice(1).join(" ") };
      };

      const parentFirstName = (trial as any)?.parent?.firstName || split((trial as any)?.parentName).first;
      const parentLastName = (trial as any)?.parent?.lastName || split((trial as any)?.parentName).last;
      const childFirstName = (trial as any)?.child?.firstName || split((trial as any)?.childName).first;
      const childLastName = (trial as any)?.child?.lastName || split((trial as any)?.childName).last;

      const email = (trial as any)?.email;
      const phone = (trial as any)?.phone || (trial as any)?.parentPhone || "";
      const childAge = Number((trial as any)?.childAge) || null;

      let user = await db.collection("users").findOne({ email });
      let userId: ObjectId;
      if (!user) {
        const insert = await db.collection("users").insertOne({
          parent: { firstName: parentFirstName, lastName: parentLastName },
          email,
          phone,
          role: "customer",
          password: await bcrypt.hash("dancehive123", 10),
          age: childAge,
          membership: { status: "none", classId: (trial as any)?.classId || null },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        userId = insert.insertedId as ObjectId;
      } else {
        userId = (user as any)._id as ObjectId;
        await db.collection("users").updateOne(
          { _id: userId },
          {
            $set: {
              parent: (user as any)?.parent || { firstName: parentFirstName, lastName: parentLastName },
              phone: (user as any)?.phone || phone,
              updatedAt: new Date(),
            },
            $unset: { parentPhone: "" },
          }
        );
      }

      // Ensure a child document exists for this user
      const userDocForChild = await db.collection("users").findOne({ _id: userId }, { projection: { child: 1, medical: 1 } });
      const parseDob = (val: any): Date | null => {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };
      const dobFromUser = parseDob((userDocForChild as any)?.child?.dob);
      const dobFromTrial = parseDob((trial as any)?.child?.dob || (trial as any)?.childDob || (trial as any)?.dob);
      const dobToUse = dobFromUser || dobFromTrial || null;

      const existingChild = await db.collection("children").findOne({
        userId,
        firstName: childFirstName,
        lastName: childLastName,
      });
      let childId: ObjectId | null = null;
      if (!existingChild) {
        const insChild = await db.collection("children").insertOne({
          userId,
          firstName: childFirstName,
          lastName: childLastName,
          dob: dobToUse ? (dobToUse as Date).toISOString() : null,
          medical: (userDocForChild as any)?.medical || "",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        childId = insChild.insertedId as ObjectId;
      } else {
        childId = existingChild._id as ObjectId;
        // Backfill DOB if missing and we have one
        if (!(existingChild as any).dob && dobToUse) {
          await db.collection("children").updateOne(
            { _id: childId },
            { $set: { dob: (dobToUse as Date).toISOString(), updatedAt: new Date() } }
          );
        }
      }

      // Set primaryChildId if absent
      await db.collection("users").updateOne(
        { _id: userId, primaryChildId: { $exists: false } },
        { $set: { primaryChildId: childId } }
      );
    }

    return NextResponse.json({ success: true, status }, { status: 200 });
  } catch (err) {
    console.error("[admin/trials:update-status] Error:", err);
    return NextResponse.json({ error: "Failed to update trial" }, { status: 500 });
  }
}
