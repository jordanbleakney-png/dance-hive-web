import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await auth();
  return new Response(JSON.stringify({ session }), { status: 200 });
}
