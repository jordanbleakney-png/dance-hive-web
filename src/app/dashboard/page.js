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
  const [overview, setOverview] = useState(null);

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

  // Fetch overview (child details + enrollments)
  useEffect(() => {
    const run = async () => {
      if (!session?.user?.email) return;
      try {
        const res = await fetch("/api/account/overview");
        const data = await res.json();
        if (res.ok) setOverview(data);
      } catch (e) {
        console.warn("Failed to load overview", e);
      }
    };
    run();
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

        {/* Child details */}
        {overview?.child && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Child Details</h2>
              <a href="/dashboard/settings" className="text-sm text-blue-600 hover:underline">Edit</a>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Name</div>
                <div className="font-medium">
                  {[overview.child.firstName, overview.child.lastName].filter(Boolean).join(" ")}
                </div>
              </div>
              {overview.child.age != null && (
                <div>
                  <div className="text-gray-500">Age</div>
                  <div className="font-medium">{overview.child.age}</div>
                </div>
              )}
              <div className="md:col-span-2">
                <div className="text-gray-500">Medical Information</div>
                <div className="font-medium whitespace-pre-wrap">
                  {overview.medical || "No medical information on file. Please update in Settings."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enrolled classes */}
        {Array.isArray(overview?.enrollments) && overview.enrollments.length > 0 && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <h2 className="text-lg font-semibold mb-3">Enrolled Classes</h2>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border text-left">Class</th>
                    <th className="px-4 py-2 border text-left">Schedule</th>
                    <th className="px-4 py-2 border text-left">Teacher</th>
                    <th className="px-4 py-2 border text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.enrollments.map((e) => (
                    <tr key={e._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">{e.class?.name || ""}</td>
                      <td className="px-4 py-2 border">{[e.class?.day, e.class?.time].filter(Boolean).join(" ")}</td>
                      <td className="px-4 py-2 border">{e.class?.instructor || "TBA"}</td>
                      <td className="px-4 py-2 border">{e.status || "active"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent payments */}
        {Array.isArray(overview?.payments) && overview.payments.length > 0 && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <h2 className="text-lg font-semibold mb-3">Recent Payments</h2>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border text-left">Date</th>
                    <th className="px-4 py-2 border text-left">Amount</th>
                    <th className="px-4 py-2 border text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.payments.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">{new Date(p.createdAt || p.timestamp || Date.now()).toLocaleString()}</td>
                      <td className="px-4 py-2 border">
                        {new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(p.currency || 'GBP').toUpperCase(), minimumFractionDigits: 0 }).format(Number(p.amount) || 0)}
                      </td>
                      <td className="px-4 py-2 border">{p.payment_status || 'paid'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

