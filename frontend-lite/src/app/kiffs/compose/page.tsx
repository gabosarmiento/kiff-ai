"use client";
import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { useLayoutState } from "@/components/layout/LayoutState";
import { KiffComposePanel } from "@/components/kiffs/KiffComposePanel";

export default function KiffComposerPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main
        className="pane"
        style={{ padding: 16, maxWidth: 1200, paddingLeft: leftWidth + 24, margin: "0 auto" }}
      >
        <KiffComposePanel />
      </main>
    </div>
  );
}
