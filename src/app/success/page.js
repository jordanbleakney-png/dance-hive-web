"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!email) return;

    async function checkMembershipStatus() {
      try {
        // Wait briefly to allow Stripe webhook to finish updating MongoDB
        await new Promise((r) => setTimeout(r, 1500));

        const res = await fetch(`/api/users/status?email=${email}`);
        const data = await res.json();

        if (!res.ok) {
          console.error("❌ API Error:", data);
          setStatus("error");
          return;
        }

        setUser(data);
        setStatus("success");

        // ✅ Redirect automatically after 4 seconds
        setTimeout(() => {
          router.push("/dashboard?from=success");
        }, 4000);
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setStatus("error");
      }
    }

    checkMembershipStatus();
  }, [email, router]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
        <h1 className="text-2xl font-bold">Verifying your membership...</h1>
        <p>Please wait a moment while we confirm your payment.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-red-50">
        <h1 className="text-2xl font-bold text-red-600">
          Something went wrong
        </h1>
        <p>We couldn’t verify your membership. Please contact support.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-green-50 transition-all">
      <h1 className="text-3xl font-bold text-green-700">
        🎉 Payment Successful!
      </h1>
      <p className="mt-2 text-lg">Your membership has been activated.</p>

      <div className="bg-white shadow-md p-6 mt-6 rounded-lg w-96 text-center">
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
        <p>
          <strong>Role:</strong> {user?.role}
        </p>
        <p>
          <strong>Status:</strong>{" "}
          {user?.membershipStatus === "active" ? "✅ Active" : "❌ Inactive"}
        </p>
      </div>

      <p className="mt-4 text-gray-700 text-sm">
        Redirecting you to your dashboard...
      </p>

      <button
        onClick={() => router.push("/dashboard")}
        className="mt-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
      >
        Go to Dashboard Now
      </button>
    </div>
  );
}
