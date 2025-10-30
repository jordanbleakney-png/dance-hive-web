"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

export default function TeacherClassRegisterPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ enrollments: any[]; trials?: any[] } | null>(null);
  const [cls, setCls] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  const dayToIndex: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  function isDateOnClassDay(dateStr: string, classDay?: string) {
    if (!dateStr || !classDay) return true; // if unknown, don't block
    const d = new Date(dateStr);
    return d.getDay() === dayToIndex[classDay] ?? d.getDay();
  }

  function nextOccurrenceOfClassDay(from: Date, classDay?: string) {
    if (!classDay) return from;
    const target = dayToIndex[classDay];
    if (typeof target !== 'number') return from;
    const d = new Date(from);
    const diff = (target - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + (diff === 0 ? 0 : diff));
    return d;
  }

  function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay(); // 0-6 (Sun-Sat)
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - day);
    return d;
  }

  function occurrenceThisWeek(reference: Date, classDay?: string) {
    if (!classDay) return reference;
    const sow = startOfWeek(reference);
    const idx = dayToIndex[classDay];
    const d = new Date(sow);
    d.setDate(sow.getDate() + (typeof idx === 'number' ? idx : 0));
    return d;
  }

  async function load() {
    try {
      const [enrRes, clsRes] = await Promise.all([
        fetch(`/api/teacher/classes/${id}/enrollments?date=${encodeURIComponent(selectedDate)}`),
        fetch(`/api/classes/${id}`),
      ]);
      if (!enrRes.ok) throw new Error("Failed to load enrollments");
      if (clsRes.ok) setCls(await clsRes.json());
      setData(await enrRes.json());
    } catch (e: any) {
      setError(e?.message || "Unable to load class data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id, selectedDate]);

  // When class meta loads, if selectedDate is not a class day, snap to next occurrence
  const initialized = useRef(false);
  useEffect(() => {
    if (!cls) return;
    if (initialized.current) return; // only set once on initial load
    const thisWeek = occurrenceThisWeek(new Date(), cls?.day).toISOString().slice(0, 10);
    setSelectedDate((prev) => prev || thisWeek);
    initialized.current = true;
  }, [cls]);

  const markAttendance = async (userId: string, childId?: string) => {
    try {
      const res = await fetch(`/api/teacher/classes/${id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, childId, date: selectedDate }),
      });
      if (!res.ok) throw new Error("Failed to mark attendance");
      await load();
    } catch (e) {
      alert("Failed to mark attendance");
    }
  };

  const unmarkAttendance = async (userId: string, childId?: string) => {
    try {
      const res = await fetch(`/api/teacher/classes/${id}/attendance`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, childId, date: selectedDate }),
      });
      if (!res.ok) throw new Error("Failed to unmark attendance");
      await load();
    } catch (e) {
      alert("Failed to unmark attendance");
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

  const markTrialAbsent = async (trialId: string) => {
    try {
      const res = await fetch(`/api/teacher/classes/${id}/trial-absent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trialId }),
      });
      if (!res.ok) throw new Error("Failed to mark trial absent");
      await load();
    } catch (e) {
      alert("Failed to mark trial absent");
    }
  };

  return (
    <DashboardLayout allowedRoles={["teacher", "admin"]}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">{cls?.name ? `${cls.name} Register` : 'Class Register'}</h1>
        {cls && (
          <p className="text-sm text-gray-600 mb-6">{cls?.day} at {cls?.time}</p>
        )}
        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {data && (
          <>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-600">Register date</label>
            <span className="inline-block border rounded px-2 py-1 text-sm bg-white">
              {new Date(selectedDate).toLocaleDateString('en-GB')}
            </span>
            <button
              className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
              onClick={() => {
                const thisWeek = occurrenceThisWeek(new Date(), cls?.day).toISOString().slice(0,10);
                setSelectedDate(thisWeek);
              }}
            >
              Today
            </button>
            <button
              className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
              aria-label="Previous week"
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 7);
                const adj = occurrenceThisWeek(d, cls?.day);
                setSelectedDate(adj.toISOString().slice(0,10));
              }}
            >
              ‹
            </button>
            <button
              className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
              aria-label="Next week"
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 7);
                const adj = occurrenceThisWeek(d, cls?.day);
                setSelectedDate(adj.toISOString().slice(0,10));
              }}
            >
              ›
            </button>
          </div>

          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">Child</th>
                <th className="px-4 py-2 border">Parent</th>
                <th className="px-4 py-2 border">Parent Contact</th>
                <th className="px-4 py-2 border">Medical</th>
                <th className="px-4 py-2 border">Attended (selected)</th>
                <th className="px-4 py-2 border">Total Attended</th>
                <th className="px-4 py-2 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map((e) => {
                const childFull = [e?.child?.firstName, e?.child?.lastName]
                  .filter(Boolean)
                  .join(" ") || e?.user?.name || "-";
                const contact = e?.user?.phone || e?.user?.parentPhone || "-";
                const dates: string[] = (e.attendedDates || []).map((d: string) => String(d).slice(0,10));
                const attendedSelected = dates.includes(selectedDate);
                const isFutureWeek = startOfWeek(new Date(selectedDate)) > startOfWeek(new Date());
                return (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{childFull}</td>
                  <td className="px-4 py-2 border">{[e?.user?.parent?.firstName, e?.user?.parent?.lastName].filter(Boolean).join(" ") || "-"}</td>
                  <td className="px-4 py-2 border">{contact}</td>
                  <td className="px-4 py-2 border">{e?.child?.medical || e.user?.medical || "-"}</td>
                  <td className="px-4 py-2 border">{attendedSelected ? "Yes" : "No"}</td>
                  <td className="px-4 py-2 border">{(e.attendedDates || []).length}</td>
                  <td className="px-4 py-2 border text-center">
                    {attendedSelected ? (
                      <button
                        onClick={() => unmarkAttendance(e.userId, e.childId)}
                        disabled={isFutureWeek}
                        className={`text-sm px-3 py-1 rounded-md ${isFutureWeek ? 'bg-gray-100 text-gray-400 border cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                      >
                        Unmark
                      </button>
                    ) : (
                      <button
                        onClick={() => markAttendance(e.userId, e.childId)}
                        disabled={isFutureWeek}
                        className={`text-sm px-3 py-1 rounded-md ${isFutureWeek ? 'bg-green-100 text-green-300 border cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                      >
                        Mark
                      </button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          </>
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
                                } else if (val === 'absent') {
                                  await markTrialAbsent(String(t._id));
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
                            <option value="attended">Attended</option>
                            <option value="absent">Absent</option>
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





