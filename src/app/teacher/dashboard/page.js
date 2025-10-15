"use client";

import DashboardLayout from "@/components/DashboardLayout";

export default function TeacherDashboard() {
  return (
    <DashboardLayout allowedRoles={["teacher", "admin"]}>
      <h1 className="text-2xl font-bold mb-4">Teacher Dashboard</h1>
      <p>Manage your classes, schedules, and students here.</p>
    </DashboardLayout>
  );
}
