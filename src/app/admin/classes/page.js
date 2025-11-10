"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminClassesPage() {
  const { data: session, status } = useSession();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    style: "",
    instructor: "",
    day: "Monday",
    time: "18:00",
    capacity: "0",
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // 🚨 Redirect if not admin
  // Auth handled by DashboardLayout

  // 🧠 Fetch classes with student count
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/admin/classes");
        if (!res.ok) throw new Error("Failed to fetch classes");
        const data = await res.json();
        setClasses(data);
      } catch (err) {
        console.error("Error fetching classes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

  if (loading)
    return (
      <DashboardLayout allowedRoles={["admin"]}>
        <p className="text-center p-10">Loading classes...</p>
      </DashboardLayout>
    );

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="p-2 sm:p-6 relative">
        <div className="flex items-center justify-center">
          <h1 className="text-3xl font-bold mb-6 text-center">Dance Classes</h1>
        </div>
        <div className="absolute right-8 top-8">
          <button
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? "Close" : "Add Class"}
          </button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <Link
              key={cls._id}
              href={`/admin/classes/${cls._id}`}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition block"
            >
              <h2 className="text-xl font-semibold mb-2">{cls.name}</h2>
              <p className="text-gray-600">
                {cls.day} at {cls.time}
              </p>
              <p className="text-gray-500 mb-2">
                Teacher: <strong>{cls.instructor || "TBA"}</strong>
              </p>
              <p className="font-medium text-pink-600">
                {cls.studentCount ?? 0} student
                {cls.studentCount === 1 ? "" : "s"}
              </p>
              <div className="mt-4">
                <button
                  className="text-sm text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!confirm("Delete class?")) return;
                    try {
                      const res = await fetch(`/api/admin/classes/${cls._id}`, {
                        method: "DELETE",
                      });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error || "Failed");
                      setClasses((prev) =>
                        prev.filter((c) => c._id !== cls._id)
                      );
                    } catch (err) {
                      alert(err.message || "Failed to delete");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </Link>
          ))}
        </div>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Add a Class</h2>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close add class form"
                  onClick={() => setShowAddForm(false)}
                  title="Close"
                >
                  ×
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <input
                  className="border rounded p-2"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="border rounded p-2"
                  placeholder="Style (optional)"
                  value={form.style}
                  onChange={(e) => setForm({ ...form, style: e.target.value })}
                />
                <input
                  className="border rounded p-2"
                  placeholder="Instructor"
                  value={form.instructor}
                  onChange={(e) =>
                    setForm({ ...form, instructor: e.target.value })
                  }
                />
                <select
                  className="border rounded p-2"
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                >
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  className="border rounded p-2"
                  placeholder="Time (e.g., 18:00)"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
                <input
                  className="border rounded p-2"
                  type="number"
                  placeholder="Capacity"
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/admin/classes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ...form,
                          capacity: Number(form.capacity || 0),
                        }),
                      });
                      const d = await res.json();
                      if (!res.ok) throw new Error(d.error || "Failed to add");
                      const r = await fetch("/api/admin/classes");
                      setClasses(await r.json());
                      setForm({ ...form, name: "", style: "", instructor: "" });
                      setShowAddForm(false);
                    } catch (e) {
                      alert(e.message || "Failed to add");
                    }
                  }}
                >
                  Add Class
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
