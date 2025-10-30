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
    trialDate: "",
  });
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch all available classes from MongoDB
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes");
        if (!res.ok) throw new Error("Failed to load classes");
        const data = await res.json();
        const normalized = (Array.isArray(data) ? data : []).map((c) => ({
          _id: (c && typeof c._id === "object" && c._id?.$oid) ? c._id.$oid : String(c?._id || ""),
          name: c?.name || "",
          day: c?.day || "",
          time: c?.time || "",
        }));
        setClasses(normalized);
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

  // When class changes, load the next 4 occurrences (dates)
  useEffect(() => {
    (async () => {
      if (!form.classId) { setDates([]); setForm((p)=>({ ...p, trialDate: "" })); return; }
      try {
        const res = await fetch(`/api/classes/${form.classId}/occurrences?weeks=4`);
        if (!res.ok) throw new Error("Failed to load dates");
        const data = await res.json();
        setDates(Array.isArray(data) ? data : []);
        const first = (Array.isArray(data) && data[0]?.date) ? data[0].date : "";
        setForm((prev) => ({ ...prev, trialDate: first }));
      } catch (err) {
        console.error(err);
        setDates([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.classId]);

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
        setShowSuccess(true);
        setForm({
          parentFirstName: "",
          parentLastName: "",
          email: "",
          parentPhone: "",
          childFirstName: "",
          childLastName: "",
          childAge: "",
          classId: "",
          trialDate: "",
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
            <label className="block text-gray-700 mb-1">Child's First Name</label>
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
            <label className="block text-gray-700 mb-1">Child's Surname</label>
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
            <label className="block text-gray-700 mb-1">Child's Age</label>
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
            <label className="block text-gray-700 mb-1">Parent's First Name</label>
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
            <label className="block text-gray-700 mb-1">Parent's Surname</label>
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
            <label className="block text-gray-700 mb-1">Email</label>
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
            <label className="block text-gray-700 mb-1">Phone</label>
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

          {/* Select Date (appears after class selection) */}
          <div>
            <label className="block text-gray-700 mb-1">Select Date</label>
            <select
              name="trialDate"
              value={form.trialDate}
              onChange={handleChange}
              required
              disabled={!form.classId}
              className="w-full border border-gray-300 rounded-md p-2 disabled:bg-gray-100"
            >
              <option value="">-- Choose a date --</option>
              {dates.map((d) => (
                <option key={d.date} value={d.date}>{d.label}</option>
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

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 text-center">
            <h2 className="font-bold text-xl mb-3 text-balance">
              Thank you for booking your free trial
              <br />
              we can’t wait to meet you!
            </h2>
            <p className="text-gray-700 mb-6">
              Keep an eye on your inbox for your class confirmation, along with all the details you’ll need about what to expect on the day.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => { setShowSuccess(false); window.location.href = "/"; }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
