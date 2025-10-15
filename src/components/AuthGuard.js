"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * AuthGuard
 * Wraps protected pages to ensure user is authenticated and authorized.
 */
export default function AuthGuard({ allowedRoles = [], children }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Wait for session to load

    if (status === "unauthenticated" || !session?.user) {
      console.warn("🚫 Not authenticated, redirecting to /login");
      router.replace("/login");
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
      console.warn("🚫 Unauthorized role, redirecting to /dashboard");
      router.replace("/dashboard");
    }
  }, [session, status, router, allowedRoles]);

  if (status === "loading") {
    return <div className="p-10 text-center">Loading...</div>;
  }

  return <>{children}</>;
}
