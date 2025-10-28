/*
  Danger: removes test data from MongoDB.

  Default behaviour:
    - Deletes all documents from collections:
      children, enrollments, payments, membershipHistory, processedEvents, trialBookings
    - Users: keeps users with role in {"admin","teacher"}.

  Flags:
    --nuke-users   Also delete all users (including admins/teachers).

  Usage:
    MONGODB_URI='mongodb+srv://...' MONGODB_DB='danceHive' node scripts/resetTestData.js
    MONGODB_URI='...' node scripts/resetTestData.js --nuke-users
*/

/* eslint-disable no-console */
const { MongoClient } = require("mongodb");

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || "danceHive";

  const args = new Set(process.argv.slice(2));
  const nukeUsers = args.has("--nuke-users");

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const collections = [
      "children",
      "enrollments",
      "payments",
      "membershipHistory",
      "processedEvents",
      "trialBookings",
    ];

    for (const name of collections) {
      try {
        const res = await db.collection(name).deleteMany({});
        console.log(`[wipe] ${name}: deleted ${res.deletedCount}`);
      } catch (e) {
        console.warn(`[wipe] ${name}: ${e.message}`);
      }
    }

    if (nukeUsers) {
      const res = await db.collection("users").deleteMany({});
      console.log(`[wipe] users: deleted ${res.deletedCount}`);
    } else {
      // Keep admins/teachers; remove other test users
      const res = await db
        .collection("users")
        .deleteMany({ role: { $nin: ["admin", "teacher"] } });
      console.log(`[wipe] users (non-admin/teacher): deleted ${res.deletedCount}`);
    }

    console.log("[wipe] done");
  } finally {
    await client.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

