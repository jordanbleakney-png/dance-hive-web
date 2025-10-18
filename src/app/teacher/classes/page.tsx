"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function TeacherClassesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teacher/classes");
        if (!res.ok) throw new Error("Failed to load classes");
        setItems(await res.json());
      } catch (e: any) {
        setError(e?.message || "Unable to load classes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardLayout allowedRoles={["teacher", "admin"]}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">My Classes</h1>
        {loading && <p>Loading classes...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && items.length === 0 && <p>No classes assigned.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((c) => (
            <Link
              key={c._id}
              href={`/teacher/classes/${c._id}`}
              className="block bg-white rounded-xl shadow p-5 hover:shadow-lg transition"
            >
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <p className="text-gray-600">{c.day} {c.time && `at ${c.time}`}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

