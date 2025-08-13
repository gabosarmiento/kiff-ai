"use client";
import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";
import { KiffComposePanel } from "@/components/kiffs/KiffComposePanel";
import { SandboxPreview } from "@/components/compose/SandboxPreview";
import { BuildProgress, type BuildEvent } from "@/components/compose/BuildProgress";
import { ManagementSidebar } from "@/components/compose/ManagementSidebar";
import { PreviewPanel } from "@/components/compose/PreviewPanel";
import { ExplorerTree, type TreeFile } from "@/components/compose/ExplorerTree";
import { ConsoleDock } from "@/components/compose/ConsoleDock";
import { useComposeUi } from "@/components/compose/composeUiStore";
import {
  createPreviewSandboxRuntime,
  streamApplyFiles,
  restartDevServer,
  fetchPreviewLogs,
  fetchFileTree,
  fetchFileContent,
  streamExecCommand,
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
  
  // Chat and AGNO state
  const [chatMessages, setChatMessages] = React.useState<Array<{
    id: string;
    content: string;
    type: 'user' | 'assistant' | 'system' | 'reasoning';
    timestamp: Date;
    reasoning?: {
      steps: string[];
      duration?: number;
      isComplete: boolean;
    };
  }>>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [currentReasoning, setCurrentReasoning] = React.useState<{
    steps: string[];
    isActive: boolean;
    startTime?: Date;
  }>({ steps: [], isActive: false });
  
  // Files and preview state
  const [fileTree, setFileTree] = React.useState<TreeFile[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [fileContent, setFileContent] = React.useState<string>('');
  
  // Minimal orchestration state (right column)
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("unavailable");
  const [events, setEvents] = React.useState<BuildEvent[]>([]);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [logs, setLogs] = React.useState<string>("");
  const [consoleLogs, setConsoleLogs] = React.useState<string>("");
  const [kiffName, setKiffName] = React.useState<string | undefined>(undefined);
  const [editOpenState, setEditOpenState] = React.useState<boolean>(false);

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

  const { phase, setPhase, setSession, setTab } = useComposeUi();

  // Lock body scroll when canvas viewport is active
  React.useEffect(() => {
    if (phase !== 'idle') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [phase]);

  async function refreshTreeAndPreview(sid: string) {
    try {
      const t = await fetchFileTree(sid);
      setTree(t.files || []);
      // Auto open first file if exists
      const first = t.files?.[0]?.path;
      if (first) await openFile(sid, first);
    } catch {}
  }

  async function openFile(sid: string, path: string) {
    try {
      setSelectedPath(path);
      const f = await fetchFileContent(sid, path);
      setFileContent(f.content || "");
    } catch {}
  }

  async function handleOutput(content: string) {
    try {
      setBusy(true);
      setEvents([]);
      setPhase('generating');
      // 1) Create or attach sandbox (default vite runtime for quick preview)
      const resp = await createPreviewSandboxRuntime({ runtime: "vite", port: 5173, session_id: sessionId || undefined });
      setStatus(resp.status);
      setPreviewUrl(resp.preview_url || null);
      if (!sessionId) { setSessionId(resp.session_id); setSession(resp.session_id); }

      const sid = sessionId || resp.session_id;
      // 2) Extract files from output and apply
      const files = parseFilesFromOutput(content);
      if (files.length) {
        await streamApplyFiles(sid, files, pushEvent);
      }
      // 3) Restart
      await restartDevServer(sid);
      setPhase('built');
      setTab('run');
      // 4) Fetch logs once
      try {
        const r = await fetchPreviewLogs(sid);
        const text = (r.logs || []).map((x: any) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");
        setLogs(text);
      } catch {}
      // 5) Fetch file tree for Code tab
      await refreshTreeAndPreview(sid);
    } catch (e) {
      setEvents((prev) => [...prev, { type: "error", message: (e as any)?.message || String(e) }]);
      setPhase('error');
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

  // File explorer state (legacy - keeping for compatibility)
  const [tree, setTree] = React.useState<TreeFile[]>([]);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);

  // Console execution function
  const execConsole = React.useCallback(async (cmd: string) => {
    if (!sessionId) return;
    setConsoleLogs((prev) => prev + (prev ? "\n" : "") + `> ${cmd}`);
    try {
      await streamExecCommand(sessionId, cmd, (e) => {
        const line = typeof e === 'string' ? e : (e.line || e.message || JSON.stringify(e));
        setConsoleLogs((prev) => prev + "\n" + (line || ''));
      });
    } catch (err: any) {
      setConsoleLogs((prev) => prev + "\n" + `Error: ${err?.message || String(err)}`);
    }
  }, [sessionId]);

  return (
    <div className="app-shell">
      <Navbar kiffName={kiffName} />
      <Sidebar />
      <main
        className="pane pane-with-sidebar"
        style={{ 
          padding: phase === 'idle' ? "16px" : "0", 
          maxWidth: phase === 'idle' ? "1400px" : "none", 
          paddingLeft: phase === 'idle' ? leftWidth + 24 : 0, 
          margin: phase === 'idle' ? "0 auto" : "0", 
          overflowX: "hidden", 
          paddingBottom: phase === 'idle' ? 96 : 0,
          height: phase === 'idle' ? "auto" : "100vh",
          overflow: phase === 'idle' ? "visible" : "hidden"
        }}
      >

        {/* Initial state: show ONLY the composer centered. After Send: show tabbed panel. */}
        {phase === 'idle' ? (
          <div className="w-full flex justify-center">
            <div className="w-full" style={{ maxWidth: 860 }}>
              <KiffComposePanel
                onOutput={handleOutput}
                selectedAPIs={bag}
                bagLoading={bagLoading}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex">
            {/* Left Column - Chat */}
            <div className="flex-1 flex flex-col bg-white border-r border-gray-200">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
                <p className="text-sm text-gray-600">Conversational AI Development</p>
              </div>
              
              {/* Chat Messages - Scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Start a conversation...</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.type === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : message.type === 'reasoning'
                          ? 'bg-purple-50 border border-purple-200 text-purple-800'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        {message.type === 'reasoning' && (
                          <div className="text-xs font-medium text-purple-600 mb-1">
                            💭 Thought for {message.reasoning?.duration || 0}s
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        {message.reasoning && !message.reasoning.isComplete && (
                          <div className="mt-2 space-y-1">
                            {message.reasoning.steps.map((step, idx) => (
                              <div key={idx} className="text-xs text-purple-700 bg-purple-100 rounded px-2 py-1">
                                {step}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                {/* Active Reasoning Display */}
                {currentReasoning.isActive && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-purple-50 border border-purple-200">
                      <div className="flex items-center gap-2 text-purple-600 text-sm font-medium mb-2">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                        AI is thinking...
                      </div>
                      <div className="space-y-1">
                        {currentReasoning.steps.map((step, idx) => (
                          <div key={idx} className="text-xs text-purple-700 bg-purple-100 rounded px-2 py-1">
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {isGenerating && !currentReasoning.isActive && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        Generating...
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Chat Input */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          handleOutput(input.value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button 
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        handleOutput(input.value);
                        input.value = '';
                      }
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Files and Preview */}
            <div className="flex-1 flex flex-col bg-gray-50">
              {/* Files and Preview Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Files & Preview</h2>
                    <p className="text-sm text-gray-600 mt-1">Python Sandbox Environment</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      status === 'running' ? 'bg-green-100 text-green-800' :
                      status === 'starting' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex min-h-0">
                {/* File Explorer */}
                <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-medium text-gray-700">Project Files</h3>
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    <ExplorerTree
                      files={fileTree}
                      selected={selectedFile}
                      onSelect={(path: string) => {
                        setSelectedFile(path);
                        // Fetch file content when selected
                        if (sessionId) {
                          fetchFileContent(sessionId, path).then((result) => {
                            setFileContent(result.content);
                          }).catch((err: any) => {
                            console.error('Failed to fetch file content:', err);
                            setFileContent('Error loading file content');
                          });
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* Code Viewer and Preview */}
                <div className="flex-1 flex flex-col">
                  {selectedFile ? (
                    <div className="flex-1 flex flex-col">
                      {/* File Header */}
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-700">{selectedFile}</span>
                          </div>
                          <button 
                            onClick={() => setSelectedFile(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      
                      {/* File Content */}
                      <div className="flex-1 overflow-auto bg-gray-900">
                        <pre className="text-sm text-green-400 font-mono p-4 h-full">
                          <code>{fileContent || 'Loading...'}</code>
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col">
                      {/* Preview Area */}
                      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-sm font-medium text-gray-700">Python Output</h3>
                      </div>
                      
                      <div className="flex-1 bg-black text-green-400 font-mono text-sm p-4 overflow-auto">
                        {events.length > 0 ? (
                          <div className="space-y-1">
                            {events.map((event, idx) => (
                              <div key={idx} className="whitespace-pre-wrap">
                                {typeof event === 'string' ? event : JSON.stringify(event, null, 2)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic">
                            No output yet. Run your Python code to see results here.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
      {/* D. Console Dock (only after starting process) */}
      {phase !== 'idle' && (
        <ConsoleDock onExec={execConsole} logs={consoleLogs} />
      )}
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
