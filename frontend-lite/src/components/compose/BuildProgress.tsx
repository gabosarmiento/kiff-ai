"use client";
import React from "react";

export type BuildEvent = { type: string; [k: string]: any };

export function BuildProgress(props: {
  events: BuildEvent[];
  busy?: boolean;
  onRestart?: () => void;
  className?: string;
}) {
  const { events, busy, onRestart, className } = props;
  return (
    <div className={"rounded border bg-white " + (className || "")}> 
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm font-medium">Build Progress</div>
        <div className="flex items-center gap-2">
          <button className="button" onClick={onRestart} disabled={busy}>Restart</button>
        </div>
      </div>
      <div className="p-2 h-56 overflow-auto text-xs font-mono whitespace-pre-wrap">
        {events.length === 0 ? (
          <div className="text-slate-500 p-2">No events yet.</div>
        ) : (
          events.map((e, i) => (
            <div key={i}>{JSON.stringify(e)}</div>
          ))
        )}
      </div>
    </div>
  );
}
