"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("customer");
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (session?.user?.email) {
          const s = await fetch(`/api/users/status?email=${session.user.email}`);
          const sd = await s.json();
          if (sd?.role) setRole(sd.role);
        }
        const r = await fetch("/api/account/overview");
        if (r.ok) setOverview(await r.json());
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

  const childName = overview ? [overview.child?.firstName, overview.child?.lastName].filter(Boolean).join(" ") : "";
  const parentName = overview ? [overview.parent?.firstName, overview.parent?.lastName].filter(Boolean).join(" ") : "";
  const addressLine = overview
    ? [overview.address?.houseNumber, overview.address?.street, overview.address?.city, overview.address?.county, overview.address?.postcode]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto text-center mt-12">
        <h1 className="text-2xl font-bold mb-3">Welcome back, {session?.user?.name || "User"}</h1>
        <p className="text-gray-600 mb-6">Your current role: <span className="font-medium">{role}</span></p>

        {overview && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Child Details</h2>
              <a href="/dashboard/settings" className="text-sm text-blue-600 hover:underline">Edit</a>
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
                <div className="font-medium whitespace-pre-wrap">{overview.medical || "No medical information on file. Please update in Settings."}</div>
              </div>
              <div className="md:col-span-3">
                <div className="text-gray-500">Emergency contact details</div>
                <div className="font-medium">{[overview.emergencyContact?.name, overview.emergencyContact?.phone, overview.emergencyContact?.relation].filter(Boolean).join(" · ") || "Not provided"}</div>
              </div>
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
      </div>
    </DashboardLayout>
  );
}
