"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function KiffsExpeditionPreloader() {
  const router = useRouter();
  const sp = useSearchParams();
  const kiff = sp.get("kiff");

  useEffect(() => {
    (async () => {
      if (!kiff) {
        router.replace("/kiffs");
        return;
      }
      const target = `/kiffs/launcher?kiff=${encodeURIComponent(kiff)}`;
      try {
        router.prefetch?.(target);
      } catch {}
      // Warm minimal APIs (tenant validated) to reduce first-interaction latency
      try {
        const [apiMod] = await Promise.all([
          import("../launcher/utils/api"),
        ]);
        try { await apiMod.apiClient.fetchModels(); } catch {}
      } catch {}
      setTimeout(() => {
        router.replace(target);
      }, 50);
    })();
  }, [kiff, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
        <div className="text-sm text-slate-600">Preparing your workspace…</div>
      </div>
    </div>
  );
}
