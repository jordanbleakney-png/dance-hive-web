"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [classes, setClasses] = useState([]);
  const [enrollEdit, setEnrollEdit] = useState(false);
  const [addClassId, setAddClassId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load users");
        setUsers(data.users || []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openUserDetails(email) {
    try {
      setDetailLoading(true);
      setDetail(null);
      setDetailOpen(true);
      const res = await fetch(`/api/customers/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load user");
      setDetail(data);
      setEditMode(false);
      // Load classes for enrollment editing
      try {
        // Use admin endpoint to retrieve classes with current student counts
        const resC = await fetch("/api/admin/classes");
        if (resC.ok) setClasses(await resC.json());
      } catch {}
    } catch (e) {
      setDetail({ error: e.message || String(e) });
    } finally {
      setDetailLoading(false);
    }
  }

  function startEdit() {
    if (!detail?.user) return;
    const u = detail.user;
    setForm({
      phone: u.phone || "",
      parent: { firstName: u.parent?.firstName || "", lastName: u.parent?.lastName || "" },
      child: {
        firstName: u.child?.firstName || "",
        lastName: u.child?.lastName || "",
        dob: u.child?.dob ? new Date(u.child.dob).toISOString().slice(0, 10) : "",
      },
      address: {
        houseNumber: u.address?.houseNumber || "",
        street: u.address?.street || "",
        city: u.address?.city || "",
        county: u.address?.county || "",
        postcode: u.address?.postcode || "",
      },
      emergencyContact: {
        name: u.emergencyContact?.name || "",
        phone: u.emergencyContact?.phone || "",
        relation: u.emergencyContact?.relation || "",
      },
      medical: u.medical || "",
    });
    setEditMode(true);
  }

  function updateField(path, value) {
    setForm((prev) => {
      const next = { ...prev };
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...(cur[parts[i]] || {}) };
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }

  async function saveEdits() {
    if (!detail?.user?.email || !form) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/customers/${encodeURIComponent(detail.user.email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save changes");
      setDetail(data);
      setEditMode(false);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addEnrollment() {
    if (!detail?.user?._id || !addClassId) return;
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.user._id, classId: addClassId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to add enrollment");
      }
      // refresh detail
      await openUserDetails(detail.user.email);
      setAddClassId("");
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  async function removeEnrollment(classId) {
    if (!detail?.user?._id || !classId) return;
    if (!confirm("Remove this enrollment?")) return;
    try {
      const res = await fetch("/api/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.user._id, classId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to remove enrollment");
      }
      await openUserDetails(detail.user.email);
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  async function changeEnrollment(oldClassId, newClassId) {
    if (!newClassId || newClassId === oldClassId) return;
    // Add new, then remove old
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.user._id, classId: newClassId }),
      });
      if (!res.ok) throw new Error("Failed to enroll in new class");
      const resDel = await fetch("/api/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.user._id, classId: oldClassId }),
      });
      if (!resDel.ok) throw new Error("Failed to remove old enrollment");
      await openUserDetails(detail.user.email);
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [
        u.email,
        u.role,
        u.parent?.firstName,
        u.parent?.lastName,
        u.child?.firstName,
        u.child?.lastName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [users, query]);

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        <div className="flex gap-3 mb-4">
          <input
            className="flex-1 border rounded-md p-2"
            type="text"
            placeholder="Search by name, email or role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 border text-left">Parent</th>
                      <th className="px-4 py-2 border text-left">Child</th>
                      <th className="px-4 py-2 border text-left">Email</th>
                      <th className="px-4 py-2 border text-left">Role</th>
                      <th className="px-4 py-2 border text-left">Membership</th>
                      <th className="px-4 py-2 border text-left">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const parentName = `${u?.parent?.firstName || ""}${
                        u?.parent?.firstName && u?.parent?.lastName ? " " : ""
                      }${u?.parent?.lastName || ""}`.trim();
                      const childName = `${u?.child?.firstName || ""}${
                        u?.child?.firstName && u?.child?.lastName ? " " : ""
                      }${u?.child?.lastName || ""}`.trim();
                      return (
                        <tr
                          key={u._id || u.email}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => openUserDetails(u.email)}
                          title="View user details"
                        >
                          <td className="px-4 py-2 border">
                            {parentName || u.name || ""}
                          </td>
                          <td className="px-4 py-2 border">
                            {childName || ""}
                          </td>
                          <td className="px-4 py-2 border">{u.email}</td>
                          <td className="px-4 py-2 border">
                            {u.role || "customer"}
                          </td>
                          <td className="px-4 py-2 border">
                            {u.membership?.status || "none"}
                          </td>
                          <td className="px-4 py-2 border">{u.phone || ""}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          className="px-4 py-6 text-center text-gray-500"
                          colSpan={6}
                        >
                          No users match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {detailOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setDetailOpen(false)}
              >
                <div
                  className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">User Details</h2>
                    <div className="flex items-center gap-3">
                      {!editMode ? (
                        <button onClick={startEdit} className="text-sm text-blue-600 hover:underline">Edit</button>
                      ) : (
                        <>
                          <button onClick={() => setEditMode(false)} className="text-sm text-gray-600 hover:underline">Cancel</button>
                          <button onClick={saveEdits} disabled={saving} className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
                        </>
                      )}
                      <button
                        className="text-sm text-gray-600 hover:underline"
                        onClick={() => setDetailOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {detailLoading && <p>Loading...</p>}
                  {!detailLoading && detail?.error && (
                    <p className="text-red-600">{detail.error}</p>
                  )}

                  {!detailLoading && detail && !detail.error && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 border rounded p-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-3 text-sm">
                            {(() => {
                              const parentName = [
                                detail.user?.parent?.firstName,
                                detail.user?.parent?.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ");
                              const childName = [
                                detail.user?.child?.firstName,
                                detail.user?.child?.lastName,
                              ]
                                .filter(Boolean)
                                .join(" ");
                              const yearsFromDob = (dob) => {
                                if (!dob) return null;
                                const birth = new Date(dob);
                                if (isNaN(birth)) return null;
                                const today = new Date();
                                let age = today.getFullYear() - birth.getFullYear();
                                const m = today.getMonth() - birth.getMonth();
                                if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                                return age;
                              };
                              const derivedAge =
                                yearsFromDob(detail.user?.child?.dob) ??
                                (Number(detail.user?.child?.age ?? detail.user?.age) || null);
                              return (
                                <>
                                  <div>
                                    <div className="text-gray-500 text-sm">Parent</div>
                                    <div className="font-medium">
                                    {editMode ? (
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <input className="border rounded p-1 w-full text-sm" placeholder="First name" value={form?.parent?.firstName || ""} onChange={(e)=>updateField("parent.firstName", e.target.value)} />
                                        <input className="border rounded p-1 w-full text-sm" placeholder="Last name" value={form?.parent?.lastName || ""} onChange={(e)=>updateField("parent.lastName", e.target.value)} />
                                      </div>
                                    ) : (parentName || "-")}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-gray-500 text-sm">Child | Age</div>
                                    <div className="font-medium">
                                      {editMode ? (
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <input className="border rounded p-1 w-full text-sm" placeholder="First name" value={form?.child?.firstName || ""} onChange={(e)=>updateField("child.firstName", e.target.value)} />
                                        <input className="border rounded p-1 w-full text-sm" placeholder="Last name" value={form?.child?.lastName || ""} onChange={(e)=>updateField("child.lastName", e.target.value)} />
                                        <input className="border rounded p-1 w-full col-span-2 text-sm" type="date" value={form?.child?.dob || ""} onChange={(e)=>updateField("child.dob", e.target.value)} />
                                      </div>
                                    ) : (
                                        <>
                                          {childName || "-"}
                                          {derivedAge != null ? (
                                            <span>{childName ? ` | ${derivedAge}` : ` ${derivedAge}`}</span>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-gray-500 text-sm">Email</div>
                                    <div className="font-medium">{detail.user?.email}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-500 text-sm">Phone</div>
                                    <div className="font-medium">
                                    {editMode ? (
                                      <input className="border rounded p-1 w-full text-sm" value={form?.phone || ""} onChange={(e)=>updateField("phone", e.target.value)} />
                                    ) : (detail.user?.phone || "-")}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-gray-500 text-sm">Role</div>
                                    <div className="font-medium">{detail.user?.role || "customer"}</div>
                                  </div>

                                  <div>
                                    <div className="text-gray-500 text-sm">Membership</div>
                                    <div className="font-medium">{detail.user?.membership?.status || "none"}</div>
                                  </div>
                                  <div>
                                    <div className="text-gray-500 text-sm">Classes</div>
                                    <div className="font-medium">{(Array.isArray(detail?.enrollments) ? detail.enrollments.length : (detail?.enrollmentCount ?? 0))}</div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <div className="text-gray-500 text-sm">Address</div>
                              {editMode ? (
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <input className="border rounded p-1 col-span-1 w-full text-sm" placeholder="House number" value={form?.address?.houseNumber || ""} onChange={(e)=>updateField("address.houseNumber", e.target.value)} />
                                  <input className="border rounded p-1 col-span-1 w-full text-sm" placeholder="Street" value={form?.address?.street || ""} onChange={(e)=>updateField("address.street", e.target.value)} />
                                  <input className="border rounded p-1 col-span-1 w-full text-sm" placeholder="City" value={form?.address?.city || ""} onChange={(e)=>updateField("address.city", e.target.value)} />
                                  <input className="border rounded p-1 col-span-1 w-full text-sm" placeholder="County" value={form?.address?.county || ""} onChange={(e)=>updateField("address.county", e.target.value)} />
                                  <input className="border rounded p-1 col-span-2 w-full text-sm" placeholder="Postcode" value={form?.address?.postcode || ""} onChange={(e)=>updateField("address.postcode", e.target.value)} />
                                </div>
                              ) : (
                                <div className="font-medium whitespace-pre-line text-sm">
                                  {(() => {
                                    const a = detail.user?.address || {};
                                    const lines = [
                                      [a?.houseNumber, a?.street].filter(Boolean).join(" "),
                                      a?.city,
                                      a?.county,
                                      a?.postcode,
                                    ]
                                      .filter(Boolean)
                                      .join("\n");
                                    return lines || "-";
                                  })()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-gray-500 text-sm">Emergency Contact</div>
                              {editMode ? (
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                  <input className="border rounded p-1 col-span-1 w-full text-sm" placeholder="Name" value={form?.emergencyContact?.name || ""} onChange={(e)=>updateField("emergencyContact.name", e.target.value)} />
                                  <input className="border rounded p-1 col-span-1 w-full text-sm" placeholder="Phone" value={form?.emergencyContact?.phone || ""} onChange={(e)=>updateField("emergencyContact.phone", e.target.value)} />
                                  <input className="border rounded p-1 col-span-1 w-full text-sm" placeholder="Relation" value={form?.emergencyContact?.relation || ""} onChange={(e)=>updateField("emergencyContact.relation", e.target.value)} />
                                </div>
                              ) : (
                                <div className="font-medium text-sm">
                                  {[
                                    detail.user?.emergencyContact?.name,
                                    detail.user?.emergencyContact?.phone,
                                    detail.user?.emergencyContact?.relation,
                                  ]
                                    .filter(Boolean)
                                    .join(" | ") || "-"}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-gray-500 text-sm">Medical Details</div>
                              {editMode ? (
                                <textarea className="border rounded p-2 w-full text-sm" rows={3} value={form?.medical || ""} onChange={(e)=>updateField("medical", e.target.value)} />
                              ) : (
                                <div className="font-medium whitespace-pre-wrap text-sm">{detail.user?.medical || "-"}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 border rounded p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">Enrolled Classes</h3>
                          <button className="text-sm text-blue-600 hover:underline" onClick={() => setEnrollEdit((v)=>!v)}>
                            {enrollEdit ? "Done" : "Edit"}
                          </button>
                        </div>
                        {Array.isArray(detail.enrollments) && detail.enrollments.length > 0 ? (
                          <div className="rounded border border-gray-200 overflow-hidden">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 border text-left">Class</th>
                                  <th className="px-3 py-2 border text-left">Schedule</th>
                                  <th className="px-3 py-2 border text-left">Teacher</th>
                                  <th className="px-3 py-2 border text-left">Status</th>
                                  {enrollEdit && <th className="px-3 py-2 border text-left">Actions</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {detail.enrollments.map((e) => (
                                  <tr key={e._id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 border">
                                      {enrollEdit ? (
                                        <select
                                          className="border rounded px-2 py-1 text-sm"
                                          defaultValue={String(e.class?._id || "")}
                                          onChange={(ev) => changeEnrollment(String(e.class?._id || e.classId), ev.target.value)}
                                        >
                                          <option value="">Select class</option>
                                          {classes.map((c) => {
                                            const enrolled = Number(c.studentCount || 0);
                                            const cap = c.capacity != null ? String(c.capacity) : "∞";
                                            const label = `${c.name} — ${c.day || ''} ${c.time || ''} (${enrolled}/${cap})`;
                                            return (
                                              <option key={c._id} value={c._id}>{label}</option>
                                            );
                                          })}
                                        </select>
                                      ) : (
                                        e.class?.name || ""
                                      )}
                                    </td>
                                    <td className="px-3 py-2 border">{[e.class?.day, e.class?.time].filter(Boolean).join(" | ")}</td>
                                    <td className="px-3 py-2 border">{e.class?.instructor || "TBA"}</td>
                                    <td className="px-3 py-2 border capitalize">{e.status || "active"}</td>
                                    {enrollEdit && (
                                      <td className="px-3 py-2 border">
                                        <button
                                          className="text-sm text-red-600 hover:underline"
                                          onClick={() => removeEnrollment(String(e.class?._id || e.classId))}
                                        >
                                          Remove
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600">No enrollments yet.</p>
                        )}

                        {enrollEdit && (
                          <div className="mt-3 flex items-center gap-2">
                            <select
                              className="border rounded px-2 py-1 text-sm"
                              value={addClassId}
                              onChange={(e)=> setAddClassId(e.target.value)}
                            >
                              <option value="">Add to class…</option>
                              {classes.map((c) => {
                                const enrolled = Number(c.studentCount || 0);
                                const cap = c.capacity != null ? String(c.capacity) : "∞";
                                const label = `${c.name} — ${c.day || ''} ${c.time || ''} (${enrolled}/${cap})`;
                                return (
                                  <option key={c._id} value={c._id}>{label}</option>
                                );
                              })}
                            </select>
                            <button
                              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-60"
                              disabled={!addClassId}
                              onClick={addEnrollment}
                            >
                              Add
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 border rounded p-4">
                        <h3 className="font-semibold mb-2">Payments</h3>
                        {Array.isArray(detail.payments) && detail.payments.length > 0 ? (
                          <ul className="space-y-1 text-sm">
                            {detail.payments.map((p, i) => {
                              const currency = String(p?.currency || "GBP").toUpperCase();
                              const amount = Number(p?.amount) || 0;
                              const amountText = new Intl.NumberFormat("en-GB", {
                                style: "currency",
                                currency,
                                minimumFractionDigits: 0,
                              }).format(amount);
                              const dateText = new Date(p?.createdAt || p?.timestamp || Date.now()).toLocaleString();
                              const status = p?.payment_status || p?.status || "paid";
                              return (
                                <li key={i} className="flex items-center justify-between gap-3">
                                  <span className="text-gray-600">{dateText}</span>
                                  <span className="font-medium">{amountText}</span>
                                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 capitalize">
                                    {status}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-600">No payments recorded.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
