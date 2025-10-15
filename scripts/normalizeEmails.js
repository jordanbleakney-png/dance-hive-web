import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// ✅ Load environment variables
dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
console.log("🧠 MONGODB_URI loaded:", uri ? "✅ Found" : "❌ Not Found");

if (!uri) {
  console.error("❌ Missing MONGODB_URI. Please check your .env.local file.");
  process.exit(1);
}

async function normalizeEmails() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("danceHive");
    console.log("🔧 Starting email normalization & cleanup...");

    // ✅ bookings: rename userEmail → email
    const bookingsResult = await db
      .collection("bookings")
      .updateMany({ userEmail: { $exists: true } }, [
        { $set: { email: "$userEmail" } },
      ]);

    // ✅ trialBookings: rename parentEmail → email
    const trialsResult = await db
      .collection("trialBookings")
      .updateMany({ parentEmail: { $exists: true } }, [
        { $set: { email: "$parentEmail" } },
      ]);

    // ✅ payments: ensure consistent email casing
    const paymentsResult = await db
      .collection("payments")
      .updateMany({}, [{ $set: { email: { $toLower: "$email" } } }]);

    // ✅ users: copy parentEmail → email if missing
    const usersCopied = await db.collection("users").updateMany(
      {
        email: { $exists: false },
        parentEmail: { $exists: true },
      },
      [{ $set: { email: "$parentEmail" } }]
    );

    // ✅ users: lowercase all emails
    const usersLower = await db
      .collection("users")
      .updateMany({}, [{ $set: { email: { $toLower: "$email" } } }]);

    // 🧹 users: remove redundant fields
    const usersClean = await db.collection("users").updateMany(
      {},
      {
        $unset: {
          parentEmail: "",
          userEmail: "",
          guardianEmail: "",
          studentEmail: "",
        },
      }
    );

    console.log("✅ Normalization & cleanup results:");
    console.table({
      bookings: bookingsResult.modifiedCount,
      trialBookings: trialsResult.modifiedCount,
      payments: paymentsResult.modifiedCount,
      usersCopied: usersCopied.modifiedCount,
      usersLowercased: usersLower.modifiedCount,
      usersCleaned: usersClean.modifiedCount,
    });

    console.log("🎉 All emails normalized & redundant fields removed!");
  } catch (error) {
    console.error("❌ Error during normalization:", error);
  } finally {
    await client.close();
  }
}

normalizeEmails();
