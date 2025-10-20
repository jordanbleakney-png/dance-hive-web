/*
  Normalize users collection to:
    - Ensure `email` is correct (rename `ema1l` -> `email` if found)
    - Ensure `phone` exists (copy from `parentPhone` if needed)
    - Remove duplicate fields: `parentPhone`, `name`, `childName`

  Usage:
    MONGODB_URI='mongodb+srv://...' MONGODB_DB='danceHive' node scripts/normalizeUsersShape.js
*/

const { MongoClient } = require("mongodb");

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || "danceHive";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection("users");

  const cursor = users.find({}, { projection: { email: 1, ema1l: 1, phone: 1, parentPhone: 1, name: 1, childName: 1 } });
  let total = 0;
  let updated = 0;
  const bulk = [];

  while (await cursor.hasNext()) {
    const u = await cursor.next();
    total++;
    const set = {};
    const unset = {};

    // Fix misspelled email key if present
    if (u.ema1l && !u.email) {
      set.email = String(u.ema1l).toLowerCase();
      unset.ema1l = "";
    }

    // Normalize phone
    if (!u.phone && u.parentPhone) set.phone = u.parentPhone;
    if (u.parentPhone) unset.parentPhone = "";

    // Remove duplicate display-only fields
    if (Object.prototype.hasOwnProperty.call(u, "name")) unset.name = "";
    if (Object.prototype.hasOwnProperty.call(u, "childName")) unset.childName = "";

    if (Object.keys(set).length || Object.keys(unset).length) {
      bulk.push({ updateOne: { filter: { _id: u._id }, update: { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) } } });
      updated++;
    }
  }

  if (bulk.length) {
    const res = await users.bulkWrite(bulk, { ordered: false });
    console.log(`Users scanned: ${total}, updated: ${updated}`, res.result || res);
  } else {
    console.log(`Users scanned: ${total}, no updates needed.`);
  }

  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

