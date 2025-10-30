import clientPromise from "./dbConnect";

export async function ensureIndexes() {
  console.log("[db] ensureIndexes() started...");
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "danceHive");

    // === USERS COLLECTION ===
    const users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    await users.createIndex({ "membership.status": 1 });
    await users.createIndex({ convertedAt: 1 });
    console.log("[db] 'users' indexes verified");

    // === TRIAL BOOKINGS COLLECTION ===
    const trials = db.collection("trialBookings");
    await trials.createIndex({ email: 1 });
    await trials.createIndex({ createdAt: 1 });
    await trials.createIndex({ convertedToMember: 1 });
    await trials.createIndex({ classId: 1, trialDate: 1 });
    // Optional de-dup prevention per class/date per email (not unique across null trialDate)
    try {
      await trials.createIndex({ email: 1, classId: 1, trialDate: 1 }, { unique: true, partialFilterExpression: { trialDate: { $type: "string" } } as any });
    } catch {}
    console.log("[db] 'trialBookings' indexes verified");

    // === MEMBERSHIP HISTORY COLLECTION ===
    const history = db.collection("membershipHistory");
    await history.createIndex({ email: 1 });
    await history.createIndex({ event: 1 });
    await history.createIndex({ timestamp: -1 });
    console.log("[db] 'membershipHistory' indexes verified");

    // === CHILDREN COLLECTION ===
    const children = db.collection("children");
    await children.createIndex({ userId: 1 });
    // Compound index helps lookups per user and by name
    await children.createIndex({ userId: 1, firstName: 1, lastName: 1 });
    console.log("[db] 'children' indexes verified");

    // === ENROLLMENTS COLLECTION ===
    const enrollments = db.collection("enrollments");
    // Replace legacy unique index (userId,classId) with (userId,childId,classId)
    try {
      await enrollments.dropIndex("userId_1_classId_1");
    } catch {}
    await enrollments.createIndex({ userId: 1, childId: 1, classId: 1 }, { unique: true });
    // Helpful single-field indexes for common queries
    await enrollments.createIndex({ userId: 1 });
    await enrollments.createIndex({ childId: 1 });
    await enrollments.createIndex({ classId: 1 });
    console.log("[db] 'enrollments' indexes verified");

    // === PREVIOUS CUSTOMERS (archive) ===
    const prev = db.collection("previousCustomers");
    await prev.createIndex({ email: 1 }, { unique: true });
    await prev.createIndex({ archivedAt: -1 });
    console.log("[db] 'previousCustomers' indexes verified");

    // === PROCESSED EVENTS (idempotency) ===
    const processed = db.collection("processedEvents");
    const ttl = 14 * 24 * 60 * 60; // seconds
    try {
      await processed.createIndex({ createdAt: 1 }, { name: "createdAt_1", expireAfterSeconds: ttl });
    } catch (e: any) {
      if (e?.codeName === "IndexOptionsConflict" || e?.code === 85) {
        try {
          await db.command({ collMod: "processedEvents", index: { name: "createdAt_1", expireAfterSeconds: ttl } });
          console.log("[db] adjusted 'processedEvents' TTL to 14 days via collMod");
        } catch (e2) {
          console.warn("[db] unable to adjust TTL index on processedEvents:", e2);
        }
      } else {
        throw e;
      }
    }

    console.log("[db] All indexes confirmed successfully!");
  } catch (err) {
    console.error("[db] Error while ensuring indexes:", err);
  }
}
