"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [role, setRole] = useState(session?.user?.role || "customer");

  // ✅ Fetch the latest role from MongoDB
  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!session?.user?.email) return;

      try {
        const res = await fetch(
          `/api/users/status?email=${session.user.email}`
        );
        const data = await res.json();

        if (data?.role) {
          setRole(data.role);
        }
      } catch (err) {
        console.error("Failed to fetch user status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStatus();
  }, [session?.user?.email]);

  // ✅ Show success message after Stripe payment
  useEffect(() => {
    const from = searchParams.get("from");
    if (from === "success") {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // ✅ Handle Upgrade button click
  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        alert("Failed to start checkout. Please try again.");
      }
    } catch (err) {
      console.error("Upgrade failed:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 🏷️ Role badge styling logic
  const getRoleBadge = (role) => {
    switch (role) {
      case "member":
        return (
          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700 border border-green-300">
            🥇 Member
          </span>
        );
      case "trial":
        return (
          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-700 border border-yellow-300">
            🧭 Trial
          </span>
        );
      default:
        return (
          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700 border border-gray-300">
            👤 Customer
          </span>
        );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <p className="text-gray-500 animate-pulse">
            Loading your dashboard...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto text-center mt-12">
        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4">
            ✅ Payment successful — your membership has been activated!
          </div>
        )}

        {/* Welcome Header */}
        <h1 className="text-2xl font-bold mb-3 flex justify-center items-center">
          Welcome back, {session?.user?.name || "User"} {getRoleBadge(role)}
        </h1>

        <p className="text-gray-600 mb-6">
          Your current role: <span className="font-medium">{role}</span>
        </p>

        {/* Role-based Button or Message */}
        {role !== "member" ? (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded transition disabled:opacity-50"
          >
            {loading ? "Loading..." : "Upgrade to Member"}
          </button>
        ) : (
          <p className="text-green-600 font-semibold">
            🎉 You’re now a Member! Enjoy your full access.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
