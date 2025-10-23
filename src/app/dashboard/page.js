"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("customer");
  const [overview, setOverview] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let roleFromStatus = role;
        if (session?.user?.email) {
          const s = await fetch(`/api/users/status?email=${session.user.email}`);
          const sd = await s.json();
          if (sd?.role) {
            setRole(sd.role);
            roleFromStatus = sd.role;
          }
        }
        const r = await fetch("/api/account/overview");
        if (r.ok) {
          const data = await r.json();
          setOverview(data);
          // Show welcome modal on every login until they upgrade
          const isConvertedCustomer =
            roleFromStatus === "customer" && (!data?.membership || data?.membership?.status === "none");
          if (isConvertedCustomer) {
            setShowWelcome(true);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.email]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <p className="text-gray-500 animate-pulse">Loading your dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  const childName = overview
    ? [overview.child?.firstName, overview.child?.lastName].filter(Boolean).join(" | ")
    : "";
  const parentName = overview
    ? [overview.parent?.firstName, overview.parent?.lastName].filter(Boolean).join(" | ")
    : "";
  const addressLine = overview
    ? [
        overview.address?.houseNumber,
        overview.address?.street,
        overview.address?.city,
        overview.address?.county,
        overview.address?.postcode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      console.error(e);
      alert("Unable to start checkout. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto text-center mt-12">
        {showWelcome && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 text-center">
              <h2 className="font-bold text-xl mb-3">You made it, {session?.user?.name || "there"}!</h2>
              <p className="text-gray-700 mb-4">
                Your trial class was just the beginning — we'd love for you to stay with us!<br />
                Get ready to become an official member of the Hive.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded disabled:opacity-60"
                >
                  {upgrading ? "Starting checkout..." : "Upgrade to Member"}
                </button>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="border border-gray-300 text-gray-700 px-5 py-2 rounded hover:bg-gray-50"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold mb-3">Welcome back, {session?.user?.name || "User"}</h1>
        <p className="text-gray-600 mb-6">
          Your current role: <span className="font-medium">{role}</span>
        </p>

        {overview && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Child Details</h2>
              <a href="/dashboard/settings" className="text-sm text-blue-600 hover:underline">
                Edit
              </a>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Child name</div>
                <div className="font-medium">{childName || "-"}</div>
              </div>
              {overview.child?.age != null && (
                <div>
                  <div className="text-gray-500">Age</div>
                  <div className="font-medium">{overview.child.age}</div>
                </div>
              )}
              {overview.child?.dob && (
                <div>
                  <div className="text-gray-500">Date of birth</div>
                  <div className="font-medium">{new Date(overview.child.dob).toLocaleDateString()}</div>
                </div>
              )}
              <div className="md:col-span-3">
                <div className="text-gray-500">Medical information</div>
                <div className="font-medium whitespace-pre-wrap">
                  {overview.medical || "No medical information on file. Please update in Settings."}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="text-gray-500">Emergency contact details</div>
                <div className="font-medium">
                  {
                    [
                      overview.emergencyContact?.name,
                      overview.emergencyContact?.phone,
                      overview.emergencyContact?.relation,
                    ]
                      .filter(Boolean)
                      .join(" | ") || "Not provided"
                  }
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Enrolled Classes */}
        {Array.isArray(overview?.enrollments) && overview.enrollments.length > 0 && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <h2 className="text-lg font-semibold mb-3">Enrolled Classes</h2>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
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
                      <td className="px-4 py-2 border">
                        {[e.class?.day, e.class?.time].filter(Boolean).join(" | ")}
                      </td>
                      <td className="px-4 py-2 border">{e.class?.instructor || "TBA"}</td>
                      <td className="px-4 py-2 border">{e.status || "active"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {overview && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Parent Details</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Parent name</div>
                <div className="font-medium">{parentName || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">Phone</div>
                <div className="font-medium">{overview.phone || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">Email</div>
                <div className="font-medium">{overview.email || "-"}</div>
              </div>
              <div className="md:col-span-3">
                <div className="text-gray-500">Address details</div>
                <div className="font-medium">{addressLine || "-"}</div>
              </div>
            </div>
          </div>
        )}
        {/* Recent Payments */}
        {Array.isArray(overview?.payments) && overview.payments.length > 0 && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <h2 className="text-lg font-semibold mb-3">Recent Payments</h2>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
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
                      <td className="px-4 py-2 border">
                        {new Date(p.createdAt || p.timestamp || Date.now()).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 border">
                        {
                          new Intl.NumberFormat("en-GB", {
                            style: "currency",
                            currency: String(p.currency || "GBP").toUpperCase(),
                            minimumFractionDigits: 0,
                          }).format(Number(p.amount) || 0)
                        }
                      </td>
                      <td className="px-4 py-2 border">{p.payment_status || "paid"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
