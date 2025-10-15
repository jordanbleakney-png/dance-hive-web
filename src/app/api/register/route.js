import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";

const uri = process.env.MONGODB_URI;

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ message: "All fields are required" }),
        { status: 400 }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");
    const users = db.collection("users");

    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return new Response(JSON.stringify({ message: "User already exists" }), {
        status: 400,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await users.insertOne({
      name,
      email,
      password: hashedPassword,
      role: "customer",
      createdAt: new Date(),
    });

    return new Response(
      JSON.stringify({ message: "✅ Account created successfully" }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return new Response(
      JSON.stringify({
        message: "❌ Registration failed",
        error: error.message,
      }),
      { status: 500 }
    );
  }
}
