import { NextResponse } from "next/server";

// Public registration is disabled. Accounts are provisioned only via trial conversion by staff.
export async function POST() {
  return new NextResponse(
    JSON.stringify({ error: "Registration is disabled. Please book a trial." }),
    { status: 410 }
  );
}

export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: "Registration is disabled." }),
    { status: 410 }
  );
}
