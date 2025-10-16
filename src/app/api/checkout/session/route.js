import Stripe from "stripe";
import { getDb } from "@/lib/dbConnect"; // ✅ Shared MongoDB connection helper

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // ✅ Stripe client

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      console.error("❌ Missing email in request body");
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
      });
    }

    // ✅ Get shared database connection
    const db = await getDb();

    // ✅ Check if user exists before creating session
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      console.error("❌ User not found in database:", email);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    // ✅ Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "DanceHive Membership",
              description: "One weekly class per child — billed monthly.",
            },
            unit_amount: 3000, // £30 in pence
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${
        process.env.NEXT_PUBLIC_BASE_URL
      }/success?email=${encodeURIComponent(email)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
    });

    console.log("✅ Stripe checkout session created for:", email);
    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error("❌ Stripe checkout session error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
