"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

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

  async function openUserDetails(email) {
    try {
      setDetailLoading(true);
      setDetail(null);
      setDetailOpen(true);
      const res = await fetch(`/api/customers/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load user");
      setDetail(data);
    } catch (e) {
      setDetail({ error: e.message || String(e) });
    } finally {
      setDetailLoading(false);
    }
  }

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
          <>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 border text-left">Parent</th>
                      <th className="px-4 py-2 border text-left">Child</th>
                      <th className="px-4 py-2 border text-left">Email</th>
                      <th className="px-4 py-2 border text-left">Role</th>
                      <th className="px-4 py-2 border text-left">Membership</th>
                      <th className="px-4 py-2 border text-left">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const parentName = `${u?.parent?.firstName || ""}${
                        u?.parent?.firstName && u?.parent?.lastName ? " " : ""
                      }${u?.parent?.lastName || ""}`.trim();
                      const childName = `${u?.child?.firstName || ""}${
                        u?.child?.firstName && u?.child?.lastName ? " " : ""
                      }${u?.child?.lastName || ""}`.trim();
                      return (
                        <tr
                          key={u._id || u.email}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => openUserDetails(u.email)}
                          title="View user details"
                        >
                          <td className="px-4 py-2 border">
                            {parentName || u.name || ""}
                          </td>
                          <td className="px-4 py-2 border">
                            {childName || ""}
                          </td>
                          <td className="px-4 py-2 border">{u.email}</td>
                          <td className="px-4 py-2 border">
                            {u.role || "customer"}
                          </td>
                          <td className="px-4 py-2 border">
                            {u.membership?.status || "none"}
                          </td>
                          <td className="px-4 py-2 border">{u.phone || ""}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          className="px-4 py-6 text-center text-gray-500"
                          colSpan={6}
                        >
                          No users match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {detailOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setDetailOpen(false)}
              >
                <div
                  className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">User Details</h2>
                    <button
                      className="text-sm text-gray-600 hover:underline"
                      onClick={() => setDetailOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  {detailLoading && <p>Loading...</p>}
                  {!detailLoading && detail?.error && (
                    <p className="text-red-600">{detail.error}</p>
                  )}

                  {!detailLoading && detail && !detail.error && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 border rounded p-4">
                        <p>
                          <span className="font-semibold">Email:</span>{" "}
                          {detail.user?.email}
                        </p>
                        <p>
                          <span className="font-semibold">Role:</span>{" "}
                          {detail.user?.role || "customer"}
                        </p>
                        <p>
                          <span className="font-semibold">Phone:</span>{" "}
                          {detail.user?.phone || "-"}
                        </p>
                        <p>
                          <span className="font-semibold">Parent:</span>{" "}
                          {[
                            detail.user?.parent?.firstName,
                            detail.user?.parent?.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || "-"}
                        </p>
                        <p>
                          <span className="font-semibold">Child:</span>{" "}
                          {[
                            detail.user?.child?.firstName,
                            detail.user?.child?.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ") || "-"}
                        </p>
                        <p>
                          <span className="font-semibold">Membership:</span>{" "}
                          {detail.user?.membership?.status || "none"}
                        </p>
                      </div>

                      <div className="bg-gray-50 border rounded p-4">
                        <h3 className="font-semibold mb-2">Bookings</h3>
                        {Array.isArray(detail.bookings) &&
                        detail.bookings.length > 0 ? (
                          <ul className="list-disc list-inside text-sm">
                            {detail.bookings.map((b, i) => (
                              <li key={i}>{JSON.stringify(b)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-600">
                            No bookings yet.
                          </p>
                        )}
                      </div>

                      <div className="bg-gray-50 border rounded p-4">
                        <h3 className="font-semibold mb-2">Payments</h3>
                        {Array.isArray(detail.payments) &&
                        detail.payments.length > 0 ? (
                          <ul className="list-disc list-inside text-sm">
                            {detail.payments.map((p, i) => (
                              <li key={i}>{JSON.stringify(p)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-600">
                            No payments recorded.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
