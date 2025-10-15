"use client";

import DashboardLayout from "@/components/DashboardLayout";

export default function AdminPage() {
  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <p>
        Welcome to the admin dashboard. Manage users, payments, and settings
        here.
      </p>
    </DashboardLayout>
  );
}
