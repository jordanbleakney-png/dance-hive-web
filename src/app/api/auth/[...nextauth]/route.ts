import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/dbConnect"; // ✅ fixed import

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

        try {
          // ✅ Use shared MongoDB connection
          const client = await clientPromise;
          const db = client.db("danceHive");

          // Look up user
          const user = await db.collection("users").findOne({
            email: credentials.email,
          });

          if (!user) return null;

          // Validate password
          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isValid) return null;

          // Return user data (excluding password)
          return {
            id: user._id.toString(),
            name: user.name || "User",
            email: user.email,
          };
        } catch (error) {
          console.error("❌ Error in authorize:", error);
          return null;
        }
      },
    }),
  ],
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
