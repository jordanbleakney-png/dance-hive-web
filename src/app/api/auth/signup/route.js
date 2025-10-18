import { NextResponse } from "next/server";

// Public sign-up is disabled. Accounts are provisioned via trial conversion only.
export async function POST() {
  return new NextResponse(
    JSON.stringify({ error: "Sign-up is disabled. Please book a trial." }),
    { status: 410 }
  );
}
