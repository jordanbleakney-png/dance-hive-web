"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ClassItem = {
  _id: string;
  name: string;
  day?: string;
  time?: string;
  instructor?: string;
};

const DESCRIPTIONS: Record<string, string> = {
  "Hive Tots":
    "For children aged 18 months up to 3 years, and their grown-ups! A buzzing blend of ballet, acrobatics and general dance skills—movement, music and magical moments to build coordination, balance and confidence.",
  "Hive Preschool Ballet":
    "For little dancers aged 3 to 4 years—explore the world through the magic of ballet! Imagination and movement take flight while developing ballet skills, coordination, balance and confidence.",
  "Hive Preschool Acro":
    "For little dancers aged 2.5 to 4 years who want to jump, roll and buzz with energy! A bee-autiful fusion of acrobatics and dance, building strength, balance and flexibility—foundations for rolls, cartwheels and handstands.",
};

const AGE_RANGES: Record<string, string> = {
  "Hive Tots": "18 months – 3 years",
  "Hive Preschool Ballet": "3 – 4 years",
  "Hive Preschool Acro": "2.5 – 4 years",
};

export default function ClassesPage() {
  const [items, setItems] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/classes");
        if (!res.ok) throw new Error("Failed to load classes");
        const data = await res.json();
        setItems(
          (data || []).map((c: any) => ({
            _id: String(c._id),
            name: c.name,
            day: c.day,
            time: c.time,
            instructor: c.instructor,
          }))
        );
      } catch (e: any) {
        setError(e?.message || "Unable to load classes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasResults = useMemo(() => items && items.length > 0, [items]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Dance Hive Classes</h1>

      {loading && (
        <p className="text-center text-gray-600">Loading classes...</p>
      )}
      {error && (
        <p className="text-center text-red-600">{error}</p>
      )}

      {hasResults ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((cls) => (
            <div key={cls._id} className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold mb-1">{cls.name}</h2>
              {AGE_RANGES[cls.name] && (
                <p className="text-xs text-gray-500 mb-1">{AGE_RANGES[cls.name]}</p>
              )}
              {(cls.day || cls.time) && (
                <p className="text-gray-600 mb-2">
                  {cls.day} {cls.time && `at ${cls.time}`}
                </p>
              )}
              <p className="text-gray-500 mb-4">
                {DESCRIPTIONS[cls.name] || "A fun and engaging class for our young dancers."}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {cls.instructor ? `Teacher: ${cls.instructor}` : "Teacher: TBA"}
                </span>
                <Link
                  href={`/book-trial?classId=${encodeURIComponent(cls._id)}`}
                  className="bg-pink-500 hover:bg-pink-600 text-white text-sm px-4 py-2 rounded-md transition"
                >
                  Book Trial
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
            <p className="mb-4">
              No classes found in the database yet. Here are our starter classes:
            </p>
            {["Hive Tots", "Hive Preschool Ballet", "Hive Preschool Acro"].map(
              (name) => (
                <div key={name} className="border-t first:border-t-0 py-4">
                  <h2 className="text-xl font-semibold mb-1">{name}</h2>
                  <p className="text-gray-600 mb-2">{DESCRIPTIONS[name]}</p>
                  <Link
                    href="/book-trial"
                    className="inline-block bg-pink-500 hover:bg-pink-600 text-white text-sm px-4 py-2 rounded-md transition"
                  >
                    Book Trial
                  </Link>
                </div>
              )
            )}
          </div>
        )
      )}
    </div>
  );
}
