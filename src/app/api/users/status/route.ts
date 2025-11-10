import { NextResponse } from "next/server";
import { getDb } from "@/lib/dbConnect"; // Unified DB helper

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Use shared DB connection
    const db = await getDb();

    const user = await db.collection("users").findOne(
      { email: email.toLowerCase() },
      {
        projection: {
          _id: 0,
          email: 1,
          role: 1,
          membership: 1,
          onboardingComplete: 1,
        },
        sort: { updatedAt: -1, _id: -1 },
      }
    );

    // Return default guest response if user not found
    if (!user) {
      return NextResponse.json({
        email,
        role: "guest",
        membership: { status: "none" },
      });
    }

    // Return found user data
    return NextResponse.json(user);
  } catch (error) {
    console.error("[status] Error fetching user status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
