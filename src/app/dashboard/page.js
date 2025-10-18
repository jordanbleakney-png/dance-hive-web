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
  const [membershipStatus, setMembershipStatus] = useState("none");
  const [firstTime, setFirstTime] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  // Fetch the latest role and onboarding flag from MongoDB
  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!session?.user?.email) return;

      try {
        const res = await fetch(`/api/users/status?email=${session.user.email}`);
        const data = await res.json();

        if (data?.role) setRole(data.role);
        if (data?.membership?.status) setMembershipStatus(data.membership.status);
        if (typeof data?.onboardingComplete !== "undefined") {
          setOnboardingComplete(Boolean(data.onboardingComplete));
        }
      } catch (err) {
        console.error("Failed to fetch user status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStatus();
  }, [session?.user?.email]);

  // Success banner and onboarding prompt
  useEffect(() => {
    const ft = searchParams.get("firstTime");
    if (ft === "1") setFirstTime(true);

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

  // Role badge styling logic
  const getRoleBadge = (role) => {
    switch (role) {
      case "member":
        return (
          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700 border border-green-300">
            Member
          </span>
        );
      case "trial":
        return (
          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-700 border border-yellow-300">
            Trial
          </span>
        );
      default:
        return (
          <span className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700 border border-gray-300">
            Customer
          </span>
        );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <p className="text-gray-500 animate-pulse">Loading your dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  const showOnboarding = firstTime || onboardingComplete === false;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto text-center mt-12">
        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4">
            Payment successful — your membership has been activated!
          </div>
        )}

        {/* Welcome Header */}
        <h1 className="text-2xl font-bold mb-3 flex justify-center items-center">
          Welcome back, {session?.user?.name || "User"} {getRoleBadge(role)}
        </h1>

        <p className="text-gray-600 mb-6">
          Your current role: <span className="font-medium">{role}</span>
        </p>

        {/* First-time onboarding prompt */}
        {showOnboarding && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md mb-6 max-w-2xl mx-auto">
            <p className="font-semibold mb-2">Welcome to your new membership!</p>
            <p className="mb-3">For security and better service, please:</p>
            <ul className="list-disc list-inside text-left mb-3">
              <li>Set a new password</li>
              <li>Update personal, emergency and medical details</li>
            </ul>
            <div className="flex gap-3 justify-center">
              <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md" href="/dashboard/settings">Update Details</a>
            </div>
          </div>
        )}

        {/* Role-based Button or Message */}
        {!(role === "member" || membershipStatus === "active") ? (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded transition disabled:opacity-50"
          >
            {loading ? "Loading..." : "Upgrade to Member"}
          </button>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

