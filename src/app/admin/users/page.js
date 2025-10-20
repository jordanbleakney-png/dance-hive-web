"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load users");
        setUsers(data.users || []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [
        u.email,
        u.role,
        u.parent?.firstName,
        u.parent?.lastName,
        u.child?.firstName,
        u.child?.lastName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [users, query]);

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        <div className="flex gap-3 mb-4">
          <input
            className="flex-1 border rounded-md p-2"
            type="text"
            placeholder="Search by name, email or role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Parent</th>
                  <th className="px-4 py-2 border text-left">Email</th>
                  <th className="px-4 py-2 border text-left">Role</th>
                  <th className="px-4 py-2 border text-left">Membership</th>
                  <th className="px-4 py-2 border text-left">Phone</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const parentName = `${u?.parent?.firstName || ""}${u?.parent?.firstName && u?.parent?.lastName ? " " : ""}${u?.parent?.lastName || ""}`.trim();
                  return (
                    <tr key={u._id || u.email} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">{parentName || u.name || ""}</td>
                      <td className="px-4 py-2 border">{u.email}</td>
                      <td className="px-4 py-2 border">{u.role || "customer"}</td>
                      <td className="px-4 py-2 border">{u.membership?.status || "none"}</td>
                      <td className="px-4 py-2 border">{u.phone || ""}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                      No users match your search.
                    </td>
                  </tr>
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
