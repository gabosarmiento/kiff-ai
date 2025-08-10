"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authLogout } from "../../../lib/apiClient";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await authLogout();
      } catch {
        // ignore
      } finally {
        // Hard redirect to clear any client state
        router.replace("/login");
        if (typeof window !== "undefined") window.location.reload();
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
          <p className="text-sm text-slate-700">Signing you out…</p>
        </div>
      </div>
    </div>
  );
}
