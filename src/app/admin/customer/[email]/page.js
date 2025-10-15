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
      const res = await fetch(`/api/customers/${email}`);
      if (res.ok) {
        const data = await res.json();
        setData(data);
      }
      setLoading(false);
    }
    fetchData();
  }, [email]);

  if (loading)
    return <p className="p-10 text-center">Loading customer details...</p>;
  if (!data || !data.user)
    return <p className="p-10 text-center text-red-500">No data found.</p>;

  const { user, bookings, payments } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mb-4 text-blue-600 underline hover:text-blue-800"
      >
        ← Back to Admin Dashboard
      </button>

      {/* Customer Info */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-8">
        <h1 className="text-2xl font-bold mb-2">{user.name}</h1>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p className="mb-2">
          <strong>Role:</strong> {user.role}
        </p>
        <p>
          <strong>Account Created:</strong>{" "}
          {new Date(user.createdAt).toLocaleDateString()}
        </p>

        {/* Admin Controls — Change Role */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Change Role</h3>
          <div className="flex gap-2">
            {["trial", "member", "admin"].map((role) => (
              <button
                key={role}
                onClick={async () => {
                  const res = await fetch("/api/customers/update-role", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: user.email, newRole: role }),
                  });

                  if (res.ok) {
                    alert(`User role updated to ${role}!`);
                    window.location.reload();
                  } else {
                    alert("Error updating role.");
                  }
                }}
                className={`px-4 py-2 rounded-md text-white transition ${
                  user.role === role
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
                disabled={user.role === role}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bookings */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Bookings</h2>
        {bookings.length === 0 ? (
          <p>No bookings yet.</p>
        ) : (
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">Dance Style</th>
                <th className="px-4 py-2 border">Status</th>
                <th className="px-4 py-2 border">Date</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{b.danceStyle}</td>
                  <td className="px-4 py-2 border">{b.status}</td>
                  <td className="px-4 py-2 border text-sm">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
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
                <th className="px-4 py-2 border">Amount</th>
                <th className="px-4 py-2 border">Currency</th>
                <th className="px-4 py-2 border">Status</th>
                <th className="px-4 py-2 border">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">£{p.amount}</td>
                  <td className="px-4 py-2 border">{p.currency}</td>
                  <td className="px-4 py-2 border">
                    {p.payment_status === "paid" ? (
                      <span className="text-green-600 font-semibold">Paid</span>
                    ) : (
                      <span className="text-red-600 font-semibold">
                        {p.payment_status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 border text-sm">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
