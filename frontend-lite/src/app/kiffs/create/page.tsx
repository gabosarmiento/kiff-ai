"use client";
import React from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { KiffCreatePage } from "@/components/kiffs/KiffCreatePage";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";

export default function KiffsCreatePage() {
  return (
    <ProtectedRoute>
      <KiffsCreatePageContent />
    </ProtectedRoute>
  );
}

function KiffsCreatePageContent() {
  const router = useRouter();
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const handleCreate = React.useCallback(() => {
    // Placeholder: route to a future Kiff composer or show a toast
    router.push("/kiffs/launcher");
  }, [router]);

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main
        className="pane pane-with-sidebar"
        style={{ padding: 16, maxWidth: 1200, paddingLeft: leftWidth + 24, margin: "0 auto" }}
      >
        <KiffCreatePage mode="light" onCreate={handleCreate} />
      </main>
      <BottomNav />
    </div>
  );
}
