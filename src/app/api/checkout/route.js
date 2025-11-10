import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

// Start a GoCardless Redirect Flow and return a URL
export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create a session token and prefill details
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: session.user.email });
    const givenName = user?.parent?.firstName || (session.user.name || "").split(" ")[0] || "";
    const familyName = user?.parent?.lastName || (session.user.name || "").split(" ").slice(1).join(" ") || "";
    const sessionToken = crypto.randomUUID();

    const base = process.env.GOCARDLESS_ENV === "live"
      ? "https://api.gocardless.com"
      : "https://api-sandbox.gocardless.com";

    const body = {
      redirect_flows: {
        session_token: sessionToken,
        description: "Dance Hive Membership",
        success_redirect_url: `${origin}/success`,
        prefilled_customer: {
          given_name: givenName,
          family_name: familyName,
          email: session.user.email,
        },
      },
    };

    const resp = await fetch(`${base}/redirect_flows`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
        "GoCardless-Version": "2015-07-06",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`GoCardless create redirect flow failed: ${t}`);
    }
    const data = await resp.json();
    const url = data?.redirect_flows?.redirect_url;
    const rfId = data?.redirect_flows?.id;
    if (!url) throw new Error("Missing redirect_url from GoCardless");

    // Store the session token so we can complete the flow on return
    await db.collection("users").updateOne(
      { email: session.user.email },
      { $set: { "membership.gc_session_token": sessionToken, updatedAt: new Date() } },
      { upsert: true }
    );

    return new Response(JSON.stringify({ url, redirect_flow_id: rfId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[checkout/gc] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
  }
}

// Node >=18: crypto is global, but import fallback for type clarity
import crypto from "crypto";

