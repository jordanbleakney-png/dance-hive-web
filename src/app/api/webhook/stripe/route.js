// src/app/api/webhook/stripe/route.js
import Stripe from "stripe";
import mongoose from "mongoose";
import User from "@/models/User.js";
import { MongoClient } from "mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const uri = process.env.MONGODB_URI;

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response("Webhook Error", { status: 400 });
  }

  const { type, data } = event;
  const session = data?.object;

  if (type === "checkout.session.completed") {
    const customerEmail =
      session?.customer_details?.email?.toLowerCase() ||
      session?.customer_email?.toLowerCase();

    if (!customerEmail) {
      console.warn("⚠️ Missing customer email in session");
      return new Response("No email", { status: 200 });
    }

    console.log("✅ Checkout session completed for:", customerEmail);

    // 🧩 Connect to MongoDB (Mongoose + MongoClient)
    await mongoose.connect(process.env.MONGODB_URI);
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // ✅ Find user by any possible email field
    const user =
      (await User.findOne({
        $or: [
          { email: customerEmail },
          { parentEmail: customerEmail },
          { userEmail: customerEmail },
        ],
      })) || null;

    if (!user) {
      console.warn(`⚠️ No user found for ${customerEmail}`);
      await client.close();
      return new Response("User not found", { status: 200 });
    }

    // ✅ Update membership + role
    user.role = "member";
    user.membership = {
      status: "active",
      plan: "standard",
      updatedAt: new Date(),
      lastPaymentDate: new Date(),
    };
    await user.save();

    // ✅ Record payment in 'payments' collection
    await db.collection("payments").insertOne({
      email: customerEmail,
      amount: session.amount_total / 100,
      currency: session.currency?.toUpperCase(),
      payment_status: session.payment_status,
      createdAt: new Date(),
    });

    console.log(
      `🎉 Membership activated and payment logged for ${customerEmail}`
    );

    await client.close();
  }

  return new Response("Success", { status: 200 });
}
