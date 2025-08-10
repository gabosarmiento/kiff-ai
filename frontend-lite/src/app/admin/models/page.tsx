"use client";
import React from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import ModelsAdmin from "@/components/admin/ModelsAdmin";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { useLayoutState } from "@/components/layout/LayoutState";

export default function AdminModelsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminModelsPageContent />
    </ProtectedRoute>
  );
}

function AdminModelsPageContent() {
  const { user } = useAuth();

  return (
    <AdminShell>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Admin · Models</h1>
        <ModelsAdmin />
      </div>
    </AdminShell>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane" style={{ padding: 16, paddingLeft: leftWidth + 36, marginTop: 80 }}>{children}</main>
    </div>
  );
}
