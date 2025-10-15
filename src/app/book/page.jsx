"use client";

import { useState } from "react";

export default function BookTrialPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    danceStyle: "",
  });
  const [message, setMessage] = useState("");

  // handle input change
  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  // handle form submit
  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("⏳ Sending booking...");

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Booking successful! We’ll be in touch soon.");
        setFormData({ name: "", email: "", phone: "", danceStyle: "" });
      } else {
        setMessage(`❌ ${data.message || "Something went wrong"}`);
      }
    } catch (err) {
      setMessage("❌ Network error. Try again later.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Book Your Free Trial Class</h1>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-6 rounded-2xl shadow-md"
      >
        <label className="block mb-2 font-medium">Name</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="w-full mb-4 p-2 border rounded-md"
          required
        />

        <label className="block mb-2 font-medium">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full mb-4 p-2 border rounded-md"
          required
        />

        <label className="block mb-2 font-medium">Phone</label>
        <input
          type="text"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="w-full mb-4 p-2 border rounded-md"
          required
        />

        <label className="block mb-2 font-medium">Dance Style</label>
        <select
          name="danceStyle"
          value={formData.danceStyle}
          onChange={handleChange}
          className="w-full mb-6 p-2 border rounded-md"
          required
        >
          <option value="">Select a style</option>
          <option value="Hip Hop">Hip Hop</option>
          <option value="Ballet">Ballet</option>
          <option value="Contemporary">Contemporary</option>
          <option value="Jazz">Jazz</option>
        </select>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
        >
          Book Trial
        </button>
      </form>

      {message && (
        <p className="mt-6 text-center text-lg font-medium">{message}</p>
      )}
    </div>
  );
}
