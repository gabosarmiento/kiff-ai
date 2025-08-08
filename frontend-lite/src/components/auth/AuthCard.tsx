"use client";
import React from "react";

export function AuthCard({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="card">
      {title ? (
        <div className="card-header" style={{ letterSpacing: 0.3 }}>{title}</div>
      ) : null}
      <div className="card-body" style={{ display: "grid", gap: 12 }}>{children}</div>
      {footer ? <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>{footer}</div> : null}
    </section>
  );
}
