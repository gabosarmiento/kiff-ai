"use client";
// Tenant controls are intentionally hidden for now. Header logic remains via withTenantHeaders().

export function TopNav() {
  return (
    <div className="topnav">
      <strong style={{ color: "var(--blue-600)" }}>Kiff Sandbox Lite</strong>
      {/* Right-side actions can go here. Tenant ID input hidden by request. */}
    </div>
  );
}
