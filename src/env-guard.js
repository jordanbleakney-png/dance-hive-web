if (!process.env.NEXTAUTH_URL || !process.env.NEXTAUTH_URL.startsWith("http")) {
  console.warn("[env] Injecting fallback NEXTAUTH_URL=http://localhost:3000");
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

