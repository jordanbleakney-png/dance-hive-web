"use client";

import DashboardLayout from "@/components/DashboardLayout";

export default function AdminPage() {
  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <a href="/admin/users" className="block bg-white p-5 rounded-xl shadow hover:shadow-md transition">
          <h2 className="font-semibold mb-1">Users</h2>
          <p className="text-gray-600 text-sm">Search and view user accounts</p>
        </a>
        <a href="/admin/trials" className="block bg-white p-5 rounded-xl shadow hover:shadow-md transition">
          <h2 className="font-semibold mb-1">Trials</h2>
          <p className="text-gray-600 text-sm">Manage trial bookings</p>
        </a>
        <a href="/admin/payments" className="block bg-white p-5 rounded-xl shadow hover:shadow-md transition">
          <h2 className="font-semibold mb-1">Payments</h2>
          <p className="text-gray-600 text-sm">View recent transactions</p>
        </a>
        <a href="/admin/classes" className="block bg-white p-5 rounded-xl shadow hover:shadow-md transition">
          <h2 className="font-semibold mb-1">Classes</h2>
          <p className="text-gray-600 text-sm">Manage classes and students</p>
        </a>
      </div>
    </DashboardLayout>
  );
}
