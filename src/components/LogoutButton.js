"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      console.log("👋 Logging out...");
      await signOut({
        callbackUrl: "/login", // Redirect here after logout
      });
    } catch (error) {
      console.error("❌ Logout failed:", error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-md transition"
    >
      Log Out
    </button>
  );
}
