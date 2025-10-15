import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;

// ✅ Safe fallback URL
const FALLBACK_URL = "http://localhost:3000";
const BASE_URL =
  process.env.NEXTAUTH_URL?.startsWith("http") && process.env.NEXTAUTH_URL
    ? process.env.NEXTAUTH_URL
    : FALLBACK_URL;

console.log("✅ NEXTAUTH_URL loaded as:", process.env.NEXTAUTH_URL);
console.log("✅ Using BASE_URL:", BASE_URL);

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        console.log("🧠 Authorize called with:", credentials);

        if (!credentials?.email || !credentials?.password) {
          console.log("❌ Missing credentials");
          return null;
        }

        try {
          const client = new MongoClient(uri);
          await client.connect();
          const db = client.db("danceHive");

          // ✅ Search in the 'users' collection by email or email
          const user = await db.collection("users").findOne({
            $or: [{ email: credentials.email }, { email: credentials.email }],
          });

          console.log("🧩 Found user:", user ? user.email : "none");

          if (!user) {
            await client.close();
            return null;
          }

          // ✅ Verify password
          const valid = await bcrypt.compare(
            credentials.password,
            user.password
          );
          if (!valid) {
            console.log("❌ Invalid password for:", user.email);
            await client.close();
            return null;
          }

          // ✅ Create unified user object
          const foundUser = {
            name: user.name || user.parentName || "User",
            email: user.email || user.email,
            role: user.role || "customer",
          };

          console.log("✅ Authenticated user:", foundUser);

          await client.close();
          return foundUser;
        } catch (err) {
          console.error("💥 Error in authorize():", err);
          return null;
        }
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.role = user.role || "customer";
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        name: token.name,
        email: token.email,
        role: token.role || "customer",
      };
      return session;
    },

    // ✅ Smart redirect based on role
    async redirect({ url, baseUrl }) {
      console.log("🔄 Redirect triggered:", url);

      // Default safe fallback
      const safeBase = baseUrl || BASE_URL || FALLBACK_URL;

      // NextAuth doesn’t have session data here, so we rely on the URL
      if (url.includes("/admin")) return `${safeBase}/admin`;
      if (url.includes("/teacher")) return `${safeBase}/teacher/dashboard`;
      if (url.includes("/dashboard")) return `${safeBase}/dashboard`;

      // Otherwise just go to home
      return safeBase;
    },
  },

  events: {
    signIn: async (message) => {
      console.log("✅ SignIn Event:", message.user?.email, message.user?.role);
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 day
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
