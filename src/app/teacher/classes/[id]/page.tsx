"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

export default function TeacherClassRegisterPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ enrollments: any[]; trials?: any[] } | null>(null);
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

  const markTrialAttendance = async (trialId: string) => {
    try {
      const res = await fetch(`/api/teacher/classes/${id}/trial-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trialId }),
      });
      if (!res.ok) throw new Error("Failed to mark trial attendance");
      await load();
    } catch (e) {
      alert("Failed to mark trial attendance");
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
                <th className="px-4 py-2 border">Child</th>
                <th className="px-4 py-2 border">Parent</th>
                <th className="px-4 py-2 border">Parent Contact</th>
                <th className="px-4 py-2 border">Medical</th>
                <th className="px-4 py-2 border">Attended</th>
                <th className="px-4 py-2 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map((e) => {
                const childFull = [e?.user?.child?.firstName, e?.user?.child?.lastName]
                  .filter(Boolean)
                  .join(" ") || e?.user?.name || "-";
                const contact = e?.user?.phone || e?.user?.parentPhone || "-";
                return (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{childFull}</td>
                  <td className="px-4 py-2 border">{[e?.user?.parent?.firstName, e?.user?.parent?.lastName].filter(Boolean).join(" ") || "-"}</td>
                  <td className="px-4 py-2 border">{contact}</td>
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
              )})}
            </tbody>
          </table>
        )}

        {data?.trials && data.trials.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Trial Students</h2>
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border">Child</th>
                  <th className="px-4 py-2 border">Parent</th>
                  <th className="px-4 py-2 border">Contact</th>
                  <th className="px-4 py-2 border">Status</th>
                  <th className="px-4 py-2 border">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.trials.map((t) => {
                  const childName = [t?.child?.firstName, t?.child?.lastName]
                    .filter(Boolean)
                    .join(" ") || t.childName || "";
                  const parentName = [t?.parent?.firstName, t?.parent?.lastName]
                    .filter(Boolean)
                    .join(" ") || t.parentName || "";
                  return (
                    <tr key={t._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">{childName}</td>
                      <td className="px-4 py-2 border">{parentName}</td>
                      <td className="px-4 py-2 border">{t.phone || t.email}</td>
                      <td className="px-4 py-2 border">{t.status || 'pending'}</td>
                      <td className="px-4 py-2 border text-center">
                        {t.status === 'converted' ? (
                          <span className="inline-block bg-green-100 text-green-700 border border-green-300 text-xs px-2 py-1 rounded">Converted</span>
                        ) : (
                          <select
                            className="border rounded-md px-2 py-1 text-sm"
                            defaultValue=""
                            onChange={async (e) => {
                              const selectEl = e.currentTarget as HTMLSelectElement | null;
                              const val = selectEl ? selectEl.value : '';
                              try {
                                if (val === 'attended') {
                                  await markTrialAttendance(String(t._id));
                                } else if (val === 'converted') {
                                  const res = await fetch(`/api/teacher/classes/${id}/convert-trial`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ trialId: String(t._id) }),
                                  });
                                  if (!res.ok) throw new Error('Failed to convert trial');
                                  await load();
                                }
                              } catch (err) {
                                alert('Failed to process action');
                              } finally {
                                if (selectEl) selectEl.selectedIndex = 0;
                              }
                            }}
                          >
                            <option value="" disabled>Select action</option>
                            <option value="attended">Mark Attended</option>
                            <option value="converted">Convert</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}





