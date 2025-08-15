"use client";
import React from "react";

export type ProposedAction = {
  id: string;
  kind: "code" | "command" | "api" | "plan";
  title: string;
  description: string;
  rationale?: string;
  safety: "low" | "medium" | "high";
  params?: Record<string, any>;
  files?: Array<{ path: string; change: "create" | "modify" | "delete"; diff?: string }>;
  api_call?: { method: "GET" | "POST" | "PATCH"; url: string; body?: any };
  command?: { cmd: string; cwd?: string; destructive?: boolean };
  created_at: string;
  raw?: { name: string; args: string };
};

export type ActionStatus = {
  id: string;
  state: "proposed" | "executing" | "succeeded" | "failed" | "rejected" | "draft";
  logs?: string[];
  result?: any;
  error?: string;
};

export type EditPayload = {
  fields: Record<string, any>;
  file_patches?: Array<{ path: string; patch: string }>;
};

export function parseTags(content: string): {
  step?: number;
  thought?: string;
  validator?: string;
  action?: { name: string; args: string };
} {
  const rx = (tag: string) => new RegExp(`<\\s*${tag}\\s*>\\s*([\\s\\S]*?)\\s*<\\s*/\\s*${tag}\\s*>`, "i");
  const get = (tag: string) => (content.match(rx(tag))?.[1] ?? "").trim() || undefined;
  const actionRaw = get("Action");
  let action: { name: string; args: string } | undefined;
  if (actionRaw) {
    const m = actionRaw.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)\s*$/);
    action = m ? { name: m[1], args: (m[2] ?? "").trim() } : { name: "raw", args: actionRaw };
  }
  const steps = get("Steps");
  return {
    step: steps ? Number(steps) : undefined,
    thought: get("Thought"),
    validator: get("Validator"),
    action,
  };
}

export function ProposedActionCard(props: {
  action: ProposedAction;
  status: ActionStatus;
  onApprove: (action: ProposedAction) => void | Promise<void>;
  onReject: (action: ProposedAction) => void | Promise<void>;
  onEdit: (action: ProposedAction) => void | Promise<void>;
  hideControls?: boolean;
}) {
  const { action, status, onApprove, onReject, onEdit, hideControls } = props;
  const disabled = status.state !== "proposed" && status.state !== "draft";

  React.useEffect(() => {
    if (hideControls) return; // do not bind shortcuts if controls are hidden
    function onKey(e: KeyboardEvent) {
      if (disabled) return;
      if (e.key.toLowerCase() === "a") onApprove(action);
      if (e.key.toLowerCase() === "r") onReject(action);
      if (e.key.toLowerCase() === "e") onEdit(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, disabled, onApprove, onReject, onEdit, hideControls]);

  const safetyColor = action.safety === "high" ? "bg-rose-100 text-rose-800" : action.safety === "medium" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs rounded-full px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200">{action.kind}</span>
          <div className="font-semibold text-slate-800">{action.title}</div>
          <span className={`text-[11px] rounded-full px-2 py-0.5 ${safetyColor}`}>Safety: {action.safety}</span>
        </div>
        <div className="text-[11px] text-slate-500">{new Date(action.created_at).toLocaleTimeString()}</div>
      </div>
      <div className="p-3 text-sm">
        <div className="text-slate-700 whitespace-pre-wrap">{action.description}</div>
        {action.rationale && (
          <details className="mt-2">
            <summary className="text-xs text-slate-600 cursor-pointer">Rationale</summary>
            <div className="mt-1 text-[13px] text-slate-700 whitespace-pre-wrap">{action.rationale}</div>
          </details>
        )}
        {action.params && (
          <details className="mt-2">
            <summary className="text-xs text-slate-600 cursor-pointer">Parameters</summary>
            <pre className="mt-1 text-[12px] bg-slate-50 border border-slate-200 rounded p-2 overflow-auto">{JSON.stringify(action.params, null, 2)}</pre>
          </details>
        )}
        {action.files && action.files.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-slate-600 cursor-pointer">Change set preview</summary>
            <ul className="mt-1 space-y-2">
              {action.files.map((f) => (
                <li key={f.path} className="text-[13px]">
                  <div className="font-mono text-slate-800">{f.path} <span className="text-slate-500">({f.change})</span></div>
                  {f.diff && (
                    <pre className="mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[12px] overflow-auto whitespace-pre-wrap">{f.diff}</pre>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
        {action.command && (
          <div className="mt-2 text-[13px]">
            <div className="font-semibold">Command</div>
            <pre className="mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[12px] overflow-auto">{action.command.cmd}</pre>
          </div>
        )}
        {action.api_call && (
          <div className="mt-2 text-[13px]">
            <div className="font-semibold">API Call</div>
            <pre className="mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[12px] overflow-auto">{`${action.api_call.method} ${action.api_call.url}`}</pre>
            {action.api_call.body && (
              <pre className="mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[12px] overflow-auto">{JSON.stringify(action.api_call.body, null, 2)}</pre>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 border-t p-2">
        {!hideControls && (
          <>
            <button
              className="rounded-md bg-emerald-600 text-white text-xs px-3 py-1.5 disabled:opacity-50"
              onClick={() => onApprove(action)}
              disabled={disabled}
              aria-label="Approve"
            >Approve</button>
            <button
              className="rounded-md bg-rose-600 text-white text-xs px-3 py-1.5 disabled:opacity-50"
              onClick={() => onReject(action)}
              disabled={disabled}
              aria-label="Reject"
            >Reject</button>
            <button
              className="rounded-md border border-slate-200 bg-white text-slate-800 text-xs px-3 py-1.5 disabled:opacity-50"
              onClick={() => onEdit(action)}
              disabled={disabled}
              aria-label="Edit"
            >Edit</button>
          </>
        )}
        <div className="ml-auto text-[12px] text-slate-500">State: {status.state}</div>
      </div>
    </div>
  );
}
