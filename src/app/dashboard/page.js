"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("customer");
  const [overview, setOverview] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showMemberWelcome, setShowMemberWelcome] = useState(false);
  const [showMemberBanner, setShowMemberBanner] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let roleFromStatus = role;
        // Detect first-time redirect state from success page
        let firstTimeParam = false;
        try {
          const sp = new URLSearchParams(window.location.search);
          firstTimeParam = sp.get("firstTime") === "1";
          setIsFirstTime(firstTimeParam);
        } catch {}

        // Fetch status and overview in parallel for faster paint
        const statusPromise = session?.user?.email
          ? fetch(
              `/api/users/status?email=${encodeURIComponent(session.user.email)}&_t=${Date.now()}`,
              { cache: "no-store" }
            )
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);
        const overviewPromise = fetch(`/api/account/overview?_t=${Date.now()}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        const [sd, data] = await Promise.all([statusPromise, overviewPromise]);

        if (sd?.role) {
          setRole(sd.role);
          roleFromStatus = sd.role;
        }
        if (data) {
          setOverview(data);
          // Show welcome modal on every login until they upgrade
          const isConvertedCustomer =
            roleFromStatus === "customer" &&
            (!data?.membership || data?.membership?.status === "none");
          if (!firstTimeParam && isConvertedCustomer) {
            setShowWelcome(true);
          }

          // If they are now a member, nudge them to update details via server-side flag
          if (roleFromStatus === "member" && data?.membership?.status === "active") {
            if (data?.flags?.memberWelcomePending) {
              // If firstTime=1 is present, force showing the modal and clear any snooze
              if (firstTimeParam) {
                try { localStorage.removeItem('dh_member_modal_snooze'); } catch {}
                setShowMemberWelcome(true);
              } else {
                // Otherwise, if the user snoozed previously, show a banner; else show modal
                let snoozed = false;
                try { snoozed = localStorage.getItem('dh_member_modal_snooze') === '1'; } catch {}
                if (snoozed) setShowMemberBanner(true);
                else setShowMemberWelcome(true);
              }
            }
          }
          // If we just returned from checkout and still look like a customer,
          // do a single quick re-fetch shortly after initial paint to catch any
          // last-moment DB write visibility. This is invisible to the user.
          if (firstTimeParam && roleFromStatus === "customer") {
            setTimeout(async () => {
              try {
                const email = session?.user?.email || "";
                if (!email) return;
                const s2 = await fetch(`/api/users/status?email=${encodeURIComponent(email)}&_t=${Date.now()}`, { cache: "no-store" });
                const sd2 = s2.ok ? await s2.json() : null;
                const r2 = await fetch(`/api/account/overview?_t=${Date.now()}`, { cache: "no-store" });
                const ov2 = r2.ok ? await r2.json() : null;
                if ((sd2?.role === "member") || (ov2?.membership?.status === "active")) {
                  setRole("member");
                  setOverview(ov2 || data);
                  if (ov2?.flags?.memberWelcomePending) {
                    try { localStorage.removeItem('dh_member_modal_snooze'); } catch {}
                    setShowWelcome(false);
                    setShowMemberBanner(false);
                    setShowMemberWelcome(true);
                  }
                }
              } catch {}
            }, 400);
          }
        }
        // Drop loader now; content will be updated by background polling if needed
        setLoading(false);
      } finally {
        // ensure we never get stuck loading
        setLoading(false);
      }
    })();
  }, [session?.user?.email]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <p className="text-gray-500 animate-pulse">
            Loading your dashboard...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const childName = overview
    ? [overview.child?.firstName, overview.child?.lastName]
        .filter(Boolean)
        .join(" ")
    : "";
  const parentName = overview
    ? [overview.parent?.firstName, overview.parent?.lastName]
        .filter(Boolean)
        .join(" ")
    : "";
  const addressLines = overview
    ? [
        [overview.address?.houseNumber, overview.address?.street]
          .filter(Boolean)
          .join(" "),
        overview.address?.city,
        overview.address?.county,
        overview.address?.postcode,
      ].filter(Boolean)
    : [];

  // ✅ returning flag
  const returning = Boolean(overview?.flags?.reactivationPending);

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      console.error(e);
      alert("Unable to start checkout. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto text-center mt-12">
        {/* no banner */}
        {showMemberWelcome && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 text-center">
              <h2 className="font-bold text-xl mb-3">Welcome to the Hive!</h2>
              <p className="text-gray-700 mb-4">
                We’re thrilled you’ve joined our buzzing community.
                <br />
                Please update your details to help us get everything ready for you and your little dancer
              </p>
              <div className="flex gap-3 justify-center">
                <a
                  href="/dashboard/settings"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded"
                  onClick={() => setShowMemberWelcome(false)}
                >
                  Update Details
                </a>
                <button
                  onClick={() => { setShowMemberWelcome(false); setShowMemberBanner(true); try { localStorage.setItem('dh_member_modal_snooze','1'); } catch {} }}
                  className="border border-gray-300 text-gray-700 px-5 py-2 rounded hover:bg-gray-50"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        )}
        {showWelcome && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 text-center">
              <h2 className="font-bold text-xl mb-3">
                {returning ? (
                  <>Welcome back, {session?.user?.name || "there"}!</>
                ) : (
                  <>You made it, {session?.user?.name || "there"}!</>
                )}
              </h2>

              {returning ? (
                <div className="text-gray-700 mb-4">
                  <p>
                    We’ve missed you at the Hive — we’d love to have you buzzing
                    with us again!
                  </p>
                  <p>
                    Pick up right where you left off and re-activate your
                    membership.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 mb-4 hidden">
                    Your trial class was just the beginning — we'd love for you
                    to stay with us!
                    <br />
                    Get ready to become an official member of the Hive.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Your trial class was just the beginning
                    <br />
                    we'd love for you to stay with us!
                    <br />
                    Get ready to become an official member of the Hive.
                  </p>
                </>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded disabled:opacity-60"
                >
                  {upgrading
                    ? "Starting checkout..."
                    : overview?.flags?.reactivationPending
                    ? "Re-activate Membership"
                    : "Upgrade to Member"}
                </button>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="border border-gray-300 text-gray-700 px-5 py-2 rounded hover:bg-gray-50"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {showMemberBanner && (
          <div className="mb-4 mx-auto max-w-2xl bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-md px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Welcome to the Hive!</div>
                <div>
                  Please update your details so we can get everything ready for you and your little dancer.
                </div>
              </div>
              <a href="/dashboard/settings" className="shrink-0 inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded">Update</a>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold mb-3">
          Welcome back, {session?.user?.name || "User"}
        </h1>
        <p className="text-gray-600 mb-6">
          Your current role: <span className="font-medium">{role}</span>
        </p>

        {overview && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                {(overview?.parent?.firstName || "Parent") + " Details"}
              </h2>
              <a
                href="/dashboard/settings"
                title="Edit details"
                aria-label="Edit details"
                className="inline-flex items-center text-blue-600 hover:text-blue-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M16.862 3.487a1.75 1.75 0 0 1 2.476 2.476l-10.3 10.3a3 3 0 0 1-1.272.754l-3.086.882a.75.75 0 0 1-.923-.923l.882-3.086a3 3 0 0 1 .754-1.272l10.3-10.3Z" />
                  <path d="M5.25 19.5h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1 0-1.5Z" />
                </svg>
                <span className="sr-only">Edit</span>
              </a>
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="space-y-3">
                <div>
                  <div className="text-gray-500">Parent name</div>
                  <div className="font-medium">{parentName || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Address details</div>
                  <div className="font-medium whitespace-pre-line">
                    {addressLines.length ? addressLines.join("\n") : "-"}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-gray-500">Phone</div>
                  <div className="font-medium">{overview.phone || "-"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Email</div>
                  <div className="font-medium break-words">
                    {overview.email || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Emergency contact details</div>
                  <div className="font-medium">
                    {[
                      overview.emergencyContact?.name,
                      overview.emergencyContact?.phone,
                      overview.emergencyContact?.relation,
                    ]
                      .filter(Boolean)
                      .join(" | ") || "Not provided"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {overview &&
          Array.isArray(overview.children) &&
          overview.children.length > 0 &&
          overview.children.map((ch, idx) => (
            <div
              key={idx}
              className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">
                  {(ch?.firstName || "Child") + " Details"}
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Child name</div>
                  <div className="font-medium">
                    {[ch.firstName, ch.lastName].filter(Boolean).join(" ")}
                  </div>
                </div>
                {(ch.dob || overview.child?.dob) && (
                  <div>
                    <div className="text-gray-500">Date of birth</div>
                    <div className="font-medium">
                      {new Date(
                        ch.dob || overview.child?.dob
                      ).toLocaleDateString()}
                    </div>
                  </div>
                )}
                <div className="md:col-span-3">
                  <div className="text-gray-500">Medical information</div>
                  <div className="font-medium whitespace-pre-wrap">
                    {ch.medical ||
                      overview.medical ||
                      "No medical information on file. Please update in Settings."}
                  </div>
                </div>
                {/* Enrolled classes for this child */}
                {(() => {
                  const rows = (overview.enrollments || []).filter(
                    (e) => String(e.childId || "") === String(ch._id || "")
                  );
                  if (rows.length === 0) return null;
                  return (
                    <div className="md:col-span-3 mt-4">
                      <h3 className="text-base font-semibold mb-2">
                        Enrolled Classes
                      </h3>
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 border text-left">
                                Class
                              </th>
                              <th className="px-4 py-2 border text-left">
                                Schedule
                              </th>
                              <th className="px-4 py-2 border text-left">
                                Teacher
                              </th>
                              <th className="px-4 py-2 border text-left">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((e) => (
                              <tr
                                key={String(e._id)}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-4 py-2 border">
                                  {e.class?.name || ""}
                                </td>
                                <td className="px-4 py-2 border">
                                  {[e.class?.day, e.class?.time]
                                    .filter(Boolean)
                                    .join(" | ")}
                                </td>
                                <td className="px-4 py-2 border">
                                  {e.class?.instructor || "TBA"}
                                </td>
                                <td className="px-4 py-2 border">
                                  {e.status || "active"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        {overview &&
          (!Array.isArray(overview.children) ||
            overview.children.length === 0) && (
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">
                  {(overview?.child?.firstName || "Child") + " Details"}
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Child name</div>
                  <div className="font-medium">{childName || "-"}</div>
                </div>
                {overview.child?.age != null && (
                  <div>
                    <div className="text-gray-500">Age</div>
                    <div className="font-medium">{overview.child.age}</div>
                  </div>
                )}
                {overview.child?.dob && (
                  <div>
                    <div className="text-gray-500">Date of birth</div>
                    <div className="font-medium">
                      {new Date(overview.child.dob).toLocaleDateString()}
                    </div>
                  </div>
                )}
                <div className="md:col-span-3">
                  <div className="text-gray-500">Medical information</div>
                  <div className="font-medium whitespace-pre-wrap">
                    {overview.medical ||
                      "No medical information on file. Please update in Settings."}
                  </div>
                </div>
                {/* Enrolled classes for this child (no children[] case) */}
                {Array.isArray(overview.enrollments) &&
                  overview.enrollments.length > 0 && (
                    <div className="md:col-span-3 mt-4">
                      <h3 className="text-base font-semibold mb-2">
                        Enrolled Classes
                      </h3>
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 border text-left">
                                Class
                              </th>
                              <th className="px-4 py-2 border text-left">
                                Schedule
                              </th>
                              <th className="px-4 py-2 border text-left">
                                Teacher
                              </th>
                              <th className="px-4 py-2 border text-left">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {overview.enrollments.map((e) => (
                              <tr
                                key={String(e._id)}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-4 py-2 border">
                                  {e.class?.name || ""}
                                </td>
                                <td className="px-4 py-2 border">
                                  {[e.class?.day, e.class?.time]
                                    .filter(Boolean)
                                    .join(" | ")}
                                </td>
                                <td className="px-4 py-2 border">
                                  {e.class?.instructor || "TBA"}
                                </td>
                                <td className="px-4 py-2 border">
                                  {e.status || "active"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        {/* Enrolled Classes moved into each child card above */}

        {/* Recent Payments */}
        {Array.isArray(overview?.payments) && overview.payments.length > 0 && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 text-left mb-6">
            <h2 className="text-lg font-semibold mb-3">Recent Payments</h2>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border text-left">Date</th>
                    <th className="px-4 py-2 border text-left">Amount</th>
                    <th className="px-4 py-2 border text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.payments.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">
                        {new Date(
                          p.createdAt || p.timestamp || Date.now()
                        ).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 border">
                        {new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: String(p.currency || "GBP").toUpperCase(),
                          minimumFractionDigits: 0,
                        }).format(Number(p.amount) || 0)}
                      </td>
                      <td className="px-4 py-2 border">
                        {String(p.payment_status || p.status || '').replace('_',' ') || 'pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

