import { getDb } from "@/lib/dbConnect";

interface ProcessedEvent {
  _id: string;
  createdAt: Date;
}

export async function wasProcessed(eventId: string): Promise<boolean> {
  const db = await getDb();

  const collection = db.collection<ProcessedEvent>("processedEvents");

  // findOne expects a properly typed filter
  const existing = await collection.findOne({ _id: eventId });
  if (existing) return true;

  await collection.insertOne({
    _id: eventId,
    createdAt: new Date(),
  });

  return false;
}
