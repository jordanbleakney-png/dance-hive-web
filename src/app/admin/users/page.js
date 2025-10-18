"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminUsersPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Users</h1>
        <form onSubmit={search} className="flex gap-3 mb-6">
          <input className="flex-1 border rounded-md p-2" type="email" placeholder="Search by email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md" type="submit" disabled={loading}>{loading ? "Searching..." : "Search"}</button>
        </form>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        {result && (
          <div className="bg-white rounded-xl shadow p-5">
            {result.user ? (
              <div>
                <h2 className="text-xl font-semibold mb-2">{result.user.email}</h2>
                <p className="text-gray-600 mb-2">Role: {result.user.role || "customer"}</p>
                <p className="text-gray-600 mb-2">Membership: {result.user.membership?.status || "none"}</p>
                <h3 className="font-semibold mt-4 mb-2">Payments</h3>
                <ul className="list-disc list-inside text-sm">
                  {(result.payments || []).map((p) => (
                    <li key={p._id}>{(p.amount/100)||p.amount} {p.currency?.toUpperCase?.()} — {new Date(p.createdAt || p.timestamp || Date.now()).toLocaleDateString()}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>No user found.</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

