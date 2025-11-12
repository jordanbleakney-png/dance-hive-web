import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/dbConnect";

// Require split names only; drop legacy combined names
const trialSchema = z.object({
  parentFirstName: z.string().min(1),
  parentLastName: z.string().min(1),
  childFirstName: z.string().min(1),
  childLastName: z.string().min(1),
  childAge: z.coerce.number().int().min(1),
  email: z.string().email(),
  parentPhone: z.string().min(8).optional(),
  classId: z.string().min(2),
  trialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = trialSchema.parse(body);

    const classId = parsed.classId as string;
    if (!ObjectId.isValid(classId)) {
      return NextResponse.json(
        { success: false, message: "Invalid classId" },
        { status: 400 }
      );
    }

    // Optional trialDate validation against class weekday and 28-day horizon
    let trialDate: string | null = null;
    if (parsed.trialDate) {
      trialDate = parsed.trialDate;
      const cls = await (await getDb()).collection("classes").findOne({ _id: new ObjectId(classId) });
      if (!cls) return NextResponse.json({ success: false, message: "Class not found" }, { status: 404 });
      const weekday = String((cls as any).day || "");
      const dayToIndex: Record<string, number> = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
      const d = new Date(trialDate);
      d.setHours(0,0,0,0);
      const today = new Date(); today.setHours(0,0,0,0);
      const max = new Date(today); max.setDate(max.getDate() + 28);
      if (d < today || d > max) {
        return NextResponse.json({ success: false, message: "Selected date is out of range" }, { status: 400 });
      }
      if (weekday && d.getDay() !== dayToIndex[weekday]) {
        return NextResponse.json({ success: false, message: "Selected date does not match class day" }, { status: 400 });
      }
    }

    const record = {
      parent: { firstName: parsed.parentFirstName, lastName: parsed.parentLastName },
      child: { firstName: parsed.childFirstName, lastName: parsed.childLastName },
      childAge: parsed.childAge,
      email: parsed.email,
      phone: parsed.parentPhone,
      classId,
      ...(trialDate ? { trialDate } : {}),
    };

    const db = await getDb();

    const existing = await db
      .collection("trialBookings")
      .findOne({ email: record.email, classId: record.classId, ...(trialDate ? { trialDate } : {}) });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "You have already booked this trial class." },
        { status: 400 }
      );
    }

    try {
      await db.collection("trialBookings").insertOne({
      ...record,
      status: "pending",
      createdAt: new Date(),
      });
    } catch (e: any) {
      if (e && e.code === 11000) {
        return NextResponse.json(
          { success: false, message: "A trial for this email, class and date already exists" },
          { status: 409 }
        );
      }
      throw e;
    }

    return NextResponse.json(
      { success: true, message: "Trial booking successful!" },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        { success: false, message: messages },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
