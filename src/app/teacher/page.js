"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TeacherPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !session?.user?.email) {
      router.replace("/login");
      return;
    }
    // Only allow teachers
    if (session.user.role !== "teacher") {
      router.replace("/dashboard");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return <div className="p-10 text-center">Loading...</div>;
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
      <p>Welcome {session.user.name}</p>
    </div>
  );
}
