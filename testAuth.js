import { getDb } from "@/lib/dbConnect";
import bcrypt from "bcrypt";

// === CONFIG ===
const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://jordanbleakney_db_user:cyHsjjjV45xnVntM@cluster0.iug2hbj.mongodb.net/danceHive?retryWrites=true&w=majority";
const dbName = "danceHive";
const testEmail = "admin@dancehive.com";
const testPassword = "password123";

async function runTest() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db(dbName);
    const user = await db.collection("users").findOne({ email: testEmail });

    if (!user) {
      console.log("❌ No user found with that email");
      return;
    }

    console.log("👤 Found user:", user.email);

    const match = await bcrypt.compare(testPassword, user.password);

    if (match) {
      console.log("✅ Password is valid!");
    } else {
      console.log("❌ Password is INVALID");
    }

    await client.close();
  } catch (error) {
    console.error("🔥 Test failed:", error);
  }
}

runTest();
