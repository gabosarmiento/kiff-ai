"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const AUTH_PAGES = new Set<string>(["/", "/login", "/signup", "/auth/logout"]);
const BARE_PAGES = new Set<string>(["/account", "/extractor", "/kiffs", "/kiffs/create", "/kiffs/compose", "/api-gallery", "/kb"]);

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();

  const isAuthPage = AUTH_PAGES.has(pathname);
  const isBarePage = BARE_PAGES.has(pathname);
  const isAdminPage = pathname.startsWith("/admin");

  // Auth pages and bare pages should render bare (middleware already prevents access when authenticated)
  if (isAuthPage || isBarePage || isAdminPage) return <>{children}</>;

  // For all other routes, show app chrome. When loading/no user yet, show skeleton to avoid flicker
  if (isLoading || !user) {
    return (
      <div className="container mx-auto" style={{ padding: 16 }}>
        <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
            <span>Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto" style={{ padding: 16 }}>
      <div className="pane" style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
