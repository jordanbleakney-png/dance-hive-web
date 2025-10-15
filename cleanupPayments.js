import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env.local") });

const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("danceHive");

  console.log("🧹 Checking for payments linked to non-existent users...");

  const payments = await db.collection("payments").find().toArray();
  let removed = 0;

  for (const payment of payments) {
    if (!payment.email) {
      // Remove payments without an email
      await db.collection("payments").deleteOne({ _id: payment._id });
      removed++;
      continue;
    }

    const user = await db.collection("users").findOne({ email: payment.email });
    if (!user) {
      await db.collection("payments").deleteOne({ _id: payment._id });
      removed++;
    }
  }

  console.log(`✅ Cleanup complete. Removed ${removed} orphaned payments.`);
  await client.close();
}

run().catch((err) => console.error("❌ Cleanup error:", err));
