"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminClassesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🚨 Redirect if not admin
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/");
    }
  }, [status, session, router]);

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

  if (loading) return <p className="text-center p-10">Loading classes...</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">📚 Dance Classes</h1>

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
              {cls.studentCount ?? 0} student{cls.studentCount === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
