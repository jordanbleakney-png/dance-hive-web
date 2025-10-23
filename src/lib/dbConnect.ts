import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in environment variables!");
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // allow global var for hot reloads in dev
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    console.log("[db] Creating new MongoDB client (dev mode)...");
    client = new MongoClient(uri!, options);
    global._mongoClientPromise = client.connect();
  } else {
    console.log("[db] Reusing existing MongoDB client (hot reload)");
  }
  clientPromise = global._mongoClientPromise as Promise<MongoClient>;
} else {
  console.log("[db] Creating MongoDB client (production)...");
  client = new MongoClient(uri!, options);
  clientPromise = client.connect();
}

// Default export (for direct use)
export default clientPromise;

// Named helper (for convenience)
export async function getDb() {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "danceHive");
}

// Auto-run index verification on startup
let hasEnsuredIndexes = false;

async function runEnsureIndexes() {
  if (hasEnsuredIndexes) return;
  hasEnsuredIndexes = true;
  try {
    console.log("[db] Importing ensureIndexes.ts...");
    const { ensureIndexes } = await import("./ensureIndexes");
    console.log("[db] Running index verification...");
    await ensureIndexes();
    console.log("[db] Index verification complete.");
  } catch (err) {
    console.error("[db] Failed to ensure indexes:", err);
  }
}

runEnsureIndexes();
