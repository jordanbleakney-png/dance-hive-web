"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const base =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000";

      console.log("ðŸ” Attempting login for:", email);

      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      console.log("ðŸ” Login response:", res);

      if (res?.error) {
        setError("Invalid email or password");
        return;
      }

      // âœ… Fetch session after successful sign-in to get the user role
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();

      console.log("âœ… Session after login:", sessionData);

      const role = sessionData?.user?.role;

      // âœ… Smart redirect based on role
      if (role === "admin") {
        router.push("/admin");
      } else if (role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("ðŸ’¥ Login error:", err);
      setError("Unexpected login error. Check console.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-md w-96"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-4 p-2 border rounded-md"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full mb-4 p-2 border rounded-md"
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
        >
          Log In
        </button>
      </form>
    </div>
  );
}

