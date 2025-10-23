// scripts/createIndexes.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not defined in environment variables!");
}

const client = new MongoClient(uri);

async function createIndexes() {
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "danceHive");

    console.log("[indexes] Connected to MongoDB");

    // ================================
    // USERS COLLECTION
    // ================================
    const users = db.collection("users");

    // Cleanup invalid or empty emails before creating unique index
    console.log("[indexes] Cleaning up invalid or empty emails...");
    const cleanupResult = await users.deleteMany({
      $or: [{ email: "" }, { email: null }, { email: { $exists: false } }],
    });
    console.log(`[indexes] Removed ${cleanupResult.deletedCount} invalid user(s).`);

    // Create indexes for users
    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    await users.createIndex({ "membership.status": 1 });
    await users.createIndex({ convertedAt: 1 });
    console.log("[indexes] Created indexes for 'users'");

    // ================================
    // TRIAL BOOKINGS COLLECTION
    // ================================
    const trials = db.collection("trialBookings");
    await trials.createIndex({ email: 1 }, { unique: false });
    await trials.createIndex({ createdAt: 1 });
    await trials.createIndex({ convertedToMember: 1 });
    console.log("[indexes] Created indexes for 'trialBookings'");

    // ================================
    // MEMBERSHIP HISTORY COLLECTION
    // ================================
    const history = db.collection("membershipHistory");
    await history.createIndex({ email: 1 });
    await history.createIndex({ event: 1 });
    await history.createIndex({ timestamp: -1 });
    console.log("[indexes] Created indexes for 'membershipHistory'");

    // ================================
    // ENROLLMENTS COLLECTION
    // ================================
    const enrollments = db.collection("enrollments");
    await enrollments.createIndex({ userId: 1, classId: 1 }, { unique: true });
    await enrollments.createIndex({ userId: 1 });
    await enrollments.createIndex({ classId: 1 });
    console.log("[indexes] Created indexes for 'enrollments'");

    // ================================
    // PROCESSED EVENTS COLLECTION (Idempotency)
    // ================================
    const processed = db.collection("processedEvents");

    await processed.createIndex(
      { createdAt: 1 },
      {
        expireAfterSeconds: 60 * 60 * 24 * 30, // TTL = 30 days
      }
    );

    console.log("[indexes] Created TTL index for 'processedEvents' (30 days)");

    console.log("[indexes] All indexes created successfully!");
  } catch (err) {
    console.error("[indexes] Error creating indexes:", err);
  } finally {
    await client.close();
    console.log("[indexes] Connection closed.");
  }
}

createIndexes();
