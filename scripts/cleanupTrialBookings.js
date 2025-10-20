/*
  Cleanup script: remove legacy combined name fields from trialBookings.
  Usage:
    MONGODB_URI='mongodb+srv://...' MONGODB_DB='danceHive' node scripts/cleanupTrialBookings.js
*/

const { MongoClient } = require("mongodb");

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || "danceHive";

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const res = await db
      .collection("trialBookings")
      .updateMany({}, { $unset: { parentName: "", childName: "" } });
    console.log(`Updated ${res.modifiedCount} trialBookings documents (unset legacy names).`);
  } finally {
    await client.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

