// fixUsers.js
import { getDb } from "@/lib/dbConnect";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 🧠 Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env.local") });

const uri = process.env.MONGODB_URI;

if (!uri || !uri.startsWith("mongodb")) {
  console.error("❌ MONGODB_URI is missing or invalid!");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");

  console.log("🔍 Checking for users with email...");

  const users = await db
    .collection("users")
    .find({ email: { $exists: true } })
    .toArray();

  if (users.length === 0) {
    console.log("✅ No users with email found — nothing to update!");
  }

  for (const user of users) {
    const update = {
      $set: {
        email: user.email,
        name: user.parentName,
        phone: user.parentPhone,
      },
      $unset: {
        email: "",
        parentName: "",
        parentPhone: "",
      },
    };

    await db.collection("users").updateOne({ _id: user._id }, update);
    console.log(`✅ Updated ${user.email} → ${user._id}`);
  }

  await client.close();
  console.log("🎉 Done! All users now use 'email' and 'name'");
}

run().catch((err) => {
  console.error("❌ Error:", err);
});
