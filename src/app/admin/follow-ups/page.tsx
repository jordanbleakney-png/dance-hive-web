"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminFollowUpsPage() {
  const { status } = useSession();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'attended' | 'absent'>('all');

  useEffect(() => {
    (async () => {
      if (status !== "authenticated") return;
      try {
        const qs = new URLSearchParams();
        if (statusFilter !== 'all') qs.set('status', statusFilter);
        qs.set('contacted', 'false');
        const res = await fetch(`/api/admin/follow-ups?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load follow ups");
        setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load follow ups");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, statusFilter]);

  if (status === "loading" || loading) {
    return (
      <DashboardLayout allowedRoles={["admin"]}>
        <p className="p-10 text-center">Loading follow ups...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Follow Ups</h1>
        {/* Filter */}
        <div className="mb-4">
          <label className="mr-2 text-sm text-gray-600">Filter by</label>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e)=> setStatusFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="attended">Attended</option>
            <option value="absent">Absent</option>
          </select>
        </div>
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <div className="bg-white rounded-xl shadow">
            <div className="rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border text-left whitespace-nowrap">Parent</th>
                    <th className="px-4 py-2 border text-left whitespace-nowrap">Child</th>
                    <th className="px-4 py-2 border text-left whitespace-nowrap">Class</th>
                    <th className="px-4 py-2 border text-left whitespace-nowrap">Phone</th>
                    <th className="px-4 py-2 border text-left">Email</th>
                    <th className="px-4 py-2 border text-left">Trial Date</th>
                    <th className="px-4 py-2 border text-left">Status</th>
                    <th className="px-4 py-2 border text-left">Notes</th>
                    <th className="px-4 py-2 border text-left">Contacted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 text-center text-gray-500">No follow ups.</td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r._id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-2 border whitespace-nowrap">{r.parentFullName}</td>
                        <td className="px-4 py-2 border whitespace-nowrap">{r.childFullName}</td>
                        <td className="px-4 py-2 border whitespace-nowrap">{r.className || r.classId || '-'}</td>
                        <td className="px-4 py-2 border whitespace-nowrap">{r.phone || '-'}</td>
                        <td className="px-4 py-2 border">{r.email}</td>
                        <td className="px-4 py-2 border">{r.trialDate ? new Date(r.trialDate).toLocaleDateString('en-GB') : '-'}</td>
                        <td className="px-4 py-2 border">
                          {r.status === 'attended' && (
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">Attended</span>
                              <span className="text-gray-500 text-xs">{r.attendedAt ? new Date(r.attendedAt).toLocaleString() : ''}</span>
                            </span>
                          )}
                          {r.status === 'absent' && (
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">Absent</span>
                              <span className="text-gray-500 text-xs">{r.absentAt ? new Date(r.absentAt).toLocaleString() : ''}</span>
                            </span>
                          )}
                        </td>
                        {/* Notes */}
                        <td className="px-0 py-0 border">
                          <div
                            className="w-full min-h-[42px] px-4 py-2 text-sm whitespace-pre-wrap focus:outline-none"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={async (e)=>{
                              const val = (e.currentTarget as HTMLDivElement).textContent || '';
                              try {
                                const res = await fetch('/api/admin/follow-ups', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: r._id, notes: val })
                                });
                                if (!res.ok) throw new Error('Failed to save');
                                setRows(prev => prev.map(x => x._id === r._id ? { ...x, notes: val } : x));
                              } catch {
                                alert('Failed to save note');
                              }
                            }}
                          >
                            {r.notes || ''}
                          </div>
                        </td>
                        <td className="px-4 py-2 border">
                          {r.contacted ? (
                            <div className="flex items-center gap-3 whitespace-nowrap">
                              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">Contacted</span>
                              <span className="text-gray-500 text-xs">{r.contactedAt ? new Date(r.contactedAt).toLocaleDateString('en-GB') : ''}</span>
                              <button
                                className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 whitespace-nowrap"
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/admin/follow-ups', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: r._id, contacted: false })
                                    });
                                    if (!res.ok) throw new Error('Failed to update');
                                    setRows(prev => prev.map(x => x._id === r._id ? { ...x, contacted: false, contactedAt: null } : x));
                                  } catch {
                                    alert('Failed to update');
                                  }
                                }}
                              >Undo</button>
                            </div>
                          ) : (
                            <button
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded whitespace-nowrap"
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/admin/follow-ups', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: r._id, contacted: true })
                                  });
                                  if (!res.ok) throw new Error('Failed to update');
                                  setRows(prev => prev.map(x => x._id === r._id ? { ...x, contacted: true, contactedAt: new Date().toISOString() } : x));
                                } catch {
                                  alert('Failed to update');
                                }
                              }}
                            >Mark Contacted</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
