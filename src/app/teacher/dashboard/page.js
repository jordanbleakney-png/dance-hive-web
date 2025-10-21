"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function TeacherDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teacher/classes");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load classes");
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout allowedRoles={["teacher", "admin"]}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Teacher Dashboard</h1>
        <p className="text-gray-600 mb-6">Select a class to view the register.</p>
        {loading && <p>Loading classes...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && items.length === 0 && (
          <p className="text-gray-600">No classes assigned.</p>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((c) => (
            <Link
              key={c._id}
              href={`/teacher/classes/${c._id}`}
              className="block bg-white rounded-xl shadow p-5 hover:shadow-lg transition"
            >
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <p className="text-gray-600">{c.day} {c.time && `at ${c.time}`}</p>
              {c.instructor && (
                <p className="text-xs text-gray-500 mt-1">Teacher: {c.instructor}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
