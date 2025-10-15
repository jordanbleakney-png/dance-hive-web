import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string;
      email?: string;
      role?: string;
      membership?: {
        status: string;
        plan: string;
        updatedAt: Date | null;
        lastPaymentDate: Date | null;
      };
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: string;
    membership?: {
      status: string;
      plan: string;
      updatedAt: Date | null;
      lastPaymentDate: Date | null;
    };
  }
}
