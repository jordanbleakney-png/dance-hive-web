import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Current and new password (min 8 chars) required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ email: session.user.email });
    if (!user || !user.password) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(String(currentPassword), String(user.password));
    if (!valid) {
      return NextResponse.json({ error: "Invalid current password" }, { status: 403 });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await db.collection("users").updateOne(
      { email: user.email },
      { $set: { password: hashed, passwordUpdatedAt: new Date(), onboardingComplete: true } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[account/change-password] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
