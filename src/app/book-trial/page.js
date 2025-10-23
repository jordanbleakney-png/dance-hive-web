"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function BookTrialPage() {
  const searchParams = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({
    parentFirstName: "",
    parentLastName: "",
    email: "",
    parentPhone: "",
    childFirstName: "",
    childLastName: "",
    childAge: "",
    classId: "",
  });
  const [loading, setLoading] = useState(false);

  // Fetch all available classes from MongoDB
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes");
        if (!res.ok) throw new Error("Failed to load classes");
        const data = await res.json();
        setClasses(data);
      } catch (err) {
        console.error(err);
        toast.error("Unable to load classes");
      }
    }
    loadClasses();
  }, []);

  // Preselect class from query param if provided
  useEffect(() => {
    const cid = searchParams?.get("classId");
    if (!cid) return;
    setForm((prev) => ({ ...prev, classId: cid }));
  }, [searchParams]);

  // Handle form input
  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Handle submission
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Trial booked successfully!");
        setForm({
          parentFirstName: "",
          parentLastName: "",
          email: "",
          parentPhone: "",
          childFirstName: "",
          childLastName: "",
          childAge: "",
          classId: "",
        });
      } else {
        toast.error(data.error || "Something went wrong.");
      }
    } catch (err) {
      toast.error("Failed to submit form.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex justify-center">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-4 text-center text-blue-600">Book Your Free Trial Class</h1>
        <p className="text-gray-600 text-center mb-8">
          Fill in your details below to book your childs free trial lesson.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Child Info */}
          <div>
            <label className="block text-gray-700 mb-1">Childs Name</label>
            <input
              type="text"
              name="childFirstName"
              value={form.childFirstName}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Child Last Name</label>
            <input
              type="text"
              name="childLastName"
              value={form.childLastName}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Childs Age</label>
            <input
              type="number"
              name="childAge"
              value={form.childAge}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          {/* Parent Info */}
          <div>
            <label className="block text-gray-700 mb-1">Parents Name</label>
            <input
              type="text"
              name="parentFirstName"
              value={form.parentFirstName}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Parent Last Name</label>
            <input
              type="text"
              name="parentLastName"
              value={form.parentLastName}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Parents Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Parents Phone</label>
            <input
              type="tel"
              name="parentPhone"
              value={form.parentPhone}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          {/* Select Class */}
          <div>
            <label className="block text-gray-700 mb-1">Select Class</label>
            <select
              name="classId"
              value={form.classId}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md p-2"
            >
              <option value="">-- Choose a class --</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} - {c.day} at {c.time}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? "Booking..." : "Book Trial"}
          </button>
        </form>
      </div>
    </div>
  );
}

