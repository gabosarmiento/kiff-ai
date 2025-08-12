"use client";
import React from "react";

export function SandboxPreview(props: {
  previewUrl?: string | null;
  status?: string;
  onOpen?: () => void;
  className?: string;
}) {
  const { previewUrl, status, onOpen, className } = props;
  return (
    <div className={"rounded border bg-white " + (className || "")}> 
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm font-medium">Live Preview</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{status || ""}</span>
          <button className="button" onClick={onOpen} disabled={!previewUrl}>Open</button>
        </div>
      </div>
      {previewUrl ? (
        <iframe src={previewUrl} className="w-full h-72" />
      ) : (
        <div className="p-4 text-sm text-slate-500">No preview yet. Generate to see your app.</div>
      )}
    </div>
  );
}
