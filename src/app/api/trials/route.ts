import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDb } from "@/lib/dbConnect";

// 🧩 Flexible schema to accept either frontend naming style
const trialSchema = z.object({
  childName: z.string().min(2, "Child's name is required"),
  childAge: z.union([
    z.string().min(1, "Child's age is required"),
    z.number().min(1, "Child's age is required"),
  ]),
  parentName: z.string().min(2, "Parent's name is required"),
  email: z.string().email("Invalid email format"),
  phone: z
    .string()
    .min(8, "Phone number must be at least 8 digits")
    .or(z.string().optional()), // allow missing if using parentPhone
  parentPhone: z
    .string()
    .min(8, "Parent phone must be at least 8 digits")
    .or(z.string().optional()),
  classId: z
    .string()
    .min(2, "Class selection is required")
    .or(z.string().optional()),
  selectedClass: z.string().optional(),
});

// 🚀 POST — Create new trial booking
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🧠 Normalize field names before validation
    const normalized = {
      childName: body.childName,
      childAge: body.childAge,
      parentName: body.parentName,
      email: body.email,
      phone: body.phone ?? body.parentPhone,
      classId: body.classId ?? body.selectedClass,
    };

    const validated = trialSchema.parse(normalized);
    const db = await getDb();

    // 🕵️‍♂️ Prevent duplicate booking by same email + class
    const existing = await db
      .collection("trialBookings")
      .findOne({ email: validated.email, classId: validated.classId });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "You’ve already booked this trial class." },
        { status: 400 }
      );
    }

    // 📝 Insert new booking
    await db.collection("trialBookings").insertOne({
      ...validated,
      status: "pending",
      createdAt: new Date(),
    });

    console.log(`✅ Trial booked for ${validated.email}`);

    return NextResponse.json(
      { success: true, message: "Trial booking successful!" },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.issues.map((i) => i.message).join(", ");
      console.error("❌ Validation failed:", messages);
      return NextResponse.json(
        { success: false, message: messages },
        { status: 400 }
      );
    }

    console.error("💥 Error creating trial booking:", err);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
