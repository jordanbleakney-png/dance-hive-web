"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/payments");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load payments");
        setPayments(data.payments || []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Payments</h1>
        {loading && <p>Loading payments...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && (
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border text-left">Parent Name</th>
                <th className="px-4 py-2 border text-left">Email</th>
                <th className="px-4 py-2 border text-left">Amount</th>
                <th className="px-4 py-2 border text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {(payments || []).map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{p.parentName || ""}</td>
                  <td className="px-4 py-2 border">{p.email}</td>
                  <td className="px-4 py-2 border">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(Number(p.amount) || 0)}</td>
                  <td className="px-4 py-2 border">{new Date(p.createdAt || p.timestamp || Date.now()).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
