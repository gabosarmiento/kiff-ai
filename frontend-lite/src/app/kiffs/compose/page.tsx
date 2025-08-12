"use client";
import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";
import { KiffComposePanel } from "@/components/kiffs/KiffComposePanel";
import { SandboxPreview } from "@/components/compose/SandboxPreview";
import { BuildProgress, type BuildEvent } from "@/components/compose/BuildProgress";
import {
  createPreviewSandboxRuntime,
  streamApplyFiles,
  restartDevServer,
  fetchPreviewLogs,
  type PreviewEvent,
  type ApplyFile,
} from "@/lib/preview";
import { apiJson } from "@/lib/api";

export default function KiffComposerPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  type BagItem = {
    api_service_id: string;
    api_name?: string;
    provider_name?: string;
  };
  const [bag, setBag] = React.useState<BagItem[]>([]);
  const [bagLoading, setBagLoading] = React.useState<boolean>(false);
  const [editOpen, setEditOpen] = React.useState<boolean>(false);

  // Minimal orchestration state (right column)
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("unavailable");
  const [events, setEvents] = React.useState<BuildEvent[]>([]);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [logs, setLogs] = React.useState<string>("");

  const pushEvent = React.useCallback((e: PreviewEvent) => setEvents((prev) => [...prev, e]), []);

  function parseFilesFromOutput(content: string): ApplyFile[] {
    const files: ApplyFile[] = [];
    const codeBlockRegex = /```(\w+)?\s*(?:\/\/\s*(.+\.(?:tsx?|jsx?|html|css|json|md))\s*)?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || "javascript";
      const filePath = match[2];
      const code = (match[3] || "").trim();
      if (filePath && code) files.push({ path: filePath, content: code, language });
    }
    if (files.length === 0 && content.trim()) {
      if (content.includes("<html") || content.includes("<!DOCTYPE")) {
        files.push({ path: "index.html", content: content, language: "html" });
      } else {
        files.push({ path: "README.md", content, language: "md" });
      }
    }
    return files;
  }

  async function handleOutput(content: string) {
    try {
      setBusy(true);
      setEvents([]);
      // 1) Create or attach sandbox (default vite runtime for quick preview)
      const resp = await createPreviewSandboxRuntime({ runtime: "vite", port: 5173, session_id: sessionId || undefined });
      setStatus(resp.status);
      setPreviewUrl(resp.preview_url || null);
      if (!sessionId) setSessionId(resp.session_id);

      const sid = sessionId || resp.session_id;
      // 2) Extract files from output and apply
      const files = parseFilesFromOutput(content);
      if (files.length) {
        await streamApplyFiles(sid, files, pushEvent);
      }
      // 3) Restart
      await restartDevServer(sid);
      // 4) Fetch logs once
      try {
        const r = await fetchPreviewLogs(sid);
        const text = (r.logs || []).map((x: any) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");
        setLogs(text);
      } catch {}
    } catch (e) {
      setEvents((prev) => [...prev, { type: "error", message: (e as any)?.message || String(e) }]);
    } finally {
      setBusy(false);
    }
  }

  async function refreshBag() {
    try {
      setBagLoading(true);
      const items = await apiJson<any[]>("/api-gallery/bag", { method: "GET" });
      const mapped: BagItem[] = (items || []).map((it: any) => ({
        api_service_id: String(it.api_service_id || it.id || ""),
        api_name: it.name || it.api_name,
        provider_name: it.provider_name,
      })).filter(x => x.api_service_id);
      setBag(mapped);
    } catch (e) {
      console.warn("compose: failed to load bag", e);
      setBag([]);
    } finally {
      setBagLoading(false);
    }
  }

  async function removeFromBag(api_service_id: string) {
    await apiJson(`/api-gallery/bag/${encodeURIComponent(api_service_id)}`, { method: "DELETE" });
    await refreshBag();
  }

  async function clearBag() {
    await apiJson(`/api-gallery/bag`, { method: "DELETE" });
    await refreshBag();
  }

  React.useEffect(() => {
    refreshBag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main
        className="pane pane-with-sidebar"
        style={{ 
          padding: "16px", 
          maxWidth: "1400px", 
          paddingLeft: leftWidth + 24, 
          margin: "0 auto", 
          overflowX: "hidden", 
          paddingBottom: 96 
        }}
      >

        {/* Improved responsive layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Compose Panel - Takes 2/3 on large screens */}
          <div className="lg:col-span-2">
            <KiffComposePanel 
              onOutput={handleOutput} 
              selectedAPIs={bag}
              bagLoading={bagLoading}
              onEditBag={() => setEditOpen(true)}
            />
          </div>
          
          {/* Preview & Status Panel - Takes 1/3 on large screens, full width on mobile */}
          <div className="lg:col-span-1 space-y-4">
            <SandboxPreview
              previewUrl={previewUrl}
              status={status}
              onOpen={() => previewUrl && window.open(previewUrl, "_blank")}
            />
            <BuildProgress events={events} busy={busy} onRestart={() => sessionId && restartDevServer(sessionId)} />
            {logs && (
              <div className="card">
                <div className="card-body" style={{ padding: 12 }}>
                  <div className="label mb-2">Console Logs</div>
                  <pre className="text-xs font-mono bg-gray-50 p-2 rounded h-32 overflow-auto whitespace-pre-wrap border">{logs}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
      {/* Edit modal to manage Kiff Packs */}
      <EditBagModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        bag={bag}
        bagLoading={bagLoading}
        onRemove={removeFromBag}
        onClear={clearBag}
      />
    </div>
  );
}

// Inline Edit modal to manage Kiff Packs on the Compose page
function EditBagModal(props: {
  open: boolean;
  onClose: () => void;
  bag: Array<{ api_service_id: string; api_name?: string; provider_name?: string }>;
  bagLoading: boolean;
  onRemove: (api_service_id: string) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between p-3">
          <div className="font-semibold">Edit Kiff Packs</div>
          <button className="button" onClick={props.onClose}>Close</button>
        </div>
        <div className="px-3 pb-3">
          {props.bagLoading ? (
            <div className="muted text-sm p-3">Loading…</div>
          ) : props.bag.length === 0 ? (
            <div className="muted text-sm p-3">No APIs selected. Use the API Gallery to add some.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {props.bag.map((it) => (
                <li key={it.api_service_id} className="flex items-center gap-3 p-3">
                  <div className="h-6 w-6 rounded bg-white ring-1 ring-slate-200 text-xs flex items-center justify-center">
                    <span>🔌</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.api_name || it.api_service_id}</div>
                    {it.provider_name ? (
                      <div className="truncate text-xs text-slate-500">{it.provider_name}</div>
                    ) : null}
                  </div>
                  <button className="button" onClick={() => props.onRemove(it.api_service_id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-3">
          <button className="button" onClick={props.onClear} disabled={props.bag.length === 0}>Clear</button>
          <button className="button primary" onClick={props.onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

