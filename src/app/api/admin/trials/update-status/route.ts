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

    await db.collection("trialBookings").updateOne(
      { _id: objectId },
      { $set: { status, updatedAt: new Date() } }
    );

    if (status === "converted") {
      const existingUser = await db.collection("users").findOne({ email: (trial as any)?.email });
      if (!existingUser) {
        const split = (full?: string) => {
          if (!full || typeof full !== "string") return { first: "", last: "" };
          const parts = full.trim().split(/\s+/);
          if (parts.length === 1) return { first: parts[0], last: "" };
          return { first: parts[0], last: parts.slice(1).join(" ") };
        };

        const parentFirstName = (trial as any)?.parent?.firstName || split((trial as any)?.parentName).first;
        const parentLastName = (trial as any)?.parent?.lastName || split((trial as any)?.parentName).last;
        const name = `${parentFirstName || ""}${parentFirstName && parentLastName ? " " : ""}${parentLastName || ""}`.trim() || "New User";

        const childFirstName = (trial as any)?.child?.firstName || split((trial as any)?.childName).first;
        const childLastName = (trial as any)?.child?.lastName || split((trial as any)?.childName).last;
        const childName = `${childFirstName || ""}${childFirstName && childLastName ? " " : ""}${childLastName || ""}`.trim();

        await db.collection("users").insertOne({
          // normalized nested structures to mirror trialBookings
          parent: { firstName: parentFirstName, lastName: parentLastName },
          child: { firstName: childFirstName, lastName: childLastName },

          // primary identifiers
          email: (trial as any)?.email,
          phone: (trial as any)?.phone || (trial as any)?.parentPhone || "",
          role: "customer",
          password: await bcrypt.hash("dancehive123", 10),

          age: Number((trial as any)?.childAge) || null,
          membership: { status: "none", classId: (trial as any)?.classId || null },
          createdAt: new Date(),
        });
      } else {
        // Ensure nested structures exist on existing users as well
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
        await db.collection("users").updateOne(
          { _id: existingUser._id },
          {
            $set: {
              parent: existingUser.parent || { firstName: parentFirstName, lastName: parentLastName },
              child: existingUser.child || { firstName: childFirstName, lastName: childLastName },
              phone: (existingUser as any).phone || (trial as any)?.phone || (trial as any)?.parentPhone || "",
            },
            $unset: { parentPhone: "" },
          }
        );
      }
    }

    return NextResponse.json({ success: true, status }, { status: 200 });
  } catch (err) {
    console.error("[admin/trials:update-status] Error:", err);
    return NextResponse.json({ error: "Failed to update trial" }, { status: 500 });
  }
}
