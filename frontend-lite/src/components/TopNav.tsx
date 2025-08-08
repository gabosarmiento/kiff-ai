"use client";
import { getTenantId, setTenantId } from "@/lib/tenant";
import { useEffect, useState } from "react";

export function TopNav() {
  const [tenant, setTenant] = useState("");

  useEffect(() => {
    setTenant(getTenantId());
  }, []);

  return (
    <div className="topnav">
      <strong style={{ color: "var(--blue-600)" }}>Kiff Sandbox Lite</strong>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <span className="label">Tenant</span>
        <input
          className="input"
          style={{ width: 280 }}
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          onBlur={() => setTenantId(tenant)}
          placeholder="Tenant ID"
        />
      </div>
    </div>
  );
}
