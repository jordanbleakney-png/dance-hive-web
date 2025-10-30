import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/dbConnect";

// GET /api/classes/[id]/occurrences?weeks=4
// Returns the next N weekly dates for the class weekday, labeled for display
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const db = await getDb();
    const id = params.id;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid class id" }, { status: 400 });
    }
    const cls = await db.collection("classes").findOne({ _id: new ObjectId(id) });
    if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const weekday = String((cls as any).day || ""); // e.g., "Tuesday"
    const time = String((cls as any).time || ""); // e.g., "17:00"
    const dayToIndex: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const target = dayToIndex[weekday];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find the next occurrence of the weekday from today (inclusive if today matches)
    const first = new Date(now);
    const diff = (typeof target === "number") ? (target - first.getDay() + 7) % 7 : 0;
    first.setDate(first.getDate() + diff);

    const max = 4; // default horizon
    const out: Array<{ date: string; label: string }> = [];
    for (let i = 0; i < max; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + i * 7);
      const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const label = `${weekday} ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${time ? ", " + time : ""}`;
      out.push({ date: iso, label });
    }

    return NextResponse.json(out);
  } catch (err) {
    console.error("[classes/:id/occurrences] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

