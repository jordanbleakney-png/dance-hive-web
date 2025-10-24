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
        JSON.stringify({ user: null, enrollments: [], payments: [], enrollmentCount: 0 }),
        { status: 200 }
      );
    }

    const payments = await db.collection("payments").find({ email: ci }).toArray();
    const children = await db.collection("children").find({ userId: user._id }).toArray();

    // Enrollments for this user with class + child details
    const enrollments = await db
      .collection("enrollments")
      .aggregate([
        { $match: { userId: user._id } },
        { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } },
        { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "children", localField: "childId", foreignField: "_id", as: "child" } },
        { $unwind: { path: "$child", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, status: 1, createdAt: 1, classId: 1, childId: 1,
            class: { _id: "$class._id", name: "$class.name", day: "$class.day", time: "$class.time", instructor: "$class.instructor" },
            child: { _id: "$child._id", firstName: "$child.firstName", lastName: "$child.lastName", dob: "$child.dob" }
        } },
      ])
      .toArray();

    const enrollmentCount = Array.isArray(enrollments) ? enrollments.length : 0;
    return new Response(
      JSON.stringify({ user, children, enrollments, payments, enrollmentCount }),
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

    // Intentionally ignore embedded child updates; children live in 'children' collection

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
    const children = await db.collection("children").find({ userId: user?._id }).toArray();
    const enrollments = await db
      .collection("enrollments")
      .aggregate([
        { $match: { userId: user?._id } },
        { $lookup: { from: "classes", localField: "classId", foreignField: "_id", as: "class" } },
        { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "children", localField: "childId", foreignField: "_id", as: "child" } },
        { $unwind: { path: "$child", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, status: 1, createdAt: 1, classId: 1, childId: 1, class: { _id: "$class._id", name: "$class.name", day: "$class.day", time: "$class.time", instructor: "$class.instructor" }, child: { _id: "$child._id", firstName: "$child.firstName", lastName: "$child.lastName", dob: "$child.dob" } } },
      ])
      .toArray();

    const enrollmentCount = Array.isArray(enrollments) ? enrollments.length : 0;
    return new Response(JSON.stringify({ user, children, enrollments, payments, enrollmentCount }), { status: 200 });
  } catch (error) {
    console.error("[customers:email] PATCH error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
