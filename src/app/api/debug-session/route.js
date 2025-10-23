import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  return new Response(JSON.stringify({ session }), { status: 200 });
}
