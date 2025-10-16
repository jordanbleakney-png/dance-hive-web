"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AdminTrialsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔒 Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // 📦 Fetch trial bookings (admin only)
  useEffect(() => {
    async function fetchTrials() {
      try {
        const res = await fetch("/api/admin/trials");
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to fetch trials");

        setTrials(data.trials);
      } catch (err) {
        console.error(err);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") fetchTrials();
  }, [status]);

  // 🔄 Function to update trial status
  async function updateStatus(id, newStatus) {
    console.log("Updating trial:", id, "→", newStatus); // 🧠 Debug log
    try {
      const res = await fetch("/api/admin/trials/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast.success(`Status updated to "${newStatus}"`);

      // ✅ Update local state (no reload)
      setTrials((prev) =>
        prev.map((trial) =>
          trial._id === id ? { ...trial, status: newStatus } : trial
        )
      );
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (status === "loading" || loading)
    return <p className="p-10 text-center">Loading trial bookings...</p>;

  if (!Array.isArray(trials) || trials.length === 0)
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-3xl font-bold mb-6">🧾 Trial Bookings</h1>
        <p>No trial bookings found.</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🧾 Trial Bookings</h1>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
        >
          Log Out
        </button>
      </div>

      {/* Table */}
      <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
        <table className="min-w-full border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border">Child</th>
              <th className="px-4 py-2 border">Age</th>
              <th className="px-4 py-2 border">Class ID</th>
              <th className="px-4 py-2 border">Parent</th>
              <th className="px-4 py-2 border">Email</th>
              <th className="px-4 py-2 border">Phone</th>
              <th className="px-4 py-2 border">Status</th>
              <th className="px-4 py-2 border">Actions</th>
              <th className="px-4 py-2 border">Date</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t) => (
              <tr key={t._id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{t.childName}</td>
                <td className="px-4 py-2 border text-center">{t.childAge}</td>
                <td className="px-4 py-2 border text-sm">{t.classId}</td>
                <td className="px-4 py-2 border">{t.parentName}</td>
                <td className="px-4 py-2 border text-blue-600 underline cursor-pointer">
                  <a href={`mailto:${t.email}`}>{t.email}</a>
                </td>
                <td className="px-4 py-2 border">{t.parentPhone}</td>

                {/* Status */}
                <td className="px-4 py-2 border text-center">
                  <span
                    className={`px-2 py-1 rounded-md text-white ${
                      t.status === "converted"
                        ? "bg-green-500"
                        : t.status === "attended"
                        ? "bg-blue-500"
                        : "bg-yellow-500"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-2 border text-center">
                  <select
                    value={t.status}
                    onChange={(e) => updateStatus(t._id, e.target.value)}
                    className="border rounded-md p-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="attended">Attended</option>
                    <option value="converted">Converted</option>
                  </select>
                </td>

                <td className="px-4 py-2 border text-sm">
                  {new Date(t.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
