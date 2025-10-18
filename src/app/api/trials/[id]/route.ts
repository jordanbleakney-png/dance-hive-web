import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/dbConnect";

// GET /api/trials/[id]
// Returns a single trial booking by its ObjectId
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = await getDb();
    const trial = await db.collection("trialBookings").findOne({ _id: objectId });

    if (!trial) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(trial, { status: 200 });
  } catch (error) {
    console.error("[trials:id] GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

