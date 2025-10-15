import clientPromise from "./dbConnect";

export async function ensureIndexes() {
  console.log("🧩 ensureIndexes() started...");
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "danceHive");

    // === USERS COLLECTION ===
    const users = db.collection("users");
    const userIndexes = await users.indexes();
    console.log(`📦 Found ${userIndexes.length} existing indexes in 'users'`);

    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    await users.createIndex({ "membership.status": 1 });
    await users.createIndex({ convertedAt: 1 });
    console.log("✅ 'users' indexes verified");

    // === TRIAL BOOKINGS COLLECTION ===
    const trials = db.collection("trialBookings");
    await trials.createIndex({ email: 1 });
    await trials.createIndex({ createdAt: 1 });
    await trials.createIndex({ convertedToMember: 1 });
    console.log("✅ 'trialBookings' indexes verified");

    // === MEMBERSHIP HISTORY COLLECTION ===
    const history = db.collection("membershipHistory");
    await history.createIndex({ email: 1 });
    await history.createIndex({ event: 1 });
    await history.createIndex({ timestamp: -1 });
    console.log("✅ 'membershipHistory' indexes verified");

    console.log("🎯 All indexes confirmed successfully!");
  } catch (err) {
    console.error("⚠️ Error while ensuring indexes:", err);
  }
}
