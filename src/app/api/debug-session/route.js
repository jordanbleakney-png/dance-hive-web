import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  return new Response(JSON.stringify({ session }), { status: 200 });
}
