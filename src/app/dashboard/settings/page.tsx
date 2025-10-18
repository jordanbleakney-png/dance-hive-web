"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

export default function SettingsPage() {
  const [pwState, setPwState] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState({ emergencyName: "", emergencyPhone: "", emergencyRelation: "", medical: "" });
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

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
          emergencyContact: { name: profile.emergencyName, phone: profile.emergencyPhone, relation: profile.emergencyRelation },
          medical: profile.medical,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setProfileMsg("Details saved.");
    } catch (err: any) {
      setProfileMsg(err.message);
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

        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Emergency & Medical Details</h2>
          <form onSubmit={submitProfile} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded-md p-2" type="text" placeholder="Emergency contact name" value={profile.emergencyName} onChange={(e) => setProfile({ ...profile, emergencyName: e.target.value })} />
              <input className="border rounded-md p-2" type="tel" placeholder="Emergency contact phone" value={profile.emergencyPhone} onChange={(e) => setProfile({ ...profile, emergencyPhone: e.target.value })} />
              <input className="border rounded-md p-2" type="text" placeholder="Relation" value={profile.emergencyRelation} onChange={(e) => setProfile({ ...profile, emergencyRelation: e.target.value })} />
            </div>
            <textarea className="w-full border rounded-md p-2" placeholder="Medical information (optional)" rows={4} value={profile.medical} onChange={(e) => setProfile({ ...profile, medical: e.target.value })} />
            <button className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-md" type="submit">Save Details</button>
          </form>
          {profileMsg && <p className="mt-3 text-sm text-gray-700">{profileMsg}</p>}
        </section>
      </div>
    </DashboardLayout>
  );
}
