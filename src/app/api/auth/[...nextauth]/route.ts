import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectMongoClient } from "@/lib/dbConnect";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const client = await connectMongoClient();
        const db = client.db("danceHive");

        const user = await db
          .collection("users")
          .findOne({ email: credentials.email });
        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          name: user.parentName || user.childName || "User",
          email: user.email,
          role: user.role || "customer",
          membership: user.membership || null,
        };
      },
    }),
  ],

  // 🧠 This is the critical part — keeps the session in sync with MongoDB
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async session({ session, token }) {
      if (!session?.user?.email) return session;

      try {
        const client = await connectMongoClient();
        const db = client.db("danceHive");
        const user = await db
          .collection("users")
          .findOne({ email: session.user.email });

        if (user) {
          session.user.role = user.role || "customer";
          session.user.membership = user.membership || null;
        }
      } catch (error) {
        console.error("⚠️ Error refreshing session:", error);
      }

      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.membership = user.membership;
      }
      return token;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
