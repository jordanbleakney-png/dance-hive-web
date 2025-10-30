import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const db = await getDb();
    await db.collection('users').updateOne(
      { email: session.user.email },
      { $unset: { 'flags.memberWelcomePending': '' }, $set: { updatedAt: new Date() } }
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ack-member-welcome] error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

