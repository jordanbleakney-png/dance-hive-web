import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const allowed: Record<string, any> = {};
    // Optional basic fields we already supported
    if (typeof body.name === "string") allowed["name"] = body.name;
    if (typeof body.parentPhone === "string") allowed["parentPhone"] = body.parentPhone;
    if (typeof body.medical === "string") allowed["medical"] = body.medical;
    if (body.emergencyContact && typeof body.emergencyContact === "object") {
      allowed["emergencyContact"] = {
        name: String(body.emergencyContact.name || ""),
        phone: String(body.emergencyContact.phone || ""),
        relation: String(body.emergencyContact.relation || ""),
      };
    }

    // Address block
    if (body.address && typeof body.address === "object") {
      allowed["address"] = {
        houseNumber: String(body.address.houseNumber || ""),
        street: String(body.address.street || ""),
        city: String(body.address.city || ""),
        county: String(body.address.county || ""),
        postcode: String(body.address.postcode || ""),
      };
    }

    // Child date of birth → nested under child.dob
    if (body.childDob) {
      const d = new Date(body.childDob);
      if (!isNaN(d.getTime())) {
        allowed["child.dob"] = d;
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const db = await getDb();
    await db.collection("users").updateOne(
      { email: session.user.email },
      { $set: { ...allowed, updatedAt: new Date(), onboardingComplete: true } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[account/profile] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


