"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAuth } from "@/hooks/useAuth";

// Floating pill navbar with subtle glow, Storybook style
export function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

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
      <header className="fixed left-1/2 top-4 z-40 -translate-x-1/2">
        <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-lg backdrop-blur">

          {/* Left / Logo */}
          <div className="pl-1 pr-2">
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
          </div>

          {/* Right actions: profile only. The expanding pill is in normal flow so the container grows together */}
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
            {/* Expanding segment to the left of the icon */}
            <div
              className={[
                "flex h-8 items-center overflow-hidden rounded-full border border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition-opacity duration-200",
                open ? "mr-2 w-auto px-2 opacity-100" : "w-0 px-0 opacity-0",
              ].join(" ")}
            >
              {isLoading ? null : isAuthenticated && user ? (
                <button
                  onClick={() => router.push("/account")}
                  className="inline-flex items-center rounded-full px-2 py-1 hover:bg-slate-50"
                >
                  Account
                </button>
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
      {/* Spacer to push page content below the floating nav */}
      <div aria-hidden className="h-[72px] w-full" />
    </>
  );
}
