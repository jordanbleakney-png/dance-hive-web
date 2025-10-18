"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

export default function TeacherClassRegisterPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ enrollments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/teacher/classes/${id}/enrollments`);
      if (!res.ok) throw new Error("Failed to load enrollments");
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message || "Unable to load class data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  const markAttendance = async (userId: string) => {
    try {
      const res = await fetch(`/api/teacher/classes/${id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to mark attendance");
      await load();
    } catch (e) {
      alert("Failed to mark attendance");
    }
  };

  return (
    <DashboardLayout allowedRoles={["teacher", "admin"]}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Class Register</h1>
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {data && (
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">Name</th>
                <th className="px-4 py-2 border">Parent Contact</th>
                <th className="px-4 py-2 border">Medical</th>
                <th className="px-4 py-2 border">Attended</th>
                <th className="px-4 py-2 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{e.user?.name || e.user?.email}</td>
                  <td className="px-4 py-2 border">{e.user?.parentPhone || e.user?.email}</td>
                  <td className="px-4 py-2 border">{e.user?.medical || "-"}</td>
                  <td className="px-4 py-2 border">{(e.attendedDates || []).length}</td>
                  <td className="px-4 py-2 border text-center">
                    <button
                      onClick={() => markAttendance(e.userId)}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded-md"
                    >
                      Mark Today
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

