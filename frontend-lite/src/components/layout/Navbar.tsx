"use client";
import Link from "next/link";
import { useTheme } from "../theme/ThemeProvider";
import { getTenantId, setTenantId } from "../../lib/tenant";
import { useEffect, useState } from "react";
import { useLayoutState } from "./LayoutState";
import { authMe, authLogout, type Profile } from "../../lib/apiClient";

export function Navbar() {
  const { collapsed, toggleCollapsed } = useLayoutState();
  const { theme, toggle } = useTheme();
  const [tenant, setTenant] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    setTenant(getTenantId());
    // Attempt to load session profile
    (async () => {
      try {
        const me = await authMe();
        setProfile(me);
      } catch {
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, []);

  return (
    <header className="topnav" style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg)" }}>
      <button
        aria-label="Toggle sidebar"
        onClick={toggleCollapsed}
        className="button"
        style={{ padding: "6px 10px", background: "transparent", color: "inherit", border: "1px solid var(--border)" }}
      >
        ☰
      </button>
      <Link href="/" style={{ textDecoration: "none", color: "inherit", fontWeight: 700, marginLeft: 8 }}>Kiff AI</Link>
      <nav style={{ display: "flex", gap: 14, marginLeft: 16 }}>
        <Link href="/docs" style={{ textDecoration: "none", color: "inherit" }}>Docs</Link>
        <Link href="/account" style={{ textDecoration: "none", color: "inherit" }}>Account ▾</Link>
        {loadingProfile ? null : profile ? (
          <>
            {profile.role === "admin" ? (
              <Link href="/admin" style={{ textDecoration: "none", color: "inherit" }}>Admin</Link>
            ) : null}
          </>
        ) : (
          <>
            <Link href="/login" style={{ textDecoration: "none", color: "inherit" }}>Login</Link>
            <Link href="/signup" style={{ textDecoration: "none", color: "inherit" }}>Signup</Link>
          </>
        )}
      </nav>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <span className="label">Tenant</span>
        <input
          className="input"
          style={{ width: 260 }}
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          onBlur={() => setTenantId(tenant)}
          placeholder="Tenant ID"
        />
        <button className="button" onClick={toggle} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        {!loadingProfile && profile ? (
          <>
            <span className="label" title={profile.email}>
              {profile.role === "admin" ? "Admin" : "User"}
            </span>
            <button
              className="button"
              onClick={async () => {
                try {
                  await authLogout();
                } finally {
                  setProfile(null);
                  // Optional hard refresh so cookies/state are in sync
                  if (typeof window !== "undefined") window.location.reload();
                }
              }}
            >
              Logout
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
