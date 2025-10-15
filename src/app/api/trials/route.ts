import { NextRequest, NextResponse } from "next/server";
import { connectMongoClient } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { childName, childAge, parentName, email, parentPhone, classId } =
      body;

    // ✅ Validate fields from frontend form
    if (
      !childName ||
      !childAge ||
      !parentName ||
      !email ||
      !parentPhone ||
      !classId
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Connect to database
    const client = await connectMongoClient();
    const db = client.db("danceHive");

    // ✅ Fetch class details (for display/reference)
    const selectedClass = await db
      .collection("classes")
      .findOne({ _id: new ObjectId(classId) });

    // ✅ Create the trial booking record
    const result = await db.collection("trialBookings").insertOne({
      childName,
      childAge,
      parentName,
      email,
      parentPhone,
      classId,
      className: selectedClass?.name || "Unknown Class",
      classDay: selectedClass?.day || "",
      classTime: selectedClass?.time || "",
      createdAt: new Date(),
      status: "pending",
    });

    console.log("✅ New trial booking created:", result.insertedId);

    return NextResponse.json(
      { message: "Trial booked successfully!", id: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error creating trial booking:", error);
    return NextResponse.json(
      { error: "Failed to book trial" },
      { status: 500 }
    );
  }
}
