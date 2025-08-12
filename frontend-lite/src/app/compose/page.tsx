"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPreviewSandboxRuntime,
  streamApplyFiles,
  streamInstallPackages,
  restartDevServer,
  fetchPreviewLogs,
  setSecrets,
  applyUnifiedDiff,
  fetchFileTree,
  fetchFileContent,
  type PreviewEvent,
} from "@/lib/preview";
import { resolveDeps, type ResolveResponse } from "@/lib/deps";
import { getTenantId } from "@/lib/tenant";

// Types for manifest and delta inputs
interface ManifestSpec {
  runtime?: "python" | "vite" | "node";
  port?: number;
  python_entry?: string;
  deps?: { python?: string[]; node?: string[] };
  files?: { path: string; content: string; language?: string }[];
  env_schema?: Record<string, { label?: string; required?: boolean; hint?: string }>;
  secrets?: Record<string, string>;
}

export default function ComposePage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [runtime, setRuntime] = useState<"python" | "vite" | "node">("vite");
  const [port, setPort] = useState<number>(5173);
  const [pythonEntry, setPythonEntry] = useState<string>("app.main:app");

  const [manifestText, setManifestText] = useState<string>(`{
  "runtime": "vite",
  "port": 5173,
  "deps": { "node": ["vite", "react", "react-dom"] },
  "files": [
    {"path":"index.html","content":"<!doctype html><div id=app>hello</div>","language":"html"}
  ],
  "env_schema": {"EXAMPLE_API_KEY": {"label": "Example API Key", "required": false}}
}`);
  const [deltaDiff, setDeltaDiff] = useState<string>("");

  const [events, setEvents] = useState<PreviewEvent[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [sandboxStatus, setSandboxStatus] = useState<string>("unavailable");
  const [installing, setInstalling] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [resolving, setResolving] = useState<boolean>(false);
  const [secrets, setSecretsState] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<ResolveResponse>({ python: {}, node: {} });

  const [fileTree, setFileTree] = useState<Array<{ path: string; size: number }>>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [selectedContent, setSelectedContent] = useState<string>("");

  const abortApplyRef = useRef<AbortController | null>(null);
  const abortInstallRef = useRef<AbortController | null>(null);

  const tenantId = useMemo(() => getTenantId(), []);

  const pushEvent = useCallback((e: PreviewEvent) => setEvents((prev) => [...prev, e]), []);

  const parseManifest = useCallback((): ManifestSpec | null => {
    try {
      return JSON.parse(manifestText);
    } catch (e) {
      alert("Invalid manifest JSON");
      return null;
    }
  }, [manifestText]);

  const createSandbox = useCallback(async () => {
    const manifest = parseManifest();
    if (!manifest) return;

    const args = {
      session_id: sessionId || undefined,
      runtime: manifest.runtime ?? runtime,
      port: manifest.port ?? port,
      python_entry: manifest.python_entry ?? pythonEntry,
    } as const;
    const resp = await createPreviewSandboxRuntime(args);
    setSandboxStatus(resp.status);
    setPreviewUrl(resp.preview_url || "");
    if (!sessionId) setSessionId(resp.session_id);
  }, [parseManifest, port, pythonEntry, runtime, sessionId]);

  const applyFiles = useCallback(async () => {
    const manifest = parseManifest();
    if (!manifest || !sessionId) return;
    if (!manifest.files || manifest.files.length === 0) {
      alert("No files in manifest");
      return;
    }
    setApplying(true);
    abortApplyRef.current?.abort();
    const ctl = new AbortController();
    abortApplyRef.current = ctl;
    setEvents([]);
    try {
      await streamApplyFiles(sessionId, manifest.files, pushEvent, ctl.signal);
    } catch (e: any) {
      pushEvent({ type: "error", message: e?.message || String(e) });
    } finally {
      setApplying(false);
    }
  }, [parseManifest, sessionId, pushEvent]);

  const resolveAndInstall = useCallback(async () => {
    const manifest = parseManifest();
    if (!manifest || !sessionId) return;
    const req = {
      session_id: sessionId,
      python: manifest.deps?.python ?? [],
      node: manifest.deps?.node ?? [],
    };
    setResolving(true);
    try {
      const res = await resolveDeps(req);
      setResolved(res);
      const packages: string[] = [];
      for (const [n, v] of Object.entries(res.python)) packages.push(`${n}==${v}`);
      for (const [n, v] of Object.entries(res.node)) packages.push(`${n}@${v}`);
      if (packages.length === 0) return;
      setInstalling(true);
      abortInstallRef.current?.abort();
      const ctl = new AbortController();
      abortInstallRef.current = ctl;
      setEvents([]);
      await streamInstallPackages(sessionId, packages, pushEvent, ctl.signal);
    } catch (e: any) {
      pushEvent({ type: "error", message: e?.message || String(e) });
    } finally {
      setInstalling(false);
      setResolving(false);
    }
  }, [parseManifest, sessionId, pushEvent]);

  const restart = useCallback(async () => {
    if (!sessionId) return;
    const r = await restartDevServer(sessionId);
    pushEvent({ type: "info", message: r.message });
  }, [sessionId, pushEvent]);

  const applyPatch = useCallback(async () => {
    if (!sessionId) return;
    if (!deltaDiff.trim()) {
      alert("Provide a unified diff in Delta");
      return;
    }
    try {
      await applyUnifiedDiff(sessionId, deltaDiff);
      pushEvent({ type: "info", message: "Patch submitted" });
    } catch (e: any) {
      pushEvent({ type: "error", message: e?.message || String(e) });
    }
  }, [sessionId, deltaDiff, pushEvent]);

  const saveSecrets = useCallback(async () => {
    if (!sessionId) return;
    try {
      await setSecrets(sessionId, secrets);
      pushEvent({ type: "info", message: "Secrets stored (applied on next restart)" });
    } catch (e: any) {
      pushEvent({ type: "error", message: e?.message || String(e) });
    }
  }, [sessionId, secrets, pushEvent]);

  const pollLogs = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { logs: entries } = await fetchPreviewLogs(sessionId);
      const text = (entries || []).map((e: any) => (typeof e === "string" ? e : JSON.stringify(e))).join("\n");
      setLogs(text);
    } catch (e) {
      // ignore
    }
  }, [sessionId]);

  const refreshTree = useCallback(async () => {
    if (!sessionId) return;
    try {
      const t = await fetchFileTree(sessionId);
      setFileTree(t.files || []);
    } catch (e) {}
  }, [sessionId]);

  const openFile = useCallback(async (p: string) => {
    if (!sessionId) return;
    try {
      const r = await fetchFileContent(sessionId, p);
      setSelectedFile(p);
      setSelectedContent(r.content || "");
    } catch (e) {}
  }, [sessionId]);

  useEffect(() => {
    const id = setInterval(() => {
      pollLogs();
    }, 1500);
    return () => clearInterval(id);
  }, [pollLogs]);

  // Build secrets UI dynamically from manifest env_schema if present
  const envSchema = useMemo(() => {
    const m = parseManifest();
    return m?.env_schema || {};
  }, [parseManifest]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Compose</h1>
        <div className="text-sm text-gray-500">Tenant: {tenantId}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Manifest and Delta */}
        <div className="space-y-4 lg:col-span-2">
          <div className="bg-white rounded border p-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-gray-600">Session ID</label>
                <input value={sessionId} onChange={(e)=>setSessionId(e.target.value)} className="input input-bordered w-64" placeholder="autogenerated if empty" />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Runtime</label>
                <select value={runtime} onChange={(e)=>setRuntime(e.target.value as any)} className="select select-bordered">
                  <option value="vite">Vite (Node)</option>
                  <option value="node">Node (non-Vite)</option>
                  <option value="python">Python</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600">Port</label>
                <input type="number" value={port} onChange={(e)=>setPort(parseInt(e.target.value||"0")||0)} className="input input-bordered w-24" />
              </div>
              {runtime === "python" && (
                <div>
                  <label className="block text-xs text-gray-600">Python Entry (uvicorn)</label>
                  <input value={pythonEntry} onChange={(e)=>setPythonEntry(e.target.value)} className="input input-bordered w-72" placeholder="app.main:app" />
                </div>
              )}
              <div className="self-end">
                <button className="btn btn-primary" onClick={createSandbox}>Create/Attach Sandbox</button>
              </div>
            </div>
            <div className="text-xs text-gray-500">Status: {sandboxStatus} | Preview: {previewUrl ? <a href={previewUrl} target="_blank" className="link">open</a> : "n/a"}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded border p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Manifest</h2>
                <div className="flex gap-2">
                  <button className="btn btn-sm" onClick={applyFiles} disabled={applying}>Apply Files</button>
                  <button className="btn btn-sm" onClick={resolveAndInstall} disabled={installing || resolving}>Resolve & Install</button>
                  <button className="btn btn-sm" onClick={restart}>Restart</button>
                </div>
              </div>
              <textarea value={manifestText} onChange={(e)=>setManifestText(e.target.value)} className="textarea textarea-bordered w-full h-80 font-mono text-xs" />
              {Object.keys(resolved.python).length + Object.keys(resolved.node).length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  <div><b>Resolved Python:</b> {Object.entries(resolved.python).map(([n,v])=>`${n}==${v}`).join(", ") || "-"}</div>
                  <div><b>Resolved Node:</b> {Object.entries(resolved.node).map(([n,v])=>`${n}@${v}`).join(", ") || "-"}</div>
                </div>
              )}
              <div className="mt-3">
                <h3 className="font-medium text-sm mb-2">Secrets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(envSchema).map(([key, meta]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs text-gray-600">{meta.label || key}</label>
                      <input
                        className="input input-bordered w-full"
                        placeholder={meta.hint || key}
                        value={secrets[key] || ""}
                        onChange={(e)=>setSecretsState((s)=>({ ...s, [key]: e.target.value }))}
                        type="password"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <button className="btn btn-sm" onClick={saveSecrets}>Save Secrets</button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded border p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Delta (Unified Diff)</h2>
                <div className="flex gap-2">
                  <button className="btn btn-sm" onClick={applyPatch}>Apply Patch</button>
                </div>
              </div>
              <textarea value={deltaDiff} onChange={(e)=>setDeltaDiff(e.target.value)} className="textarea textarea-bordered w-full h-80 font-mono text-xs" placeholder={"diff --git a/file b/file\n..."} />
              <div className="mt-2 text-xs text-gray-600">Patches are applied in sandbox; if patch tools are missing, diff is saved to <code>.last_patch.diff</code>.</div>
            </div>
          </div>
        </div>

        {/* Right column: Preview, Events, Logs, Files */}
        <div className="space-y-4">
          <div className="bg-white rounded border p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <h2 className="font-semibold">Preview</h2>
              <button className="btn btn-xs" onClick={()=>window.open(previewUrl || "#", "_blank")} disabled={!previewUrl}>Open</button>
            </div>
            <div className="border rounded overflow-hidden">
              {previewUrl ? (
                <iframe src={previewUrl} className="w-full h-64" />
              ) : (
                <div className="p-4 text-sm text-gray-500">No preview available yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded border p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <h2 className="font-semibold">Events</h2>
              <button className="btn btn-xs" onClick={()=>setEvents([])}>Clear</button>
            </div>
            <div className="p-2 h-40 overflow-auto text-xs font-mono whitespace-pre-wrap">
              {events.map((e, i)=> <div key={i}>{JSON.stringify(e)}</div>)}
            </div>
          </div>

          <div className="bg-white rounded border p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <h2 className="font-semibold">Logs</h2>
              <div className="flex gap-2">
                <button className="btn btn-xs" onClick={pollLogs}>Refresh</button>
                <button className="btn btn-xs" onClick={()=>setLogs("")}>Clear</button>
              </div>
            </div>
            <pre className="p-2 h-40 overflow-auto text-xs font-mono whitespace-pre-wrap">{logs}</pre>
          </div>

          <div className="bg-white rounded border p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <h2 className="font-semibold">Files</h2>
              <div className="flex gap-2">
                <button className="btn btn-xs" onClick={refreshTree}>Refresh</button>
              </div>
            </div>
            <div className="p-2 h-56 overflow-auto text-xs">
              {fileTree.length === 0 ? (
                <div className="text-gray-500 text-sm">No files</div>
              ) : (
                <ul className="space-y-1">
                  {fileTree.map((f)=> (
                    <li key={f.path} className="flex items-center justify-between">
                      <button className="link" onClick={()=>openFile(f.path)}>{f.path}</button>
                      <span className="text-gray-400">{f.size}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedFile && (
              <div className="border-t mt-2">
                <div className="px-2 py-1 text-xs text-gray-600">{selectedFile}</div>
                <textarea value={selectedContent} readOnly className="textarea textarea-bordered w-full h-40 font-mono text-xs" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
