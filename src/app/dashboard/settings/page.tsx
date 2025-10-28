"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function SettingsPage() {
  const [pwState, setPwState] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    // parent details
    parentFirstName: "",
    parentLastName: "",
    phone: "",
    // child details
    childDob: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    medical: "",
    // address
    houseNumber: "",
    street: "",
    city: "",
    county: "",
    postcode: "",
  });
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [childrenForms, setChildrenForms] = useState<any[]>([]);
  // Prefill from current account overview
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/account/overview');
        if (!res.ok) return;
        const data = await res.json();
        const toYMD = (iso?: string) => {
          if (!iso) return '';
          const d = new Date(iso);
          if (isNaN(d.getTime())) return '';
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        };
        // Address can be in two shapes: legacy { line1, line2, city, postcode } or new { houseNumber, street, city, county, postcode }
        const addr: any = data?.address || {};
        let houseNumber = addr.houseNumber || "";
        let street = addr.street || "";
        // If legacy line1 exists, try to split into house number + street
        if (!houseNumber && !street && addr.line1) {
          const line1 = String(addr.line1).trim();
          const parts = line1.split(/\s+/);
          if (parts.length > 1 && /^\d+[A-Za-z]?$/.test(parts[0])) {
            houseNumber = parts[0];
            street = parts.slice(1).join(" ");
          } else {
            street = line1;
          }
        }
        const city = addr.city || "";
        const county = addr.county || addr.region || "";
        const postcode = addr.postcode || addr.postalCode || "";

        setProfile((p) => ({
          ...p,
          parentFirstName: data?.parent?.firstName || p.parentFirstName,
          parentLastName: data?.parent?.lastName || p.parentLastName,
          phone: data?.phone || p.phone,
          childDob: toYMD(data?.child?.dob),
          emergencyName: data?.emergencyContact?.name || p.emergencyName,
          emergencyPhone: data?.emergencyContact?.phone || p.emergencyPhone,
          emergencyRelation: data?.emergencyContact?.relation || p.emergencyRelation,
          medical: data?.medical || p.medical,
          houseNumber: houseNumber || p.houseNumber,
          street: street || p.street,
          city: city || p.city,
          county: county || p.county,
          postcode: postcode || p.postcode,
        }));

        // Build children edit forms (for own children)
        const childrenArr = Array.isArray(data?.children) ? data.children : [];
        setChildrenForms(childrenArr.map((c: any) => ({
          _id: c._id,
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          dob: toYMD(c.dob),
          medical: c.medical || "",
          saving: false,
          msg: "",
        })));
      } catch {}
    })();
  }, []);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwState.newPassword !== pwState.confirmPassword) {
      setPwMsg("New passwords do not match.");
      return;
    }
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pwState),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      setPwMsg("Password updated successfully.");
      setPwState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPwMsg(err.message);
    }
  };

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent: { firstName: profile.parentFirstName, lastName: profile.parentLastName },
          phone: profile.phone,
          emergencyContact: {
            name: profile.emergencyName,
            phone: profile.emergencyPhone,
            relation: profile.emergencyRelation,
          },
          address: {
            houseNumber: profile.houseNumber,
            street: profile.street,
            city: profile.city,
            county: profile.county,
            postcode: profile.postcode,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setProfileMsg("Details saved.");
    } catch (err: any) {
      setProfileMsg(err.message);
    }
  };

  const setChildField = (id: string, key: string, value: any) => {
    setChildrenForms((prev) => prev.map((c) => (String(c._id) === String(id) ? { ...c, [key]: value } : c)));
  };

  const saveChild = async (id: string) => {
    setChildrenForms((prev) => prev.map((c) => (String(c._id) === String(id) ? { ...c, saving: true, msg: "" } : c)));
    const c = childrenForms.find((x) => String(x._id) === String(id));
    if (!c) return;
    try {
      const res = await fetch(`/api/children/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: c.firstName, lastName: c.lastName, dob: c.dob, medical: c.medical })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setChildrenForms((prev) => prev.map((x) => (String(x._id) === String(id) ? { ...x, saving: false, msg: 'Saved.' } : x)));
    } catch (err: any) {
      setChildrenForms((prev) => prev.map((x) => (String(x._id) === String(id) ? { ...x, saving: false, msg: err.message || 'Failed.' } : x)));
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-4">
        <div className="mb-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

        <section className="bg-white rounded-xl shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Set New Password</h2>
          <form onSubmit={submitPassword} className="space-y-3">
            <input className="w-full border rounded-md p-2" type="password" placeholder="Current password" value={pwState.currentPassword} onChange={(e) => setPwState({ ...pwState, currentPassword: e.target.value })} required />
            <input className="w-full border rounded-md p-2" type="password" placeholder="New password (min 8 chars)" value={pwState.newPassword} onChange={(e) => setPwState({ ...pwState, newPassword: e.target.value })} required minLength={8} />
            <input className="w-full border rounded-md p-2" type="password" placeholder="Confirm new password" value={pwState.confirmPassword} onChange={(e) => setPwState({ ...pwState, confirmPassword: e.target.value })} required minLength={8} />
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md" type="submit">Update Password</button>
          </form>
          {pwMsg && <p className="mt-3 text-sm text-gray-700">{pwMsg}</p>}
        </section>

        {/* Parent Details */}
        <section className="bg-white rounded-xl shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Parent Details</h2>
          <form onSubmit={submitProfile} className="space-y-3">
            {/* Parent name + phone */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded-md p-2" type="text" placeholder="Parent first name" value={profile.parentFirstName} onChange={(e) => setProfile({ ...profile, parentFirstName: e.target.value })} />
              <input className="border rounded-md p-2" type="text" placeholder="Parent last name" value={profile.parentLastName} onChange={(e) => setProfile({ ...profile, parentLastName: e.target.value })} />
              <input className="border rounded-md p-2" type="tel" placeholder="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>

            {/* Child details removed here; editable per child below */}

            {/* 3-5. Emergency contact fields */}
            <label className="block text-sm text-gray-600 mb-1">Emergency contact details</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded-md p-2" type="text" placeholder="Emergency contact name" value={profile.emergencyName} onChange={(e) => setProfile({ ...profile, emergencyName: e.target.value })} />
              <input className="border rounded-md p-2" type="tel" placeholder="Emergency contact phone" value={profile.emergencyPhone} onChange={(e) => setProfile({ ...profile, emergencyPhone: e.target.value })} />
              <input className="border rounded-md p-2" type="text" placeholder="Relation" value={profile.emergencyRelation} onChange={(e) => setProfile({ ...profile, emergencyRelation: e.target.value })} />
            </div>

            <h2 className="text-xl font-semibold mt-6 mb-2">Address</h2>
            <label className="block text-sm text-gray-600 mb-1">Address details</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded-md p-2" type="text" placeholder="House number" value={profile.houseNumber} onChange={(e) => setProfile({ ...profile, houseNumber: e.target.value })} />
              <input className="border rounded-md p-2" type="text" placeholder="Street name" value={profile.street} onChange={(e) => setProfile({ ...profile, street: e.target.value })} />
              <input className="border rounded-md p-2" type="text" placeholder="City" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
              <input className="border rounded-md p-2" type="text" placeholder="County" value={profile.county} onChange={(e) => setProfile({ ...profile, county: e.target.value })} />
              <input className="border rounded-md p-2 md:col-span-2" type="text" placeholder="Postcode" value={profile.postcode} onChange={(e) => setProfile({ ...profile, postcode: e.target.value })} />
            </div>

            <div className="pt-2">
              <button className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md" type="submit">Update Details</button>
            </div>
          </form>
          {profileMsg && <p className="mt-3 text-sm text-gray-700">{profileMsg}</p>}
        </section>

        {/* Children (each child editable) */}
        {childrenForms.length > 0 && (
          <section className="bg-white rounded-xl shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Children</h2>
            <div className="space-y-6">
              {childrenForms.map((c) => (
                <div key={String(c._id)} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <input className="border rounded-md p-2" type="text" placeholder="First name" value={c.firstName} onChange={(e) => setChildField(c._id, 'firstName', e.target.value)} />
                    <input className="border rounded-md p-2" type="text" placeholder="Last name" value={c.lastName} onChange={(e) => setChildField(c._id, 'lastName', e.target.value)} />
                    <input className="border rounded-md p-2" type="date" value={c.dob} onChange={(e) => setChildField(c._id, 'dob', e.target.value)} />
                    <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md" disabled={c.saving} onClick={() => saveChild(c._id)}>{c.saving ? 'Saving...' : 'Save'}</button>
                  </div>
                  <label className="block text-sm text-gray-600 mb-1">Medical information</label>
                  <textarea className="w-full border rounded-md p-2" rows={3} value={c.medical} onChange={(e) => setChildField(c._id, 'medical', e.target.value)} />
                  {c.msg && <div className="text-sm text-gray-600 mt-1">{c.msg}</div>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}











