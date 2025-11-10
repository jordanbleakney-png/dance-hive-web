"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SuccessPage() {
  const { update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Completing setup...");

  useEffect(() => {
    const finishGoCardless = async () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        const rf = sp.get("redirect_flow_id");
        if (rf) {
          const guardKey = `gc_done_${rf}`;
          if (sessionStorage.getItem(guardKey) === "1") {
            // Already completed in this session (React StrictMode double-effect)
            await update();
            try { router.refresh?.(); } catch {}
            router.push("/dashboard?firstTime=1");
            return;
          }
          setMessage("Finalising your Direct Debit...");
          await fetch("/api/checkout/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ redirect_flow_id: rf }),
          });
          try { sessionStorage.setItem(guardKey, "1"); } catch {}
        }
        // Refresh session; then quickly confirm membership is visible to the app
        await update();
        try { router.refresh?.(); } catch {}

        try {
          const sessRes = await fetch('/api/auth/session', { cache: 'no-store' });
          const sess = sessRes.ok ? await sessRes.json() : null;
          const email = sess?.user?.email as string | undefined;
          if (email) {
            const until = Date.now() + 2000; // ~2s quick confirm loop
            while (Date.now() < until) {
              try {
                const r = await fetch(`/api/users/status?email=${encodeURIComponent(email)}&_t=${Date.now()}`, { cache: 'no-store' });
                if (r.ok) {
                  const s = await r.json();
                  if (s?.role === 'member' || s?.membership?.status === 'active') {
                    break;
                  }
                }
              } catch {}
              await new Promise((res) => setTimeout(res, 250));
            }
          }
        } catch {}

        // Head to dashboard; firstTime=1 forces welcome modal
        // Use a hard navigation to avoid any client cache/state ambiguity
        try { window.location.replace("/dashboard?firstTime=1"); }
        catch { router.push("/dashboard?firstTime=1"); }
      } catch (err) {
        console.error("Failed to complete setup:", err);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    finishGoCardless();
  }, [update, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-3xl font-bold mb-4 text-green-600">Setup Complete</h1>
      <p className="text-lg text-gray-700 mb-6">Thank you for joining Dance Hive! Your membership will be activated once the first payment is confirmed.</p>

      {loading ? (
        <p className="text-gray-500 animate-pulse">{message}</p>
      ) : (
        <p className="text-gray-600">Redirecting you to your dashboard...</p>
      )}
    </div>
  );
}
