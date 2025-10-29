"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import toast from "react-hot-toast";

export default function PreviousCustomersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/previous-customers?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.items || []);
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function restore(email: string) {
    if (!confirm(`Restore ${email}?`)) return;
    setMsg(null);
    try {
      const res = await fetch('/api/admin/users/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok && (res as any).status !== 409) throw new Error(data.error || 'Failed to restore');
      toast.success('User restored');
      setItems((prev)=> prev.filter((x)=> String(x.email).toLowerCase() !== String(email).toLowerCase()));
    } catch (e: any) {
      setMsg(e.message || String(e));
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Previous Customers</h1>
        <div className="flex gap-2 mb-4">
          <input className="border rounded px-3 py-2 w-full" placeholder="Search email" value={q} onChange={(e)=>setQ(e.target.value)} />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={load}>Search</button>
        </div>
        {msg && <div className="mb-3 text-sm text-gray-700">{msg}</div>}
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Parent</th>
                  <th className="px-4 py-2 border text-left">Child</th>
                  <th className="px-4 py-2 border text-left">Email</th>
                  <th className="px-4 py-2 border text-left">Archived</th>
                  <th className="px-4 py-2 border text-left">Reason</th>
                  <th className="px-4 py-2 border text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.email} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border">{it.parentName || '-'}</td>
                    <td className="px-4 py-2 border">{it.childName || '-'}</td>
                    <td className="px-4 py-2 border">{it.email}</td>
                    <td className="px-4 py-2 border">{new Date(it.archivedAt || Date.now()).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-2 border">{it.reason || '-'}</td>
                    <td className="px-4 py-2 border">
                      <button className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded" onClick={()=>restore(it.email)}>Restore</button>
                    </td>
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
