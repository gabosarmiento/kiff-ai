"use client";
import React from "react";
import { apiJson, apiFetch } from "@/lib/api";
import { listKBs } from "@/lib/api";

function normalizeModelIds(input: any): string[] {
  if (!input) return [];
  // Case 1: wrapped { models: [...] }
  const arr = Array.isArray(input) ? input : (Array.isArray((input as any).models) ? (input as any).models : []);
  return arr
    .map((m: any) => (typeof m === "string" ? m : (m && (m.id || (m as any).name)) || null))
    .filter(Boolean);
}

export type KiffComposePanelProps = {
  selectedKB?: string;
  availableKBs?: string[];
  availableTools?: string[];
  availableMCPs?: string[];
  models?: string[];
  onSubmit?: (payload: {
    kb: string | null;
    prompt: string;
    tools: string[];
    mcps: string[];
    model: string;
  }) => void;
};

export const KiffComposePanel: React.FC<KiffComposePanelProps> = ({
  selectedKB,
  availableKBs = ["Marketing Docs", "OpenAI API", "Stripe API"],
  availableTools = [],
  availableMCPs = [],
  models = ["kimi-k2", "gpt-oss-120b", "gpt-oss-20b"],
  onSubmit,
}) => {
  // Core state
  // KBs fetched from backend (id + name). We store the selected value as the KB ID.
  const [kbs, setKbs] = React.useState<Array<{ id: string; name: string; vectors?: number }>>([]);
  const [kb, setKb] = React.useState<string | null>(selectedKB || null);
  const [prompt, setPrompt] = React.useState(
    "Build a landing page with a pricing section and contact form"
  );
  const [tools, setTools] = React.useState<string[]>([]);
  const [mcps, setMcps] = React.useState<string[]>([]);
  const [model, setModel] = React.useState<string>(models[0] || "kimi-k2");
  const [ragOpen, setRagOpen] = React.useState<boolean>(true);
  const [hoverDoc, setHoverDoc] = React.useState<string | null>(null);

  // Dynamic data from backend
  const [modelOptions, setModelOptions] = React.useState<string[]>(models);
  const [toolOptions, setToolOptions] = React.useState<string[]>(availableTools);
  const [mcpOptions, setMcpOptions] = React.useState<string[]>(availableMCPs);

  // Compose/session state
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [spaceId, setSpaceId] = React.useState<string | null>(null);
  const [chunksIndexed, setChunksIndexed] = React.useState<number>(0);

  // Output & context
  const [streaming, setStreaming] = React.useState<boolean>(true);
  const [output, setOutput] = React.useState<string>("");
  const [usedContext, setUsedContext] = React.useState<
    Array<{ space_id: string; chunk_id: string; summary: string }>
  >([]);

  // UI state
  const [loading, setLoading] = React.useState<boolean>(false);
  const [creating, setCreating] = React.useState<boolean>(false);
  const [attaching, setAttaching] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedKiffId, setSavedKiffId] = React.useState<string | null>(null);

  async function saveKiffAuto(finalContent?: string) {
    if (savedKiffId) return; // prevent duplicate saves
    try {
      const name = (prompt || "Untitled Kiff").slice(0, 60);
      const body: any = {
        name,
        model: model,
        session_id: sessionId,
        tool_ids: tools,
        mcp_ids: mcps,
        kb: kb,
        content_preview: (finalContent || "").slice(0, 2000),
      };
      const resp = await apiJson<{ id: string }>("/api/kiffs", { method: "POST", body });
      if (resp?.id) setSavedKiffId(resp.id);
    } catch (e) {
      // Non-fatal; keep composer usable even if save fails
      console.warn("Auto-save Kiff failed", e);
    }
  }

  // Initial load of models and tools - parallel requests for better performance
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      
      // Load all data in parallel for better performance
      const promises = [
        // Load models
        apiJson<any>("/api/models", { method: "GET" }).catch(e => ({ error: e?.message || "Failed to load models" })),
        // Load tools and mcps
        apiJson<{
          tools: Array<{ id: string }> | string[];
          mcps: Array<{ id: string }> | string[];
        }>("/api/compose/tools", { method: "GET" }).catch(e => ({ error: e?.message || "Failed to load tools" })),
        // Load knowledge bases
        listKBs().catch(e => ({ error: e?.message || "Failed to load KBs" }))
      ];

      const [modelsRes, toolsRes, kbList] = await Promise.all(promises);

      if (cancelled) return;

      // Process models
      if (modelsRes && !modelsRes.error) {
        const ids = normalizeModelIds(modelsRes);
        if (ids.length) {
          setModelOptions(ids);
          if (!ids.includes(model)) setModel(ids[0]);
        }
      } else if (modelsRes?.error) {
        setError(modelsRes.error);
      }

      // Process tools and mcps
      if (toolsRes && !toolsRes.error) {
        const toolIds = Array.isArray(toolsRes.tools)
          ? (toolsRes.tools as any[]).map((t: any) => (typeof t === "string" ? t : t.id))
          : [];
        const mcpIds = Array.isArray(toolsRes.mcps)
          ? (toolsRes.mcps as any[]).map((t: any) => (typeof t === "string" ? t : t.id))
          : [];
        if (toolIds.length) setToolOptions(toolIds);
        if (mcpIds.length) setMcpOptions(mcpIds);
      }

      // Process knowledge bases
      if (kbList && !kbList.error && Array.isArray(kbList)) {
        setKbs(kbList);
        if (!kb && kbList.length) setKb(kbList[0].id);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (arr: string[], setArr: (s: string[]) => void, v: string) => {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  // Availability flags to avoid confusion when backend isn't configured yet
  const hasTools = (toolOptions && toolOptions.length > 0);
  const hasMCPs = (mcpOptions && mcpOptions.length > 0);
  // Feature flag to optionally show Tools/MCPs UI. Defaults to hidden.
  const showToolsUI = (process.env.NEXT_PUBLIC_COMPOSE_SHOW_TOOLS === "1");

  async function createSession(): Promise<string | null> {
    setCreating(true);
    setError(null);
    try {
      const body = {
        model_id: model || "kimi-k2",
        tool_ids: tools,
        mcp_ids: mcps,
        knowledge_space_ids: kb ? [kb] : [],
        system_preamble: null,
      };
      const res = await apiJson<{
        session_id: string;
        agent_status: string;
        resolved_model_id?: string;
      }>("/api/compose/session", { method: "POST", body: body as any });
      setSessionId(res.session_id);
      if (res.resolved_model_id) setModel(res.resolved_model_id);
      return res.session_id;
    } catch (e: any) {
      setError(e?.message || "Failed to create session");
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function handleAttach(files: FileList | null) {
    if (!files || files.length === 0 || !sessionId) return;
    setAttaching(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("session_id", sessionId);
      if (spaceId) fd.append("space_id", spaceId);
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await apiFetch("/api/compose/attach", {
        method: "POST",
        asJson: false,
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { space_id: string; chunks_indexed: number };
      setSpaceId(data.space_id);
      setChunksIndexed((prev) => prev + (data.chunks_indexed || 0));
    } catch (e: any) {
      setError(e?.message || "Failed to attach knowledge");
    } finally {
      setAttaching(false);
    }
  }

  async function fetchUsedContext(id: string) {
    try {
      const ctx = await apiJson<{
        session_id: string;
        used: Array<{ space_id: string; chunk_id: string; summary: string }>;
      }>(`/api/compose/context?session_id=${encodeURIComponent(id)}`, { method: "GET" });
      setUsedContext(ctx.used || []);
    } catch {
      // ignore
    }
  }

  async function sendNonStream() {
    setLoading(true);
    setError(null);
    try {
      let id = sessionId;
      if (!id) {
        id = await createSession();
        if (!id) throw new Error("Failed to create session");
      }
      const body = {
        session_id: id,
        prompt,
        model_id: model,
        tool_ids: tools,
        mcp_ids: mcps,
        knowledge_space_ids: kb ? [kb] : [],
        options: { stream: false },
      };
      const res = await apiJson<{ message_id: string; content: string }>(
        "/api/compose/message",
        { method: "POST", body: body as any }
      );
      const text = res.content || "";
      setOutput(text);
      await saveKiffAuto(text);
      await fetchUsedContext(id);
    } catch (e: any) {
      setError(e?.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  async function sendStream() {
    setLoading(true);
    setError(null);
    setOutput("");
    try {
      let id = sessionId;
      if (!id) {
        id = await createSession();
        if (!id) throw new Error("Failed to create session");
      }
      const url = `/api/compose/stream?session_id=${encodeURIComponent(
        id
      )}&prompt=${encodeURIComponent(prompt)}`;
      const res = await apiFetch(url, {
        method: "GET",
        asJson: false,
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const chunk of text.split("\n\n")) {
          if (!chunk.startsWith("data: ")) continue;
          const payload = chunk.slice(6);
          if (payload === "[DONE]") {
            await fetchUsedContext(id);
            await saveKiffAuto(output);
            setLoading(false);
            return;
          }
          setOutput((prev) => prev + payload);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Streaming error");
    } finally {
      setLoading(false);
    }
  }

  async function syncGroqModels() {
    try {
      await apiJson("/api/models/sync/groq", { method: "POST" });
      // reload models
      const modelsRes = await apiJson<any>(
        "/api/models",
        { method: "GET" }
      );
      const ids = normalizeModelIds(modelsRes);
      if (ids.length) setModelOptions(ids);
    } catch (e: any) {
      setError(e?.message || "Failed to sync models");
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Local styles for animated border */}
      <style>{`
        @keyframes kiff-dash { 
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -600; }
        }
        .kiff-rag-stroke { stroke-linecap: round; stroke-linejoin: round; animation: kiff-dash 1.4s linear infinite; stroke-dasharray: 40 560; stroke-dashoffset: 0; }
        .kiff-rag-stroke--trail { opacity: .45; filter: url(#kiffGlow); stroke-width: 3; }
        .kiff-rag-stroke--main { opacity: 1; stroke-width: 2; }
        .kiff-rag-capsule { position: relative; z-index: 0; }
        @media (prefers-reduced-motion: reduce) { .kiff-rag-stroke { animation: none; } }
      `}</style>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-50 blur-xl"
          style={{
            background:
              "radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)",
          }}
        />

        <h2 className="text-lg font-semibold text-slate-900">Compose your Kiff</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick knowledge, model, and tools. Then provide your instruction.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <div className="font-medium">Error</div>
            <div className="opacity-90">{error}</div>
          </div>
        )}
        {savedKiffId && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <div className="font-medium">Kiff saved</div>
            <div className="opacity-90">
              <a className="underline" href={`/kiffs/${savedKiffId}`}>Open saved Kiff</a>
              <span className="mx-2 opacity-50">•</span>
              <a className="underline" href="/kiffs">View all Kiffs</a>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs text-slate-600">Knowledge Base</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {kbs.map((space) => (
              <button
                key={space.id}
                onClick={() => setKb(space.id)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs",
                  kb === space.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
                title={space.id}
              >
                {space.name}
              </button>
            ))}
            <a href="/kb" className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600">
              + New
            </a>
          </div>
          {kb && (
            <div className="mt-2 text-xs text-slate-600">
              Attached: {kbs.find((x) => x.id === kb)?.name || kb} (Vectors: {kbs.find((x) => x.id === kb)?.vectors ?? 0})
            </div>
          )}
        </div>

        {showToolsUI && (hasTools || hasMCPs) && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {hasTools && (
              <div>
                <label className="block text-xs text-slate-600">Tools</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {toolOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggle(tools, setTools, t)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs",
                        tools.includes(t)
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hasMCPs && (
              <div>
                <label className="block text-xs text-slate-600">MCPs</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {mcpOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggle(mcps, setMcps, t)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs",
                        mcps.includes(t)
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs text-slate-600">Prompt</label>
          <div className="mt-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {/* RAG Capsule attached to input */}
            <div className="kiff-rag-capsule relative mb-3 overflow-hidden rounded-xl border border-transparent bg-amber-50/70 px-3 py-2 text-[13px] text-amber-900">
              {/* Animated SVG stroke around border */}
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10"
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <filter id="kiffGlow" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur stdDeviation="1.2" result="blur" />
                  </filter>
                </defs>
                {/* Soft glow trail */}
                <rect
                  x="1.25"
                  y="1.25"
                  width="97.5"
                  height="97.5"
                  rx="12"
                  ry="12"
                  pathLength="600"
                  fill="none"
                  stroke="#38bdf8"
                  className="kiff-rag-stroke kiff-rag-stroke--trail"
                  strokeDasharray="40 560"
                  strokeDashoffset="0"
                  filter="url(#kiffGlow)"
                />
                {/* Main moving segment */}
                <rect
                  x="1.25"
                  y="1.25"
                  width="97.5"
                  height="97.5"
                  rx="12"
                  ry="12"
                  pathLength="600"
                  fill="none"
                  stroke="#38bdf8"
                  className="kiff-rag-stroke kiff-rag-stroke--main"
                  strokeDasharray="40 560"
                  strokeDashoffset="0"
                />
              </svg>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-900">
                    R
                  </span>
                  <span className="font-medium">Supercharged by Knowledge</span>
                  <span className="text-amber-800/80">{kb ? kb : "No KB selected"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-full border border-amber-200 bg-white px-2 py-1 text-xs text-amber-900"
                    value={kb ?? ""}
                    onChange={(e) => setKb(e.target.value)}
                  >
                    <option value="" disabled>
                      Select KB…
                    </option>
                    {availableKBs.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setRagOpen((v) => !v)}
                    className="rounded-full px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
                  >
                    {ragOpen ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {ragOpen && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-amber-800/90">Context:</span>
                  {usedContext.length === 0 && (
                    <span className="text-amber-800/80">
                      No context yet. Send a message to populate.
                    </span>
                  )}
                  {usedContext.map((u) => (
                    <span
                      key={`${u.space_id}:${u.chunk_id}`}
                      onMouseEnter={() => setHoverDoc(u.chunk_id)}
                      onMouseLeave={() => setHoverDoc(null)}
                      className="relative cursor-default rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[12px] text-amber-900"
                    >
                      {u.chunk_id}
                      {hoverDoc === u.chunk_id && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded-lg border border-amber-200 bg-white p-2 text-[12px] text-amber-900 shadow-md">
                          <div className="font-medium">Summary</div>
                          <div className="opacity-90">{u.summary}</div>
                        </div>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <textarea
              className="block h-28 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Describe what to build"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Model</label>
                <select
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  onClick={syncGroqModels}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                >
                  Sync Groq
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Stream</label>
                <input
                  type="checkbox"
                  checked={streaming}
                  onChange={(e) => setStreaming(e.target.checked)}
                />
                <button
                  disabled={loading || creating}
                  onClick={async () => {
                    if (!sessionId) {
                      const newSessionId = await createSession();
                      setSessionId(newSessionId);
                    }
                    streaming ? sendStream() : sendNonStream();
                  }}
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Session: {sessionId ? sessionId : "(none)"} • KB: {kb ?? "(none)"} • Indexed: {chunksIndexed}
              </div>
              <label className="cursor-pointer text-xs text-slate-700">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttach(e.target.files)}
                  disabled={!sessionId || attaching}
                />
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">
                  {attaching ? "Attaching…" : "Attach Knowledge"}
                </span>
              </label>
            </div>

            {output && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                <div className="text-xs font-semibold text-slate-700">Output</div>
                <pre className="whitespace-pre-wrap text-[13px] text-slate-800">{output}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiffComposePanel;
