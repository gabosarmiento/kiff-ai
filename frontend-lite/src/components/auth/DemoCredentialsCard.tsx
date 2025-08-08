"use client";
import React from "react";

export function DemoCredentialsCard({ onFill }: { onFill: (email: string, password: string) => void }) {
  return (
    <section className="card">
      <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Demo credentials</div>
          <div className="muted">Real database users — click to autofill</div>
          <div style={{ marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12 }}>
            demo@kiff.dev / demo12345
          </div>
        </div>
        <button className="button" style={{ background: "#fff", color: "#0f172a", border: "1px solid var(--border)" }} onClick={() => onFill("demo@kiff.dev", "demo12345")}>Fill Demo</button>
      </div>
    </section>
  );
}
