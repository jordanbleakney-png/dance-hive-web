/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // ✅ Catch subtle React issues in dev

  compiler: {
    // ✅ Automatically remove console logs in production for cleaner builds
    removeConsole: process.env.NODE_ENV === "production",
  },

  images: {
    // ✅ Allow both local & remote image optimization
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com", // Cloudinary
      },
      {
        protocol: "https",
        hostname: "files.stripe.com", // Stripe-hosted images
      },
    ],
  },

  experimental: {
    // ✅ Keep Turbopack fast rebuilds (you’re already using it)
    turbo: {
      rules: {},
    },
  },
};

export default nextConfig;
