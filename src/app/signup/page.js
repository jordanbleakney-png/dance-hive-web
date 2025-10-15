"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trialId = searchParams.get("trialId");
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    parentName: "",
    email: "",
    parentPhone: "",
    childName: "",
    childAge: "",
    classId: "",
    password: "",
    confirmPassword: "",
  });

  // 📦 Fetch classes
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/classes");
        const data = await res.json();
        setClasses(data);
      } catch (err) {
        toast.error("Failed to load classes");
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

  // 🧩 If a trial ID is provided, prefill form
  useEffect(() => {
    async function fetchTrial() {
      if (!trialId) return;
      try {
        const res = await fetch(`/api/trials/${trialId}`);
        if (!res.ok) return;
        const trial = await res.json();
        setForm((prev) => ({
          ...prev,
          parentName: trial.parentName || "",
          email: trial.email || "",
          parentPhone: trial.parentPhone || "",
          childName: trial.childName || "",
          childAge: trial.childAge || "",
          classId: trial.classId || "",
        }));
      } catch (err) {
        console.error(err);
      }
    }
    fetchTrial();
  }, [trialId]);

  // 🧾 Handle input
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 💳 Submit form (creates Stripe Checkout session)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Payment failed");

      toast.success("Redirecting to payment...");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <p className="p-10 text-center">Loading classes...</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">
        💃 Join Dance Hive
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-md space-y-4"
      >
        <h2 className="text-xl font-semibold mb-2">Parent Details</h2>
        <input
          type="text"
          name="parentName"
          placeholder="Parent Name"
          value={form.parentName}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        />
        <input
          type="email"
          name="email"
          placeholder="email"
          value={form.email}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        />
        <input
          type="text"
          name="parentPhone"
          placeholder="Parent Phone"
          value={form.parentPhone}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        />

        <h2 className="text-xl font-semibold mt-4 mb-2">Child Details</h2>
        <input
          type="text"
          name="childName"
          placeholder="Child Name"
          value={form.childName}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        />
        <input
          type="number"
          name="childAge"
          placeholder="Child Age"
          value={form.childAge}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        />

        <h2 className="text-xl font-semibold mt-4 mb-2">Class Selection</h2>
        <select
          name="classId"
          value={form.classId}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        >
          <option value="">Select a Class</option>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name} — {c.day} {c.time}
            </option>
          ))}
        </select>

        <h2 className="text-xl font-semibold mt-4 mb-2">Create Password</h2>
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={form.confirmPassword}
          onChange={handleChange}
          required
          className="w-full border rounded-md p-2"
        />

        <button
          type="submit"
          className="w-full bg-pink-500 text-white py-2 rounded-md hover:bg-pink-600 transition"
        >
          Continue to Payment £30/mo
        </button>
      </form>
    </div>
  );
}
