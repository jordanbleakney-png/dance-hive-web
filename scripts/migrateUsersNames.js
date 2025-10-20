/*
  Backfill nested parent/child objects in users collection to mirror trialBookings.

  What it does:
  - For each user, ensures fields:
      parent: { firstName, lastName }
      child:  { firstName, lastName }
  - Derives values from existing fields if missing:
      - parentFirstName/parentLastName
      - name/parentName (split into first/last)
      - childFirstName/childLastName
      - childName/studentName (split into first/last)
  - Keeps existing flat fields as-is.

  Usage:
    MONGODB_URI='mongodb+srv://...' MONGODB_DB='danceHive' node scripts/migrateUsersNames.js
*/

const { MongoClient, ObjectId } = require("mongodb");

function split(full) {
  if (!full || typeof full !== "string") return { first: "", last: "" };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || "danceHive";

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection("users");

  const cursor = users.find({}, { projection: { _id: 1, parent: 1, child: 1, name: 1, parentName: 1, parentFirstName: 1, parentLastName: 1, childFirstName: 1, childLastName: 1, childName: 1, studentName: 1 } });

  let total = 0;
  let updated = 0;
  const ops = [];

  while (await cursor.hasNext()) {
    const u = await cursor.next();
    total++;

    const want = { set: {} };

    // Parent
    const pFirst = u?.parent?.firstName || u?.parentFirstName || split(u?.name || u?.parentName).first;
    const pLast = u?.parent?.lastName || u?.parentLastName || split(u?.name || u?.parentName).last;
    if (!u.parent || u.parent.firstName !== pFirst || u.parent.lastName !== pLast) {
      if (pFirst || pLast) want.set.parent = { firstName: pFirst || "", lastName: pLast || "" };
    }

    // Child
    const childFull = u?.childName || u?.studentName || "";
    const cFirst = u?.child?.firstName || u?.childFirstName || split(childFull).first;
    const cLast = u?.child?.lastName || u?.childLastName || split(childFull).last;
    if (!u.child || u.child.firstName !== cFirst || u.child.lastName !== cLast) {
      if (cFirst || cLast) want.set.child = { firstName: cFirst || "", lastName: cLast || "" };
    }

    if (Object.keys(want.set).length) {
      ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: want.set } } });
      updated++;
    }
  }

  if (ops.length) {
    const res = await users.bulkWrite(ops, { ordered: false });
    console.log(`Users scanned: ${total}, updated: ${updated}.`, res.result || res);
  } else {
    console.log(`Users scanned: ${total}, no updates needed.`);
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

