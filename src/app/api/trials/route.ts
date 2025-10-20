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

    const record = {
      parent: { firstName: parsed.parentFirstName, lastName: parsed.parentLastName },
      child: { firstName: parsed.childFirstName, lastName: parsed.childLastName },
      childAge: parsed.childAge,
      email: parsed.email,
      phone: parsed.parentPhone,
      classId,
    };

    const db = await getDb();

    const existing = await db
      .collection("trialBookings")
      .findOne({ email: record.email, classId: record.classId });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "You have already booked this trial class." },
        { status: 400 }
      );
    }

    await db.collection("trialBookings").insertOne({
      ...record,
      status: "pending",
      createdAt: new Date(),
    });

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
