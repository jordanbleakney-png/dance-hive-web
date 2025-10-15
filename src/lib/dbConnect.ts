import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("❌ Missing environment variable: MONGODB_URI");

// ✅ Use a single global variable to cache MongoDB connections
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // ✅ In development, use global to preserve the connection across hot reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect().then((client) => {
      console.log("✅ Connected to MongoDB (dev cache)");
      return client;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  // ✅ In production, always create a new connection
  client = new MongoClient(uri);
  clientPromise = client.connect().then((client) => {
    console.log("✅ Connected to MongoDB (prod)");
    return client;
  });
}

/**
 * ✅ Returns the connected MongoClient instance
 */
export async function connectMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

/**
 * ✅ Helper: Get a specific database (default = "danceHive")
 */
export async function getDb(dbName = "danceHive"): Promise<Db> {
  const client = await connectMongoClient();
  return client.db(dbName);
}
