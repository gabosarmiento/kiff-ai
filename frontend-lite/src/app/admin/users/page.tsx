"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import UsersAdmin from "@/components/admin/UsersAdmin";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== "admin") {
        router.replace("/kiffs/create");
      }
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Admin · Users</h1>
      <UsersAdmin />
    </div>
  );
}
