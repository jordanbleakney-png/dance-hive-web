import Stripe from "stripe";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ email: session.user.email });
    if (!user) throw new Error("User not found");

    // Create a subscription checkout session (monthly £30)
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "Dance Hive Membership", description: "Monthly membership (one class per week)" },
            unit_amount: 3000,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get("origin")}/success`,
      cancel_url: `${req.headers.get("origin")}/dashboard`,
    });

    return new Response(JSON.stringify({ url: checkoutSession.url }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[checkout] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
  }
}
