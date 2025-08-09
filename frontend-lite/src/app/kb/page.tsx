"use client";
import React from "react";
import { Navbar } from "../../components/layout/Navbar";
import { AppSidebar } from "../../components/navigation/AppSidebar";
import { useLayoutState } from "../../components/layout/LayoutState";

export default function KBPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  return (
    <div className="app-shell">
      <Navbar />
      <AppSidebar />
      <main className="pane" style={{ padding: 16, maxWidth: 900, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Knowledge Base</h1>
          <p className="label" style={{ marginTop: 8 }}>Manage LanceDB knowledge bases created from your extraction previews.</p>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-body">
              <p className="muted">Coming soon: list KBs, show document counts, reindex, delete, and usage metrics.</p>
            </div>
          </div>
      </main>
    </div>
  );
}
