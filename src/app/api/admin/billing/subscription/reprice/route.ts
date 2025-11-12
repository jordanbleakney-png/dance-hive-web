import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.role || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const db = await getDb();
    const user = await db.collection("users").findOne({ email: String(email).toLowerCase() });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userId = (user as any)._id as ObjectId;

    const activeCount = await db.collection("enrollments").countDocuments({ userId, status: "active" });
    const priceFor = (n: number) => {
      if (!n || n <= 1) return 3000; // £30
      if (n === 2) return 5500;      // £55
      if (n >= 3) return 7500;       // £75 cap
      return 3000;
    };
    const newAmount = priceFor(activeCount);

    const subId = (user as any)?.membership?.gocardless_subscription_id || null;
    let gcStatus: any = null;
    if (subId) {
      try {
        const base = process.env.GOCARDLESS_ENV === 'live' ? 'https://api.gocardless.com' : 'https://api-sandbox.gocardless.com';
        const r = await fetch(`${base}/subscriptions/${subId}/actions/update`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN || ''}`,
            'GoCardless-Version': '2015-07-06',
            'Content-Type': 'application/json',
            'Idempotency-Key': `admin-reprice:${String(userId)}:${newAmount}`,
          },
          body: JSON.stringify({ subscriptions: { amount: String(newAmount) } }),
        });
        gcStatus = r.status;
      } catch (e) {
        gcStatus = 'error';
      }
    }

    try {
      await db.collection('membershipHistory').insertOne({
        email: (user as any).email,
        event: 'subscription_amount_updated',
        amount: newAmount / 100,
        enrollments: activeCount,
        provider: 'GoCardless',
        timestamp: new Date(),
      });
    } catch {}

    return NextResponse.json({ ok: true, amount: newAmount, gcStatus }, { status: 200 });
  } catch (err) {
    console.error('[admin/billing/subscription/reprice] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

