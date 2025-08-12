"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAuth } from "@/hooks/useAuth";
import { apiJson } from "@/lib/api";

// Floating pill navbar with subtle glow, Storybook style
export function Navbar({ kiffName }: { kiffName?: string }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // Bag state
  type BagItem = {
    api_service_id: string;
    provider_id?: string;
    api_name?: string;
    provider_name?: string;
    logo_url?: string | null;
  };
  const [bagOpen, setBagOpen] = React.useState(false);
  const [bagLoading, setBagLoading] = React.useState(false);
  const [bag, setBag] = React.useState<BagItem[]>([]);
  const bagCount = bag?.length || 0;

  async function refreshBag() {
    try {
      setBagLoading(true);
      const items = await apiJson<any[]>("/api-gallery/bag", { method: "GET" });
      // Normalize minimal shape
      const mapped: BagItem[] = (items || []).map((it: any) => ({
        api_service_id: String(it.api_service_id || it.id || ""),
        provider_id: it.provider_id,
        api_name: it.name || it.api_name,
        provider_name: it.provider_name,
        logo_url: it.logo_url || it.provider_logo_url || null,
      })).filter(x => x.api_service_id);
      setBag(mapped);
    } catch (e) {
      console.warn("Failed to load bag", e);
      setBag([]);
    } finally {
      setBagLoading(false);
    }
  }

  async function removeFromBag(api_service_id: string) {
    try {
      await apiJson(`/api-gallery/bag/${encodeURIComponent(api_service_id)}`, { method: "DELETE" });
      await refreshBag();
    } catch (e) {
      console.warn("Failed to remove from bag", e);
    }
  }

  async function clearBag() {
    try {
      await apiJson(`/api-gallery/bag`, { method: "DELETE" });
      await refreshBag();
    } catch (e) {
      console.warn("Failed to clear bag", e);
    }
  }

  React.useEffect(() => {
    // Load initial bag count once
    refreshBag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on click/tap outside or Escape
  React.useEffect(() => {
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer, { passive: true });
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer as any);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <>
      {/* Desktop Navbar */}
      <header className="hidden md:block fixed left-1/2 top-4 z-40 -translate-x-1/2">
        <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-lg backdrop-blur">

          {/* Left / Logo */}
          <div className="pl-1 pr-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) {
                  if (user?.role === "admin") router.push("/admin/users");
                  else router.push("/kiffs/create");
                } else {
                  router.push("/login");
                }
              }}
              className="text-sm font-semibold text-slate-900 hover:opacity-80"
            >
              Kiff
            </button>
            {kiffName && (
              <span className="flex items-center text-sm text-slate-500 select-none">
                <span className="mx-1 text-slate-300">/</span>
                <span className="truncate max-w-[22vw] font-medium text-slate-700" title={kiffName}>{kiffName}</span>
              </span>
            )}
          </div>

          {/* Right actions: Bag + profile. The expanding pill is in normal flow so the container grows together */}
          <div
            ref={menuRef}
            className="ml-auto flex items-center"
            onBlur={(e) => {
              // If focus leaves the menu container entirely, close it
              const el = menuRef.current;
              const next = e.relatedTarget as Node | null;
              if (el && (!next || !el.contains(next))) {
                setOpen(false);
              }
            }}
          >
            {/* Floating Kiff Packs button */}
            <div className="mr-2">
              <button
                className="relative inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={async () => {
                  if (!bagOpen) await refreshBag();
                  setBagOpen(v => !v);
                }}
                aria-label="Kiff Packs"
              >
                <span>Packs</span>
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-900 px-1 text-xs text-white">
                  {bagLoading ? "…" : bagCount}
                </span>
              </button>
            </div>

            {/* Expanding segment to the left of the icon */}
            <div
              className={[
                "flex h-8 items-center overflow-hidden rounded-full border border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition-opacity duration-200",
                open ? "mr-2 w-auto px-2 opacity-100" : "w-0 px-0 opacity-0",
              ].join(" ")}
            >
              {isLoading ? null : isAuthenticated && user ? (
                <>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => router.push('/admin/api-gallery-editor')}
                      className="inline-flex items-center rounded-full px-2 py-1 hover:bg-slate-50"
                    >
                      Editor
                    </button>
                  )}
                  <button
                    onClick={() => router.push("/account")}
                    className="inline-flex items-center rounded-full px-2 py-1 hover:bg-slate-50"
                  >
                    Account
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => router.push("/login")} className="inline-flex items-center rounded-full px-2 py-1 hover:bg-slate-50">
                    Login
                  </button>
                  <span className="mx-2 h-4 w-px bg-slate-200" />
                  <button onClick={() => router.push("/signup")} className="inline-flex items-center rounded-full px-2 py-1 hover:bg-slate-50">
                    Signup
                  </button>
                </>
              )}
            </div>
            {/* Profile icon stays at far right */}
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setOpen((v) => !v)}
              aria-label="Profile"
            >
              {/* Inline user icon to avoid cross-package JSX typing issues */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      {/* Spacer to push page content below the floating nav - only on desktop */}
      <div aria-hidden className="hidden md:block h-[72px] w-full" />

      {/* Mobile floating pill: KIFF name + Packs (no Account/Profile) */}
      <div className="md:hidden fixed top-3 right-3 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur max-w-[85vw]">
        <span className="text-sm text-slate-500 select-none">KIFF</span>
        {kiffName && (
          <span className="flex items-center text-sm text-slate-500 select-none">
            <span className="mx-1 text-slate-300">/</span>
            <span className="truncate max-w-[30vw] font-medium text-slate-700" title={kiffName}>{kiffName}</span>
          </span>
        )}
        <button
          className="relative inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={async () => {
            if (!bagOpen) await refreshBag();
            setBagOpen(true);
          }}
          aria-label="Kiff Packs"
        >
          <span>Packs</span>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-900 px-1 text-xs text-white">
            {bagLoading ? "\u2026" : bagCount}
          </span>
        </button>
      </div>

      {/* Mobile FAB: Kiff Packs (only on small screens) */}
      <button
        className="md:hidden fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-3 shadow-lg"
        onClick={async () => {
          if (!bagOpen) await refreshBag();
          setBagOpen(true);
        }}
        aria-label="Open Kiff Packs"
      >
        <span>Packs</span>
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1 text-xs">
          {bagLoading ? "…" : bagCount}
        </span>
      </button>

      {/* Kiff Packs Panel */}
      {bagOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-end p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBagOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between p-3">
              <div className="font-semibold">Kiff Packs</div>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-600"
                onClick={() => setBagOpen(false)}
                aria-label="Close"
                title="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 8.586l4.95-4.95a1 1 0 111.414 1.415L11.414 10l4.95 4.95a1 1 0 01-1.414 1.415L10 11.414l-4.95 4.95a1 1 0 01-1.414-1.415L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="px-3 pb-3">
              {bagLoading ? (
                <div className="muted text-sm p-3">Loading…</div>
              ) : bag.length === 0 ? (
                <div className="muted text-sm p-3">
                  Your Kiff Pack is empty. Add APIs from the API Gallery using the &quot;+ Add&quot; button.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {bag.map((it) => (
                    <li key={it.api_service_id} className="flex items-center gap-3 p-3">
                      <div className="h-6 w-6 rounded bg-white ring-1 ring-slate-200 text-xs flex items-center justify-center">
                        {/* simple placeholder icon */}
                        <span>🔌</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{it.api_name || it.api_service_id}</div>
                        {it.provider_name ? (
                          <div className="truncate text-xs text-slate-500">{it.provider_name}</div>
                        ) : null}
                      </div>
                      <button
                        className="button"
                        onClick={() => removeFromBag(it.api_service_id)}
                        aria-label="Remove"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-3">
              <button className="button" onClick={clearBag} disabled={bag.length === 0}>Clear</button>
              <button
                className="button primary"
                onClick={() => {
                  setBagOpen(false);
                  router.push("/kiffs/compose");
                }}
                disabled={bag.length === 0}
              >
                Go to Compose
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
