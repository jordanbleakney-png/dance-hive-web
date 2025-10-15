import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      parentName,
      email,
      parentPhone,
      childName,
      childAge,
      classId,
      password,
    } = body;

    if (
      !parentName ||
      !email ||
      !childName ||
      !childAge ||
      !classId ||
      !password
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
        }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("danceHive");

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email });

    if (existingUser) {
      await client.close();
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 400,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      parentName,
      email,
      parentPhone,
      childName,
      childAge,
      role: "customer",
      membership: {
        status: "active",
        price: 30,
        classId,
        startDate: new Date(),
      },
      password: hashedPassword,
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(newUser);

    // Optional: create booking record
    await db.collection("bookings").insertOne({
      classId,
      email,
      childName,
      status: "member",
      createdAt: new Date(),
    });

    await client.close();

    return new Response(
      JSON.stringify({ message: "Account created successfully" }),
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
