"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function DashboardLayout({ children, allowedRoles = [] }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    // 🚫 Not logged in
    if (status === "unauthenticated" || !session?.user?.email) {
      router.replace("/login");
      return;
    }

    // 🚫 Role not permitted for this dashboard
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
      console.warn(`🚫 Access denied for role: ${session.user.role}`);
      router.replace("/dashboard"); // default fallback
      return;
    }

    setIsAuthorized(true);
  }, [session, status, router, allowedRoles]);

  if (status === "loading") {
    return (
      <div className="p-10 text-center text-gray-600">Loading session...</div>
    );
  }

  if (!isAuthorized) {
    return <div className="p-10 text-center text-gray-600">Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🧭 Navbar */}
      <nav className="bg-white shadow-sm px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold text-blue-600">DanceHive</span>
          <span className="text-gray-500 text-sm">
            {session?.user?.role?.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-gray-700 text-sm">
            {session?.user?.name || "User"}
          </span>
          <LogoutButton />
        </div>
      </nav>

      {/* 🧩 Main Content */}
      <main className="p-10">{children}</main>
    </div>
  );
}
