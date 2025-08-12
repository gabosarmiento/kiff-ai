"use client";
import React from "react";

interface KiffBreadcrumbProps {
  kiffName?: string;
}

export function KiffBreadcrumb({ kiffName }: KiffBreadcrumbProps) {
  if (!kiffName) return null;

  return (
    <div className="hidden md:block fixed left-1/2 top-20 z-30 -translate-x-1/2">
      <div className="flex items-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur">
        <span className="text-sm text-slate-500">KIFF</span>
        <span className="mx-2 text-slate-300">/</span>
        <span 
          className="text-sm font-medium text-slate-700 truncate max-w-[50vw]" 
          title={kiffName}
        >
          {kiffName}
        </span>
      </div>
    </div>
  );
}
