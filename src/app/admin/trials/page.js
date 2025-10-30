"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AdminTrialsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classMap, setClassMap] = useState({});
  const [occMap, setOccMap] = useState({}); // { [classId]: [{date,label}] }

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
        // Warm occurrences cache for distinct classIds
        const ids = Array.from(new Set((data.trials || []).map((t) => String(t.classId)).filter(Boolean)));
        if (ids.length) {
          Promise.all(
            ids.map(async (cid) => {
              try {
                const r2 = await fetch(`/api/classes/${cid}/occurrences?weeks=4`);
                const d2 = await r2.json();
                return { cid, opts: Array.isArray(d2) ? d2 : [] };
              } catch {
                return { cid, opts: [] };
              }
            })
          ).then(list => {
            setOccMap((prev) => {
              const next = { ...prev };
              list.forEach(({ cid, opts }) => { next[cid] = opts; });
              return next;
            });
          });
        }
      } catch (err) {
        console.error(err);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") fetchTrials();
  }, [status]);

  // Fetch classes to map classId -> name
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/classes");
        if (!res.ok) return;
        const data = await res.json();
        const map = {};
        (data || []).forEach((c) => {
          if (c && c._id) map[String(c._id)] = c.name || String(c._id);
        });
        setClassMap(map);
      } catch {}
    })();
  }, []);

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

  async function updateTrialDate(id, classId, newDate) {
    try {
      const res = await fetch("/api/admin/trials/update-trial-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, trialDate: newDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update trial date");
      toast.success("Trial date updated");
      setTrials((prev) => prev.map((t)=> t._id === id ? { ...t, trialDate: newDate } : t));
    } catch (err) {
      toast.error(err.message || "Failed to update date");
    }
  }

  if (status === "loading" || loading)
    return (<DashboardLayout allowedRoles={["admin"]}><p className="p-10 text-center">Loading trial bookings...</p></DashboardLayout>);

  return (
      <DashboardLayout allowedRoles={["admin"]}><div className="p-6"><h1 className="text-3xl font-bold mb-6">Trial Bookings</h1><div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
        <table className="min-w-full border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border">Child</th>
              <th className="px-4 py-2 border">Age</th>
              <th className="px-4 py-2 border">Class</th>
              <th className="px-4 py-2 border">Parent</th>
              <th className="px-4 py-2 border">Email</th>
              <th className="px-4 py-2 border">Phone</th>
              <th className="px-4 py-2 border">Status</th>
              <th className="px-4 py-2 border">Trial Date</th>
              <th className="px-4 py-2 border">Actions</th>
              <th className="px-4 py-2 border">Date</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t) => (
              <tr key={t._id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{
                  [t?.child?.firstName, t?.child?.lastName]
                    .filter(Boolean)
                    .join(" ") || t.childName || ""
                }</td>
                <td className="px-4 py-2 border text-center">{t.childAge}</td>
                <td className="px-4 py-2 border text-sm">{classMap[t.classId] || t.className || t.classId}</td>
                <td className="px-4 py-2 border">{
                  [t?.parent?.firstName, t?.parent?.lastName]
                    .filter(Boolean)
                    .join(" ") || t.parentName || ""
                }</td>
                <td className="px-4 py-2 border text-blue-600 underline cursor-pointer">
                  <a href={`mailto:${t.email}`}>{t.email}</a>
                </td>
                <td className="px-4 py-2 border">{t.phone || t.parentPhone || ""}</td>

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

                {/* Trial Date */}
                <td className="px-4 py-2 border text-sm">
                  <select
                    className="border rounded-md p-1"
                    value={(t.trialDate ? String(t.trialDate).slice(0,10) : "")}
                    onChange={(e) => updateTrialDate(t._id, String(t.classId), e.target.value)}
                    onFocus={async () => {
                      const cid = String(t.classId);
                      if (!occMap[cid]) {
                        try {
                          const r2 = await fetch(`/api/classes/${cid}/occurrences?weeks=4`);
                          const d2 = await r2.json();
                          setOccMap((p)=> ({ ...p, [cid]: Array.isArray(d2) ? d2 : [] }));
                        } catch {}
                      }
                    }}
                  >
                    <option value="">-- Choose a date --</option>
                    {(occMap[String(t.classId)] || []).map((opt) => (
                      <option key={opt.date} value={opt.date}>{opt.label}</option>
                    ))}
                  </select>
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
                    <option value="absent">Absent</option>
                    <option value="converted">Converted</option>
                  </select>
                </td>

                <td className="px-4 py-2 border text-sm">
                  {t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}
                </td>
              </tr>
            ))}
            {Array.isArray(trials) && trials.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={10}>
                  No trial bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table></div></div></DashboardLayout>
  );
}


