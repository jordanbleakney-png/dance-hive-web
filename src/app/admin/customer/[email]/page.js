"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function CustomerPage() {
  const router = useRouter();
  const params = useParams();
  const { email } = params;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/customers/${email}`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [email]);

  if (loading) return <p className="p-10 text-center">Loading customer details...</p>;
  if (!data || !data.user) return <p className="p-10 text-center text-red-500">No data found.</p>;

  const { user, enrollments = [], payments = [] } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Back Button */}
      <button onClick={() => router.back()} className="mb-4 text-blue-600 underline hover:text-blue-800">
        Back to Admin Dashboard
      </button>

      {/* Customer Info */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-8">
        <h1 className="text-2xl font-bold mb-2">{user.name || `${user?.parent?.firstName || ""} ${user?.parent?.lastName || ""}`.trim()}</h1>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p className="mb-2">
          <strong>Role:</strong> {user.role}
        </p>
        {user.createdAt && (
          <p>
            <strong>Account Created:</strong> {new Date(user.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Enrollments */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Enrolled Classes</h2>
        {enrollments.length === 0 ? (
          <p>No enrollments yet.</p>
        ) : (
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border text-left">Class</th>
                <th className="px-4 py-2 border text-left">Schedule</th>
                <th className="px-4 py-2 border text-left">Teacher</th>
                <th className="px-4 py-2 border text-left">Status</th>
                <th className="px-4 py-2 border text-left">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{e.class?.name || ""}</td>
                  <td className="px-4 py-2 border">{[e.class?.day, e.class?.time].filter(Boolean).join(" | ")}</td>
                  <td className="px-4 py-2 border">{e.class?.instructor || "TBA"}</td>
                  <td className="px-4 py-2 border capitalize">{e.status || "active"}</td>
                  <td className="px-4 py-2 border text-sm">{e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">Payments</h2>
        {payments.length === 0 ? (
          <p>No payments recorded.</p>
        ) : (
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border text-left">Amount</th>
                <th className="px-4 py-2 border text-left">Status</th>
                <th className="px-4 py-2 border text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const currency = String(p?.currency || "GBP").toUpperCase();
                const amount = Number(p?.amount) || 0;
                const amountText = new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
                const status = p?.payment_status || p?.status || "paid";
                const dateText = new Date(p?.createdAt || p?.timestamp || Date.now()).toLocaleString();
                return (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border">{amountText}</td>
                    <td className="px-4 py-2 border capitalize">{status}</td>
                    <td className="px-4 py-2 border text-sm">{dateText}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
