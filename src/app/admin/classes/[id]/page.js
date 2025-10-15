"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🚨 Redirect if not admin
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/");
    }
  }, [status, session, router]);

  // 🧠 Fetch class + enrolled students
  useEffect(() => {
    async function fetchClassData() {
      try {
        const res = await fetch(`/api/admin/classes/${id}`);
        if (!res.ok) throw new Error("Failed to load class details");
        const data = await res.json();
        setClassInfo(data.classInfo);
        setStudents(data.students);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchClassData();
  }, [id]);

  if (loading)
    return <p className="p-10 text-center">Loading class details...</p>;

  if (!classInfo)
    return <p className="p-10 text-center text-red-500">Class not found.</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{classInfo.name}</h1>
        <Link
          href="/admin/classes"
          className="bg-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 transition"
        >
          ← Back to Classes
        </Link>
      </div>

      <p className="text-gray-600 mb-2">
        <strong>Day:</strong> {classInfo.day}
      </p>
      <p className="text-gray-600 mb-2">
        <strong>Time:</strong> {classInfo.time}
      </p>
      <p className="text-gray-600 mb-6">
        <strong>Instructor:</strong> {classInfo.instructor || "TBA"}
      </p>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">🧒 Enrolled Students</h2>

        {students.length === 0 ? (
          <p>No students enrolled yet.</p>
        ) : (
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">Child Name</th>
                <th className="px-4 py-2 border">Age</th>
                <th className="px-4 py-2 border">Parent</th>
                <th className="px-4 py-2 border">Contact</th>
                <th className="px-4 py-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{s.childName}</td>
                  <td className="px-4 py-2 border">{s.childAge}</td>
                  <td className="px-4 py-2 border">{s.parentName}</td>
                  <td className="px-4 py-2 border text-blue-600">
                    {s.parentPhone || s.email}
                  </td>
                  <td className="px-4 py-2 border">
                    <select
                      value={s.membership?.status || "pending"}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        const res = await fetch(
                          `/api/admin/classes/${id}/update-student`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              email: s.email,
                              status: newStatus,
                            }),
                          }
                        );
                        if (res.ok) {
                          setStudents((prev) =>
                            prev.map((stu) =>
                              stu._id === s._id
                                ? {
                                    ...stu,
                                    membership: {
                                      ...stu.membership,
                                      status: newStatus,
                                    },
                                  }
                                : stu
                            )
                          );
                        }
                      }}
                      className="border rounded-md px-2 py-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove ${s.childName} from this class?`))
                          return;
                        const res = await fetch(
                          `/api/admin/classes/${id}/remove-student`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              email: s.email || s.email,
                            }),
                          }
                        );
                        if (res.ok) {
                          setStudents((prev) =>
                            prev.filter((stu) => stu._id !== s._id)
                          );
                        }
                      }}
                      className="bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600 transition"
                    >
                      Remove
                    </button>
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
