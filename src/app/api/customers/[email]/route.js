import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function GET(_req, context) {
  try {
    const { email } = context.params;
    const session = await auth();

    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const decodedEmail = decodeURIComponent(email);
    const db = await getDb();

    // Case-insensitive match
    const ci = { $regex: new RegExp(`^${decodedEmail}$`, "i") };
    const user = await db.collection("users").findOne({ email: ci });

    if (!user) {
      return new Response(
        JSON.stringify({ user: null, enrollments: [], payments: [] }),
        { status: 200 }
      );
    }

    const payments = await db.collection("payments").find({ email: ci }).toArray();

    // Enrollments for this user with class details
    const enrollments = await db
      .collection("enrollments")
      .aggregate([
        { $match: { userId: user._id } },
        {
          $lookup: {
            from: "classes",
            localField: "classId",
            foreignField: "_id",
            as: "class",
          },
        },
        { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            status: 1,
            createdAt: 1,
            class: {
              _id: "$class._id",
              name: "$class.name",
              day: "$class.day",
              time: "$class.time",
              instructor: "$class.instructor",
            },
          },
        },
      ])
      .toArray();

    return new Response(
      JSON.stringify({ user, enrollments, payments }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[customers:email] Error fetching customer details:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}

export async function PATCH(req, context) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { email } = context.params;
    const decodedEmail = decodeURIComponent(email);
    const db = await getDb();

    const body = await req.json();

    // Build allowed updates only
    const set = {};

    if (typeof body.phone === "string") set.phone = body.phone;

    if (body.parent && (body.parent.firstName != null || body.parent.lastName != null)) {
      set["parent.firstName"] = body.parent.firstName ?? undefined;
      set["parent.lastName"] = body.parent.lastName ?? undefined;
    }

    if (body.child && (body.child.firstName != null || body.child.lastName != null || body.child.dob != null)) {
      set["child.firstName"] = body.child.firstName ?? undefined;
      set["child.lastName"] = body.child.lastName ?? undefined;
      if (body.child.dob != null) {
        const d = new Date(body.child.dob);
        if (!isNaN(d)) set["child.dob"] = d.toISOString();
      }
    }

    if (body.address) {
      const a = body.address;
      if (a.houseNumber != null) set["address.houseNumber"] = a.houseNumber;
      if (a.street != null) set["address.street"] = a.street;
      if (a.city != null) set["address.city"] = a.city;
      if (a.county != null) set["address.county"] = a.county;
      if (a.postcode != null) set["address.postcode"] = a.postcode;
    }

    if (body.emergencyContact) {
      const e = body.emergencyContact;
      if (e.name != null) set["emergencyContact.name"] = e.name;
      if (e.phone != null) set["emergencyContact.phone"] = e.phone;
      if (e.relation != null) set["emergencyContact.relation"] = e.relation;
    }

    if (body.medical != null) set.medical = String(body.medical);

    // Clean undefined keys (Mongo will create fields with undefined otherwise in some drivers)
    for (const k of Object.keys(set)) {
      if (set[k] === undefined) delete set[k];
    }

    if (Object.keys(set).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), { status: 400 });
    }

    set.updatedAt = new Date();

    const ci = { $regex: new RegExp(`^${decodedEmail}$`, "i") };
    await db.collection("users").updateOne({ email: ci }, { $set: set });

    // Return the same shape as GET after update
    const user = await db.collection("users").findOne({ email: ci });
    const payments = await db.collection("payments").find({ email: ci }).toArray();
    const enrollments = await db
      .collection("enrollments")
      .aggregate([
        { $match: { userId: user?._id } },
        { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } },
        { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, status: 1, createdAt: 1, class: { _id: "$class._id", name: "$class.name", day: "$class.day", time: "$class.time", instructor: "$class.instructor" } } },
      ])
      .toArray();

    return new Response(JSON.stringify({ user, enrollments, payments }), { status: 200 });
  } catch (error) {
    console.error("[customers:email] PATCH error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
