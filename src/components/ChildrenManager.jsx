"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

/**
 * ChildrenManager
 * Combined add/edit/delete UI for a user's children.
 * Props:
 * - userId: string
 * - email: string (for context/logging; not required for API calls)
 * - children: array of { _id, firstName, lastName, dob, medical }
 * - enrollments: array of { _id, classId, childId, class? }
 * - refresh: function to refetch user details after mutations
 */
export default function ChildrenManager({ userId, email, children, enrollments, refresh }) {
  const childList = useMemo(() => (Array.isArray(children) ? children : []), [children]);
  const [selectedId, setSelectedId] = useState(() => (childList[0]?._id ? String(childList[0]._id) : ""));
  const [editor, setEditor] = useState({ firstName: "", lastName: "", dob: "", medical: "", dirty: false, saving: false });
  const [newChild, setNewChild] = useState({ firstName: "", lastName: "", dob: "", medical: "", saving: false });

  // Sync selection + editor when children change
  useEffect(() => {
    const initial = childList[0]?._id ? String(childList[0]._id) : "";
    setSelectedId((prev) => (prev ? prev : initial));
  }, [childList]);

  useEffect(() => {
    if (!selectedId) {
      setEditor((e) => ({ ...e, firstName: "", lastName: "", dob: "", medical: "", dirty: false }));
      return;
    }
    const c = childList.find((x) => String(x._id) === String(selectedId));
    if (c) {
      setEditor({
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        dob: c.dob ? String(c.dob).slice(0, 10) : "",
        medical: c.medical || "",
        dirty: false,
        saving: false,
      });
    }
  }, [selectedId, childList]);

  function updateEditor(field, value) {
    setEditor((prev) => ({ ...prev, [field]: value, dirty: true }));
  }

  function validDate(iso) {
    if (!iso) return true;
    const d = new Date(iso);
    return !Number.isNaN(d.getTime());
  }

  async function saveExisting() {
    if (!selectedId) return;
    const d = editor;
    if (!d.firstName || !validDate(d.dob)) return;
    try {
      setEditor((p) => ({ ...p, saving: true }));
      const body = {};
      if (d.firstName != null) body.firstName = d.firstName;
      if (d.lastName != null) body.lastName = d.lastName;
      body.dob = d.dob || null;
      if (d.medical != null) body.medical = d.medical;
      const res = await fetch(`/api/children/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save child");
      toast.success("Child saved");
      await refresh();
    } catch (e) {
      toast.error(e.message || String(e));
    } finally {
      setEditor((p) => ({ ...p, saving: false, dirty: false }));
    }
  }

  async function addChild() {
    if (!newChild.firstName || !userId || !validDate(newChild.dob)) return;
    try {
      setNewChild((p) => ({ ...p, saving: true }));
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          firstName: newChild.firstName,
          lastName: newChild.lastName,
          dob: newChild.dob || undefined,
          medical: newChild.medical,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to add child");
      setNewChild({ firstName: "", lastName: "", dob: "", medical: "", saving: false });
      toast.success("Child added");
      await refresh();
    } catch (e) {
      toast.error(e.message || String(e));
      setNewChild((p) => ({ ...p, saving: false }));
    }
  }

  async function deleteChild() {
    if (!selectedId) return;
    const childEnrollments = (Array.isArray(enrollments) ? enrollments : []).filter(
      (e) => String(e.childId) === String(selectedId)
    );
    const needsCascade = childEnrollments.length > 0;
    const ok = confirm(
      needsCascade
        ? "This child has enrollments. Remove them and delete the child?"
        : "Delete this child?"
    );
    if (!ok) return;
    try {
      setEditor((p) => ({ ...p, saving: true }));
      const url = needsCascade
        ? `/api/children/${selectedId}?force=true`
        : `/api/children/${selectedId}`;
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete child");
      toast.success("Child deleted");
      setSelectedId("");
      await refresh();
    } catch (e) {
      toast.error(e.message || String(e));
    } finally {
      setEditor((p) => ({ ...p, saving: false }));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Manage Children</h3>

      {/* Selector + editor for existing child */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select Child</option>
            {childList.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {[c.firstName, c.lastName].filter(Boolean).join(" ") || "(no name)"}
              </option>
            ))}
          </select>
          <button
            className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded disabled:opacity-60"
            disabled={!selectedId || editor.saving}
            onClick={deleteChild}
          >
            Delete
          </button>
        </div>

        <div className="bg-gray-50 border rounded p-3">
          <div className="grid md:grid-cols-4 gap-2 text-sm">
            <div>
              <div className="text-gray-600 text-xs">First name</div>
              <input
                className="border rounded p-1 w-full"
                value={editor.firstName}
                onChange={(e) => updateEditor("firstName", e.target.value)}
                disabled={!selectedId}
              />
            </div>
            <div>
              <div className="text-gray-600 text-xs">Last name</div>
              <input
                className="border rounded p-1 w-full"
                value={editor.lastName}
                onChange={(e) => updateEditor("lastName", e.target.value)}
                disabled={!selectedId}
              />
            </div>
            <div>
              <div className="text-gray-600 text-xs">Date of birth</div>
              <input
                type="date"
                className="border rounded p-1 w-full"
                value={editor.dob}
                onChange={(e) => updateEditor("dob", e.target.value)}
                disabled={!selectedId}
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-60"
                disabled={!selectedId || !editor.firstName || !editor.dirty || editor.saving || !validDate(editor.dob)}
                onClick={saveExisting}
              >
                {editor.saving ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="md:col-span-4">
              <div className="text-gray-600 text-xs">Medical info</div>
              <textarea
                rows={2}
                className="border rounded p-2 w-full"
                value={editor.medical}
                onChange={(e) => updateEditor("medical", e.target.value)}
                disabled={!selectedId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add child */}
      <div className="bg-white border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">Add Child</span>
        </div>
        <div className="grid md:grid-cols-4 gap-2 text-sm">
          <div>
            <div className="text-gray-600 text-xs">First name</div>
            <input
              className="border rounded p-1 w-full"
              value={newChild.firstName}
              onChange={(e) => setNewChild((p) => ({ ...p, firstName: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-gray-600 text-xs">Last name</div>
            <input
              className="border rounded p-1 w-full"
              value={newChild.lastName}
              onChange={(e) => setNewChild((p) => ({ ...p, lastName: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-gray-600 text-xs">Date of birth</div>
            <input
              type="date"
              className="border rounded p-1 w-full"
              value={newChild.dob}
              onChange={(e) => setNewChild((p) => ({ ...p, dob: e.target.value }))}
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              className="text-sm bg-pink-600 hover:bg-pink-700 text-white px-3 py-1 rounded disabled:opacity-60"
              disabled={!newChild.firstName || newChild.saving || !validDate(newChild.dob)}
              onClick={addChild}
            >
              {newChild.saving ? "Adding..." : "Add"}
            </button>
          </div>
          <div className="md:col-span-4">
            <div className="text-gray-600 text-xs">Medical info (optional)</div>
            <textarea
              rows={2}
              className="border rounded p-2 w-full"
              value={newChild.medical}
              onChange={(e) => setNewChild((p) => ({ ...p, medical: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
