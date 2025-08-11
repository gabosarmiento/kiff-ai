"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutState } from "./LayoutState";

type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  children?: NavItem[];
};

const NAV: NavItem[] = [
  {
    id: "workspace",
    label: "Workspace",
    children: [
      { id: "home", label: "Dashboard", href: "/", icon: "🏠" },
      { id: "api-gallery", label: "API Gallery", href: "/api-gallery", icon: "🧩" },
      { id: "extractor", label: "Extractor", href: "/extractor", icon: "🧪" },
      { id: "kp", label: "Kiff Packs", href: "/kp", icon: "📚" },
      { id: "kiffs", label: "Kiffs", href: "/kiffs", icon: "⚡" },
    ],
  },
  {
    id: "account",
    label: "Account",
    children: [
      { id: "account-home", label: "Account", href: "/account", icon: "👤" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed } = useLayoutState();

  const width = collapsed ? 64 : 240;

  return (
    <aside
      className="pane"
      style={{
        padding: 12,
        width,
        transition: "width 150ms ease-out",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {NAV.map((section) => (
        <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
                padding: "6px 8px",
              }}
            >
              {section.label}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(section.children || []).map((it) => {
              const active = it.href && pathname === it.href;
              const content = (
                <div
                  className="navlink"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: active ? "var(--muted)" : "transparent",
                    color: "inherit",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ width: 20, textAlign: "center" }}>{it.icon ?? "•"}</span>
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </div>
              );
              return (
                <div key={it.id} title={collapsed ? it.label : undefined}>
                  {it.href ? (
                    <Link href={it.href} style={{ textDecoration: "none", color: "inherit" }}>
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ marginTop: "auto", fontSize: 11, color: "var(--muted-foreground)", padding: "8px 8px 0" }}>
        {!collapsed ? "© Kiff AI" : "©"}
      </div>
    </aside>
  );
}
