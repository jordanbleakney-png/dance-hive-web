import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/dbConnect"; // Unified DB helper
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

// Extend NextAuth types to include 'role'
declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      role?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}

const authConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = await getDb();

        // Find user by email
        const user = await db.collection("users").findOne({ email: credentials.email });
        if (!user || !user.password) return null;

        // Verify password
        const isValid = await bcrypt.compare(credentials.password as string, user.password as string);
        if (!isValid) return null;

        // Return minimal user object
        return {
          id: user._id.toString(),
          name: user.name || "User",
          email: user.email,
          role: user.role || "customer",
        };
      },
    }),
  ],

  callbacks: {
    // Add role to JWT
    async jwt({ token, user }: { token: JWT; user?: { role?: string } }) {
      if (user?.role) token.role = user.role;
      return token;
    },

    // Add role to session
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token?.role) {
        session.user.role = token.role;
      }
      try {
        if (session.user?.email) {
          const db = await getDb();
          const u = await db.collection("users").findOne({ email: session.user.email });
          if (u) {
            const first = (u as any)?.parent?.firstName || (u as any)?.name || session.user.name || "User";
            session.user.name = first;
          }
        }
      } catch {}
      return session;
    },

    // Redirect users based on role
    async redirect({ baseUrl, token }: any) {
      // ensure NEXTAUTH_URL is correct (like http://localhost:3001)
      if (token?.role === "admin") return `${baseUrl}/admin`;
      return `${baseUrl}/dashboard`;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt" as const,
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Export handlers for Next.js API
export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
export const { GET, POST } = handlers;

