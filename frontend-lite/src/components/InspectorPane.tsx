"use client";
import type { JobState } from "@/lib/types";

export function InspectorPane({ state, logs }: { state: JobState; logs: string[] }) {
  return (
    <div className="pane inspector">
      <div className="logs">
        {logs.length ? logs.join("\n") : "No logs yet."}
      </div>
      <div className="status">
        <strong>Status:</strong> {state}
      </div>
    </div>
  );
}
