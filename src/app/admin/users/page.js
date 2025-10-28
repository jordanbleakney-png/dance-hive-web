"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import toast from "react-hot-toast";

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
  const [addChildId, setAddChildId] = useState("");
  const [addClassByChild, setAddClassByChild] = useState({});

  // NEW: state for Add Child form
  const [newChild, setNewChild] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    medical: "",
  });
  const [savingChild, setSavingChild] = useState(false);
  const [editChildId, setEditChildId] = useState("");
  const [addChildOpen, setAddChildOpen] = useState(false);

  // Per-child inline edit state
  const [childForms, setChildForms] = useState({}); // { [id]: { firstName,lastName,dob,medical } }
  const [childSaving, setChildSaving] = useState({}); // { [id]: boolean }

  function startChildEdit(child) {
    const id = String(child?._id || "");
    if (!id) return;
    setEditChildId(id);
    setChildForms((p) => ({
      ...p,
      [id]: {
        firstName: child.firstName || "",
        lastName: child.lastName || "",
        dob: child.dob ? new Date(child.dob).toISOString().slice(0, 10) : "",
        medical: child.medical || "",
      },
    }));
  }

  function cancelChildEdit() {
    setEditChildId("");
  }

  function setChildField(id, field, value) {
    setChildForms((p) => ({ ...p, [String(id)]: { ...(p[String(id)] || {}), [field]: value } }));
  }

  async function saveChildEdit(id) {
    const key = String(id);
    const form = childForms[key] || {};
    if (!form.firstName) return;
    try {
      setChildSaving((p) => ({ ...p, [key]: true }));
      const res = await fetch(`/api/children/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob || null,
          medical: form.medical,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to update child");
      toast.success("Child details saved");
      setEditChildId("");
      await openUserDetails(detail.user.email);
    } catch (e) {
      toast.error(e.message || String(e));
    } finally {
      setChildSaving((p) => ({ ...p, [key]: false }));
    }
  }

  async function deleteChildById(id) {
    const key = String(id || "");
    if (!key) return;
    const enrollmentsForChild = (detail?.enrollments || []).filter(
      (e) => String(e.childId) === key
    );
    const needsCascade = enrollmentsForChild.length > 0;
    const ok = confirm(
      needsCascade
        ? "This child has enrollments. Remove them and delete the child?"
        : "Delete this child?"
    );
    if (!ok) return;
    try {
      setChildSaving((p) => ({ ...p, [key]: true }));
      const url = needsCascade
        ? `/api/children/${key}?force=true`
        : `/api/children/${key}`;
      const res = await fetch(url, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to delete child");
      toast.success("Child deleted");
      setEditChildId("");
      await openUserDetails(detail.user.email);
    } catch (e) {
      toast.error(e.message || String(e));
    } finally {
      setChildSaving((p) => ({ ...p, [key]: false }));
    }
  }

  // No per-child detail editor here; Manage Children handles child fields

  // Preselect the only child for enrollment when exactly one exists
  useEffect(() => {
    const count = Array.isArray(detail?.children) ? detail.children.length : 0;
    if (count === 1) {
      const only = detail.children[0];
      const id = String(only?._id || "");
      if (id && addChildId !== id) setAddChildId(id);
    }
  }, [detail?.children]);

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
      parent: {
        firstName: u.parent?.firstName || "",
        lastName: u.parent?.lastName || "",
      },
      child: {
        firstName: u.child?.firstName || "",
        lastName: u.child?.lastName || "",
        dob: u.child?.dob
          ? new Date(u.child.dob).toISOString().slice(0, 10)
          : "",
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
      const res = await fetch(
        `/api/customers/${encodeURIComponent(detail.user.email)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
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

  // NEW: Add Child function
  async function addChild() {
    if (!detail?.user?._id || !newChild.firstName) return;
    try {
      setSavingChild(true);
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: detail.user._id,
          firstName: newChild.firstName,
          lastName: newChild.lastName,
          dob: newChild.dob,
          medical: newChild.medical,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add child");
      // reset form
      setNewChild({ firstName: "", lastName: "", dob: "", medical: "" });
      // refresh user details so the new child appears in pickers/tables
      await openUserDetails(detail.user.email);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSavingChild(false);
    }
  }

  async function addEnrollment(childIdOverride, classIdOverride) {
    // Allow direct args to avoid setState timing issues
    let childIdToUse = childIdOverride || addChildId;
    let classIdToUse = classIdOverride || addClassId;

    // Resolve childId if exactly one child and none selected
    if (!childIdToUse && Array.isArray(detail?.children) && detail.children.length === 1) {
      childIdToUse = String(detail.children[0]?._id || "");
      setAddChildId(childIdToUse);
    }

    if (!detail?.user?._id || !classIdToUse || !childIdToUse) return;
    // Client-side guard: avoid duplicates (best-effort; server is authoritative)
    if (
      (uniqueEnrollments || []).some(
        (e) =>
          String(e.childId) === String(childIdToUse) &&
          String(e.classId || e.class?._id) === String(addClassId)
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: detail.user._id,
          childId: childIdToUse,
          classId: classIdToUse,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to add enrollment");
      if (d?.message && d.message !== "Student enrolled successfully") {
        // Surface informational messages like "Already enrolled" or "Enrollment updated"
        console.info("/api/enrollments:", d.message);
      }
      // refresh detail
      await openUserDetails(detail.user.email);
      setAddClassId("");
      // keep selected child if only one exists; otherwise clear
      if (!detail?.children || detail.children.length !== 1) {
        setAddChildId("");
      }
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  async function removeEnrollment(classId, childId) {
    if (!detail?.user?._id || !classId || !childId) return;
    if (!confirm("Remove this enrollment?")) return;
    try {
      const res = await fetch("/api/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.user._id, childId, classId }),
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

  async function changeEnrollment(childId, oldClassId, newClassId) {
    if (!newClassId || newClassId === oldClassId || !childId) return;
    // Add new, then remove old
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: detail.user._id,
          childId,
          classId: newClassId,
        }),
      });
      if (!res.ok) throw new Error("Failed to enroll in new class");
      const resDel = await fetch("/api/enrollments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: detail.user._id,
          childId,
          classId: oldClassId,
        }),
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
        // Prefer data coming from children aggregation
        u.firstChild?.firstName,
        u.firstChild?.lastName,
        // Fallback to legacy embedded child if present
        u.child?.firstName,
        u.child?.lastName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [users, query]);

  // Deduplicate enrollments by (childId,classId) in case of legacy or race-created duplicates
  const uniqueEnrollments = useMemo(() => {
    if (!detail?.enrollments) return [];
    const seen = new Set();
    const out = [];
    for (const e of detail.enrollments) {
      const k = `${String(e.childId)}::${String(e.classId || e?.class?._id || '')}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out;
  }, [detail?.enrollments]);

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
                      const fc = u?.firstChild || u?.child || {};
                      const childName = `${fc?.firstName || ""}${
                        fc?.firstName && fc?.lastName ? " " : ""
                      }${fc?.lastName || ""}`.trim();
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
                  className="bg-white rounded-xl shadow-xl max-w-3xl w-full text-left overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 max-h-[85vh] overflow-y-auto hide-scrollbar">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">User Details</h2>
                    <div className="flex items-center gap-3">
                      {!editMode ? (
                        <button
                          onClick={startEdit}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditMode(false)}
                            className="text-sm text-gray-600 hover:underline"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEdits}
                            disabled={saving}
                            className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-60"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
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
                                const childrenArr = Array.isArray(
                                  detail.children
                                )
                                  ? detail.children
                                  : [];
                                const child0 =
                                  childrenArr.length > 0
                                    ? childrenArr[0]
                                    : null;
                                const childName = [
                                  child0?.firstName ??
                                    detail.user?.child?.firstName,
                                  child0?.lastName ??
                                    detail.user?.child?.lastName,
                                ]
                                  .filter(Boolean)
                                  .join(" ");
                                const yearsFromDob = (dob) => {
                                  if (!dob) return null;
                                  const birth = new Date(dob);
                                  if (isNaN(birth)) return null;
                                  const today = new Date();
                                  let age =
                                    today.getFullYear() - birth.getFullYear();
                                  const m = today.getMonth() - birth.getMonth();
                                  if (
                                    m < 0 ||
                                    (m === 0 &&
                                      today.getDate() < birth.getDate())
                                  )
                                    age--;
                                  return age;
                                };
                                const derivedAge =
                                  yearsFromDob(
                                    child0?.dob ?? detail.user?.child?.dob
                                  ) ??
                                  (Number(detail.user?.age) || null);
                                const extraLines = [];
                                if (childrenArr.length > 1) {
                                  for (let i = 1; i < childrenArr.length; i++) {
                                    const c = childrenArr[i];
                                    const nm = [c?.firstName, c?.lastName]
                                      .filter(Boolean)
                                      .join(" ");
                                    const ag = yearsFromDob(c?.dob);
                                    extraLines.push(
                                      `${nm}${ag != null ? ` | ${ag}` : ""}`
                                    );
                                  }
                                }
                                return (
                                  <>
                                    <div>
                                      <div className="text-gray-500 text-sm">
                                        Parent
                                      </div>
                                      <div className="font-medium">
                                        {editMode ? (
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            <input
                                              className="border rounded p-1 w-full text-sm"
                                              placeholder="First name"
                                              value={
                                                form?.parent?.firstName || ""
                                              }
                                              onChange={(e) =>
                                                updateField(
                                                  "parent.firstName",
                                                  e.target.value
                                                )
                                              }
                                            />
                                            <input
                                              className="border rounded p-1 w-full text-sm"
                                              placeholder="Last name"
                                              value={
                                                form?.parent?.lastName || ""
                                              }
                                              onChange={(e) =>
                                                updateField(
                                                  "parent.lastName",
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </div>
                                        ) : (
                                          parentName || "-"
                                        )}
                                      </div>
                                    </div>

                                    {/* Children from children collection with age + medical */}
                                    {(Array.isArray(detail?.children) ? detail.children : []).map((c, idx) => {
                                      const nm = [c?.firstName, c?.lastName].filter(Boolean).join(" ");
                                      const ag = yearsFromDob(c?.dob);
                                      return (
                                        <>
                                          <div key={`child-${idx}-heading`}>
                                            <div className="text-gray-500 text-sm">Child | Age</div>
                                            <div className="font-medium">{[nm || "-", ag != null ? String(ag) : null].filter(Boolean).join(" | ")}</div>
                                          </div>
                                          <div key={`child-${idx}-medical`}>
                                            <div className="text-gray-500 text-sm">Medical Details</div>
                                            <div className="font-medium whitespace-pre-wrap">{c?.medical || "-"}</div>
                                          </div>
                                        </>
                                      );
                                    })}

                                    <div>
                                      <div className="text-gray-500 text-sm">
                                        Email
                                      </div>
                                      <div className="font-medium">
                                        {detail.user?.email}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-gray-500 text-sm">
                                        Phone
                                      </div>
                                      <div className="font-medium">
                                        {editMode ? (
                                          <input
                                            className="border rounded p-1 w-full text-sm"
                                            value={form?.phone || ""}
                                            onChange={(e) =>
                                              updateField(
                                                "phone",
                                                e.target.value
                                              )
                                            }
                                          />
                                        ) : (
                                          detail.user?.phone || "-"
                                        )}
                                      </div>
                                    </div>

                                    {/* Role/Membership/Classes moved to right column to match layout */}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div>
                                <div className="text-gray-500 text-sm">
                                  Address
                                </div>
                                {editMode ? (
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <input
                                      className="border rounded p-1 col-span-1 w-full text-sm"
                                      placeholder="House number"
                                      value={form?.address?.houseNumber || ""}
                                      onChange={(e) =>
                                        updateField(
                                          "address.houseNumber",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      className="border rounded p-1 col-span-1 w-full text-sm"
                                      placeholder="Street"
                                      value={form?.address?.street || ""}
                                      onChange={(e) =>
                                        updateField(
                                          "address.street",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      className="border rounded p-1 col-span-1 w-full text-sm"
                                      placeholder="City"
                                      value={form?.address?.city || ""}
                                      onChange={(e) =>
                                        updateField(
                                          "address.city",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      className="border rounded p-1 col-span-1 w-full text-sm"
                                      placeholder="County"
                                      value={form?.address?.county || ""}
                                      onChange={(e) =>
                                        updateField(
                                          "address.county",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      className="border rounded p-1 col-span-2 w-full text-sm"
                                      placeholder="Postcode"
                                      value={form?.address?.postcode || ""}
                                      onChange={(e) =>
                                        updateField(
                                          "address.postcode",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                ) : (
                                  <div className="font-medium whitespace-pre-line text-sm">
                                    {(() => {
                                      const a = detail.user?.address || {};
                                      const lines = [
                                        [a?.houseNumber, a?.street]
                                          .filter(Boolean)
                                          .join(" "),
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
                                <div className="text-gray-500 text-sm">
                                  Emergency Contact
                                </div>
                                {editMode ? (
                                  <div className="grid grid-cols-3 gap-2 text-sm">
                                    <input
                                      className="border rounded p-1 col-span-1 w-full text-sm"
                                      placeholder="Name"
                                      value={form?.emergencyContact?.name || ""}
                                      onChange={(e) =>
                                        updateField(
                                          "emergencyContact.name",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      className="border rounded p-1 col-span-1 w-full text-sm"
                                      placeholder="Phone"
                                      value={
                                        form?.emergencyContact?.phone || ""
                                      }
                                      onChange={(e) =>
                                        updateField(
                                          "emergencyContact.phone",
                                          e.target.value
                                        )
                                      }
                                    />
                                    <input
                                      className="border rounded p-1 col-span-1 w-full text-sm"
                                      placeholder="Relation"
                                      value={
                                        form?.emergencyContact?.relation || ""
                                      }
                                      onChange={(e) =>
                                        updateField(
                                          "emergencyContact.relation",
                                          e.target.value
                                        )
                                      }
                                    />
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
                                <div className="text-gray-500 text-sm">Role</div>
                                <div className="font-medium">{detail.user?.role || "customer"}</div>
                              </div>

                              <div>
                                <div className="text-gray-500 text-sm">Membership</div>
                                <div className="font-medium">{detail.user?.membership?.status || "none"}</div>
                              </div>

                              <div>
                                <div className="text-gray-500 text-sm">Classes</div>
                                <div className="font-medium">{Array.isArray(detail?.enrollments) ? detail.enrollments.length : detail?.enrollmentCount ?? 0}</div>
                              </div>

                              {/* Manage Children removed per new design; child edits live in each child block below */}
                            </div>
                          </div>
                        </div>

                        {/* Manage existing children (edit/delete) */}{false && (
                        <div className="mt-4">
                          <div className="text-gray-500 text-sm">Manage Children</div>
                          {Array.isArray(detail.children) && detail.children.length > 0 ? (
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="flex items-center gap-2">
                                <select
                                  className="border rounded px-2 py-1 text-sm"
                                  value={editChildId}
                                  onChange={(e)=> setEditChildId(e.target.value)}
                                >
                                  <option value="">Select child…</option>
                                  {detail.children.map((c)=> (
                                    <option key={c._id} value={c._id}>
                                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border"
                                  onClick={()=>{
                                    const id = editChildId || (detail.children[0]?._id || "");
                                    if(!id) return;
                                    const c = detail.children.find(x=> String(x._id)===String(id));
                                    if(!c) return;
                                    setEditMode(true);
                                    setNewChild({
                                      firstName: c.firstName||"",
                                      lastName: c.lastName||"",
                                      dob: c.dob ? String(c.dob).slice(0,10) : "",
                                      medical: c.medical || "",
                                    });
                                  }}
                                >Load into form</button>
                                <button
                                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                                  onClick={async()=>{
                                    const id = editChildId || (detail.children[0]?._id || "");
                                    if(!id) return;
                                    try{
                                      setSavingChild(true);
                                      const res = await fetch(`/api/children/${id}`,{
                                        method:'PUT',
                                        headers:{'Content-Type':'application/json'},
                                        body: JSON.stringify({ firstName:newChild.firstName, lastName:newChild.lastName, dob:newChild.dob, medical:newChild.medical })
                                      });
                                      const d = await res.json().catch(()=>({}));
                                      if(!res.ok) throw new Error(d.error||'Failed to update child');
                                      await openUserDetails(detail.user.email);
                                    }catch(e){ alert(e.message||String(e)); }
                                    finally{ setSavingChild(false); }
                                  }}
                                  disabled={!editChildId && !(detail.children[0]?._id)}
                                >Save Child</button>
                                <button
                                  className="text-sm bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                                  onClick={async()=>{
                                    const id = editChildId || (detail.children[0]?._id || "");
                                    if(!id) return;
                                    const hasEnr = (detail.enrollments||[]).some(e=> String(e.childId)===String(id));
                                    if(hasEnr){ alert('Cannot delete: child has enrollments. Remove them first.'); return; }
                                    if(!confirm('Delete this child?')) return;
                                    try{
                                      const res = await fetch(`/api/children/${id}`,{ method:'DELETE' });
                                      const d = await res.json().catch(()=>({}));
                                      if(!res.ok) throw new Error(d.error||'Failed to delete child');
                                      setEditChildId("");
                                      await openUserDetails(detail.user.email);
                                    }catch(e){ alert(e.message||String(e)); }
                                  }}
                                  disabled={!editChildId && !(detail.children[0]?._id)}
                                >Delete Child</button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">No children yet.</div>
                          )}
                        </div>)}

                      {Array.isArray(detail.children) && detail.children.length > 0 && (
                        <>
                          {(detail.children || []).map((child) => {
                            const childEnrollments = (detail.enrollments || []).filter((e) => String(e.childId) === String(child._id));
                            const selected = addClassByChild[String(child._id)] || "";
                            const dup = childEnrollments.some((e) => String(e.classId || e.class?._id) === String(selected));
                            const setSelected = (val) => setAddClassByChild((prev) => ({ ...prev, [String(child._id)]: val }));
                            const addForChild = async () => {
                              const childId = String(child._id);
                              const classId = String(selected || "");
                              if (!classId) return;
                              await addEnrollment(childId, classId);
                              setAddClassByChild((prev) => ({ ...prev, [String(child._id)]: "" }));
                            };
                            const childName = [child.firstName, child.lastName].filter(Boolean).join(" ");
                            return (
                              <div className="bg-gray-50 border rounded p-4" key={String(child._id)}>
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="font-semibold">{childName || "Child"}</h3>
                                  <div className="flex items-center gap-3">
                                    {editChildId !== String(child._id) ? (
                                      <button className="text-sm text-blue-600 hover:underline" onClick={() => startChildEdit(child)}>
                                        Edit
                                      </button>
                                    ) : (
                                      <>
                                        <button className="text-sm text-gray-600 hover:underline" onClick={cancelChildEdit}>
                                          Cancel
                                        </button>
                                        <button
                                          className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded disabled:opacity-60"
                                          disabled={!!childSaving[String(child._id)]}
                                          onClick={() => deleteChildById(child._id)}
                                        >
                                          Delete
                                        </button>
                                        <button
                                          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-60"
                                          disabled={!!childSaving[String(child._id)]}
                                          onClick={() => saveChildEdit(child._id)}
                                        >
                                          {childSaving[String(child._id)] ? "Saving..." : "Save"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {editChildId === String(child._id) && (
                                  <div className="grid md:grid-cols-4 gap-2 text-sm mb-3">
                                    <input
                                      className="border rounded p-1 w-full"
                                      placeholder="First name"
                                      value={(childForms[String(child._id)]?.firstName) ?? ""}
                                      onChange={(e) => setChildField(child._id, "firstName", e.target.value)}
                                    />
                                    <input
                                      className="border rounded p-1 w-full"
                                      placeholder="Last name"
                                      value={(childForms[String(child._id)]?.lastName) ?? ""}
                                      onChange={(e) => setChildField(child._id, "lastName", e.target.value)}
                                    />
                                    <input
                                      type="date"
                                      className="border rounded p-1 w-full"
                                      value={(childForms[String(child._id)]?.dob) ?? ""}
                                      onChange={(e) => setChildField(child._id, "dob", e.target.value)}
                                    />
                                    <div />
                                    <div className="md:col-span-4">
                                      <textarea
                                        rows={2}
                                        className="border rounded p-2 w-full"
                                        placeholder="Medical details"
                                        value={(childForms[String(child._id)]?.medical) ?? ""}
                                        onChange={(e) => setChildField(child._id, "medical", e.target.value)}
                                      />
                                    </div>
                                  </div>
                                )}
                                {childEnrollments.length > 0 ? (
                                  <div className="rounded border border-gray-200 overflow-hidden">
                                    <table className="min-w-full text-sm">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-3 py-2 border text-left">Class</th>
                                          <th className="px-3 py-2 border text-left">Schedule</th>
                                          <th className="px-3 py-2 border text-left">Teacher</th>
                                          <th className="px-3 py-2 border text-left">Status</th>
                                          {enrollEdit && (<th className="px-3 py-2 border text-left">Actions</th>)}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {childEnrollments.map((e) => (
                                          <tr key={e._id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 border">
                                              {editChildId === String(child._id) ? (
                                                <select
                                                  className="border rounded px-2 py-1 text-sm"
                                                  defaultValue={String(e.class?._id || "")}
                                                  onChange={(ev) =>
                                                    changeEnrollment(
                                                      String(child._id),
                                                      String(e.class?._id || e.classId),
                                                      ev.target.value
                                                    )
                                                  }
                                                >
                                                  <option value="">Select class</option>
                                                  {classes.map((c) => {
                                                    const enrolled = Number(c.studentCount || 0);
                                                    const cap = c.capacity != null ? String(c.capacity) : "8";
                                                    const label = `${c.name} - ${c.day || ""} ${c.time || ""} (${enrolled}/${cap})`;
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
                                              {editChildId === String(child._id) && (
                                              <td className="px-3 py-2 border">
                                                <button className="text-sm text-red-600 hover:underline" onClick={() => removeEnrollment(String(e.class?._id || e.classId), String(child._id))}>
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
                                {editChildId === String(child._id) && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <select className="border rounded px-2 py-1 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
                                      <option value="">Add to class.</option>
                                      {classes.map((c) => {
                                        const enrolled = Number(c.studentCount || 0);
                                        const cap = c.capacity != null ? String(c.capacity) : "8";
                                        const label = `${c.name} - ${c.day || ""} ${c.time || ""} (${enrolled}/${cap})`;
                                        return (
                                          <option key={c._id} value={c._id}>{label}</option>
                                        );
                                      })}
                                    </select>
                                    <button className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-60" disabled={!selected || dup} onClick={addForChild}>
                                      {dup ? "Already enrolled" : "Add"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Add Child footer */}
                      <div className="mt-4 flex justify-end">
                        {!addChildOpen ? (
                          <button
                            className="text-sm bg-pink-600 hover:bg-pink-700 text-white px-3 py-1 rounded"
                            onClick={() => setAddChildOpen(true)}
                          >
                            Add Child
                          </button>
                        ) : (
                          <div className="w-full bg-white border rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">Add Child</span>
                              <div className="flex items-center gap-3">
                                <button className="text-sm text-gray-600 hover:underline" onClick={() => { setAddChildOpen(false); setNewChild({ firstName: "", lastName: "", dob: "", medical: "" }); }}>
                                  Cancel
                                </button>
                                <button
                                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-60"
                                  disabled={!newChild.firstName || savingChild}
                                  onClick={async () => { await addChild(); setAddChildOpen(false); }}
                                >
                                  {savingChild ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                            <div className="grid md:grid-cols-4 gap-2 text-sm">
                              <input className="border rounded p-1 w-full" placeholder="First name" value={newChild.firstName} onChange={(e) => setNewChild((p) => ({ ...p, firstName: e.target.value }))} />
                              <input className="border rounded p-1 w-full" placeholder="Last name" value={newChild.lastName} onChange={(e) => setNewChild((p) => ({ ...p, lastName: e.target.value }))} />
                              <input type="date" className="border rounded p-1 w-full" value={newChild.dob} onChange={(e) => setNewChild((p) => ({ ...p, dob: e.target.value }))} />
                              <div />
                              <div className="md:col-span-4">
                                <textarea rows={2} className="border rounded p-2 w-full" placeholder="Medical details" value={newChild.medical} onChange={(e) => setNewChild((p) => ({ ...p, medical: e.target.value }))} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 border rounded p-4">
                        <h3 className="font-semibold mb-2">Payments</h3>
                        {Array.isArray(detail.payments) &&
                        detail.payments.length > 0 ? (
                          <ul className="space-y-1 text-sm">
                            {detail.payments.map((p, i) => {
                              const currency = String(
                                p?.currency || "GBP"
                              ).toUpperCase();
                              const amount = Number(p?.amount) || 0;
                              const amountText = new Intl.NumberFormat(
                                "en-GB",
                                {
                                  style: "currency",
                                  currency,
                                  minimumFractionDigits: 0,
                                }
                              ).format(amount);
                              const dateText = new Date(
                                p?.createdAt || p?.timestamp || Date.now()
                              ).toLocaleString();
                              const status =
                                p?.payment_status || p?.status || "paid";
                              return (
                                <li
                                  key={i}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="text-gray-600">
                                    {dateText}
                                  </span>
                                  <span className="font-medium">
                                    {amountText}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 capitalize">
                                    {status}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-600">
                            No payments recorded.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}






