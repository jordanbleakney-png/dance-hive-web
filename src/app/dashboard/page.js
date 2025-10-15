"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ✅ Show success message if redirected from /success
  useEffect(() => {
    const from = searchParams.get("from");
    if (from === "success") {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session?.user?.email }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error("Stripe checkout error:", data);
        alert("Failed to start payment session.");
      }
    } catch (err) {
      console.error("Stripe checkout error:", err);
      alert("Failed to start payment session.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") return <div>Loading...</div>;

  const role = session?.user?.role;

  return (
    <DashboardLayout allowedRoles={["customer", "member", "teacher", "admin"]}>
      {showSuccess && (
        <div className="mb-6 bg-green-100 text-green-800 border border-green-300 rounded-lg p-4 shadow-sm animate-fadeIn">
          🎉 <strong>Membership upgraded successfully!</strong> Welcome to
          DanceHive Premium.
        </div>
      )}

      <h1 className="text-2xl font-bold mb-4">
        Welcome, {session?.user?.name || "User"} 👋
      </h1>

      {role === "customer" ? (
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md">
          <h2 className="text-lg font-semibold mb-2">Upgrade to Membership</h2>
          <p className="text-gray-600 mb-4">
            Unlock full access to classes, schedules, and benefits.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition"
          >
            {loading ? "Redirecting..." : "Upgrade to Member"}
          </button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2">Membership Details</h2>
          <p>
            Plan: <strong>Active Member</strong>
          </p>
          <p>Email: {session?.user?.email}</p>
          <p>Status: ✅ Active</p>
          <p className="text-gray-500 text-sm mt-2">
            Thank you for being part of DanceHive!
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
