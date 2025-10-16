import Stripe from "stripe";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/dbConnect"; // ✅ shared DB helper

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const session = await auth();

    // 🔒 Ensure user is authenticated
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }

    // ✅ Use shared DB connection
    const db = await getDb();

    // 🧩 Find user in DB
    const user = await db
      .collection("users")
      .findOne({ email: session.user.email });

    if (!user) {
      throw new Error("User not found");
    }

    // 💳 Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Dance Hive Membership",
              description: "Unlimited dance classes per month",
            },
            unit_amount: 3000, // £30.00
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/success`,
      cancel_url: `${req.headers.get("origin")}/dashboard`,
    });

    console.log(`✅ Stripe Checkout session created for: ${user.email}`);

    // ✅ Return checkout session URL
    return new Response(JSON.stringify({ url: checkoutSession.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500 }
    );
  }
}
