"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutState } from "./LayoutState";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/api-gallery", label: "API Gallery" },
  { href: "/account", label: "Account" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed } = useLayoutState();
  return (
    <nav style={{ padding: 12, width: collapsed ? 64 : 240, transition: "width 120ms" }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className="navlink"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: active ? "var(--muted)" : "transparent",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <span style={{
                  opacity: collapsed ? 0 : 1,
                  whiteSpace: "nowrap",
                  transition: "opacity 120ms",
                }}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
