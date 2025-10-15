import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // ✅ create Stripe client

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      console.error("❌ Missing email in request body");
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
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
    console.error("❌ Stripe checkout session error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
