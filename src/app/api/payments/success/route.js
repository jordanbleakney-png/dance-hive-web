export async function GET(req) {
  try {
    // Do not mutate membership here; webhook is authoritative.
    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    return Response.redirect(`${base}/dashboard`);
  } catch (error) {
    console.error("[payments/success] handler error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
