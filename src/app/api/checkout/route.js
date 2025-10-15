import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { MongoClient } from "mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const uri = process.env.MONGODB_URI;

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
    });
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    const user = await db
      .collection("users")
      .findOne({ email: session.user.email });
    if (!user) throw new Error("User not found");

    // Create a Stripe Checkout Session
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

    return new Response(JSON.stringify({ url: checkoutSession.url }), {
      status: 200,
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
