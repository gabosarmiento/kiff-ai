"use client";
import React from "react";

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 720, padding: "40px 16px" }}>
        <h1 style={{ textAlign: "center", fontSize: 28, margin: 0, fontWeight: 700 }}>{title}</h1>
        {subtitle ? (
          <p style={{ textAlign: "center", marginTop: 8, color: "#64748b" }}>{subtitle}</p>
        ) : null}
        <div style={{ marginTop: 20, display: "grid", gap: 16 }}>{children}</div>
      </div>
    </div>
  );
}
