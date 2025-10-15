"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SuccessPage() {
  const { update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refreshSession = async () => {
      try {
        // ✅ Force-refresh NextAuth session so it pulls updated MongoDB role
        await update();
        console.log("🔄 Session refreshed after Stripe payment");

        // Small delay for smooth UX
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } catch (err) {
        console.error("❌ Failed to refresh session:", err);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    refreshSession();
  }, [update, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-3xl font-bold mb-4 text-green-600">
        🎉 Payment Successful!
      </h1>
      <p className="text-lg text-gray-700 mb-6">
        Thank you for joining Dance Hive! Your membership has been activated.
      </p>

      {loading ? (
        <p className="text-gray-500 animate-pulse">Updating your account...</p>
      ) : (
        <p className="text-gray-600">Redirecting you to your dashboard...</p>
      )}
    </div>
  );
}
