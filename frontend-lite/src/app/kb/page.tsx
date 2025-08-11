"use client";
import React from "react";
import { Navbar } from "../../components/layout/Navbar";
import { Sidebar } from "../../components/navigation/Sidebar";
import { BottomNav } from "../../components/navigation/BottomNav";
import { useLayoutState } from "../../components/layout/LayoutState";
import { createKB, listKBs } from "../../lib/api";

type KB = { id: string; name: string; created_at?: number; vectors?: number };
type Source = { type: "api" | "url"; value: string };

export default function KBPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  // KB state
  const [kbs, setKbs] = React.useState<KB[]>([]);
  const [selectedKbId, setSelectedKbId] = React.useState<string | null>(null);
  const [kbName, setKbName] = React.useState<string>("");
  const [retrievalMode, setRetrievalMode] =
    React.useState<"agentic-search" | "agentic-rag">("agentic-search");
  const [creating, setCreating] = React.useState(false);

  // Creator UI state
  const [selectedApi, setSelectedApi] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [urlInput, setUrlInput] = React.useState("");
  const [creatorMode, setCreatorMode] =
    React.useState<"agentic_search" | "agentic_rag">("agentic_search");

  const refreshKBs = async () => {
    try {
      const list = await listKBs();
      setKbs(list);
      if (!selectedKbId && list.length) setSelectedKbId(list[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  function handleLoadUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setSources((prev) => [{ type: "url", value: url }, ...prev]);
    setUrlInput("");
  }

  React.useEffect(() => {
    (async () => {
      try {
        const list = await listKBs();
        setKbs(list);
        if (!selectedKbId && list.length) setSelectedKbId(list[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreateKB() {
    if (!kbName.trim()) return;
    const mappedMode: "agentic-search" | "agentic-rag" =
      creatorMode === "agentic_search" ? "agentic-search" : "agentic-rag";

    setCreating(true);
    try {
      const kb = await createKB({
        name: kbName.trim(),
        retrieval_mode: mappedMode,
        vector_store: "lancedb",
        embedder: "sentence-transformers",
      });
      setKbName("");
      await refreshKBs();
      setSelectedKbId(kb.id);
      setRetrievalMode(mappedMode);
    } catch (e: any) {
      alert(e?.message || "Failed to create KB");
    } finally {
      setCreating(false);
    }
  }

  const mainStyle: React.CSSProperties = {
    maxWidth: 1200,
    paddingLeft: leftWidth + 24,
    margin: "0 auto",
  };

  const page = (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main 
        className="pane pane-with-sidebar px-4"
        style={mainStyle}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="m-0 text-xl font-semibold">Knowledge Base</h1>
            <p className="label mt-2">Create and manage your Knowledge Bases.</p>
          </div>
          {/* Tenant pill hidden */}
        </div>

        {/* Create KB - Simplified two-column creator */}
        <div className="card bg-base-100 shadow-md mt-4">
          <div className="card-body grid gap-5 md:grid-cols-[1fr_420px]">
            {/* Left column */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="pill rounded-lg px-2 py-1">KB</div>
                <div>
                  <div className="font-semibold">Create Knowledge Base</div>
                  <div className="muted text-xs">
                    Choose a source and retrieval strategy. You can add more later.
                  </div>
                </div>
              </div>

              <label className="label">Knowledge Base Name</label>
              <input
                className="input input-bordered input-lg w-full"
                placeholder="e.g. Marketing Docs"
                value={kbName}
                onChange={(e) => setKbName(e.target.value)}
              />

              <div>
                <label className="label">Select API</label>
                <div className="rounded-xl border-2 border-dashed border-base-300 p-3">
                  <select
                    className="select select-bordered w-full"
                    value={selectedApi ?? ""}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setSelectedApi(val);
                      setSources((prev) => {
                        const rest = prev.filter((s) => s.type !== "api");
                        return val ? [{ type: "api", value: val }, ...rest] : rest;
                      });
                    }}
                  >
                    <option value="">Choose API</option>
                    <option value="agno">Agno</option>
                    <option value="openai">OpenAI</option>
                    <option value="stripe">Stripe</option>
                    <option value="slack">Slack</option>
                    <option value="github">GitHub</option>
                  </select>

                  <div className="mt-2 space-y-2">
                    <div className="label text-xs">Add URL</div>
                    <div className="text-xs text-base-content/60">
                      Paste a URL to add as a source. We’ll fetch and index its content.
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="input input-bordered w-full"
                        placeholder="https://example.com/docs"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLoadUrl();
                          }
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          handleLoadUrl();
                        }}
                      >
                        Add URL
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="label text-xs">Selected sources</div>
                  {sources.length === 0 ? (
                    <div className="muted text-xs">No sources yet.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sources.map((s, i) => (
                        <span key={i} className="badge badge-outline gap-2 py-3">
                          <span className="muted uppercase text-[10px] tracking-wide">
                            {s.type}
                          </span>
                          <span title={s.value} className="max-w-[320px] truncate">
                            {s.value}
                          </span>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              setSources((prev) => prev.filter((_, idx) => idx !== i))
                            }
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="font-semibold mb-1">Retrieval Mode</div>
                <div className="grid gap-2">
                  <button
                    type="button"
                    role="button"
                    aria-pressed={creatorMode === "agentic_search"}
                    onClick={() => setCreatorMode("agentic_search")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setCreatorMode("agentic_search");
                      }
                    }}
                    className={`card ${
                      creatorMode === "agentic_search"
                        ? "ring-2 ring-primary"
                        : "hover:shadow-md"
                    } transition-shadow p-4 min-h-24 relative text-left cursor-pointer select-none`}
                  >
                    {creatorMode === "agentic_search" && (
                      <span className="absolute top-1.5 right-1.5 inline-flex h-9 w-9 rounded-full bg-base-100 shadow items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width={24}
                          height={24}
                          fill="#2563eb"
                          aria-hidden="true"
                        >
                          <path d="M20.285 6.709a1 1 0 010 1.414l-9.193 9.193a1 1 0 01-1.414 0L3.715 11.357a1 1 0 111.414-1.414l5.143 5.143 8.486-8.486a1 1 0 011.527.109z" />
                        </svg>
                      </span>
                    )}
                    <div className="font-semibold text-sm">Agentic Search</div>
                    <div className="muted text-xs">
                      Search-first strategy with lightweight context building.
                    </div>
                  </button>

                  <button
                    type="button"
                    role="button"
                    aria-pressed={creatorMode === "agentic_rag"}
                    className={`card ${
                      creatorMode === "agentic_rag"
                        ? "ring-2 ring-primary"
                        : "hover:shadow-md"
                    } transition-shadow p-4 min-h-24 relative`}
                    onClick={() => setCreatorMode("agentic_rag")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setCreatorMode("agentic_rag");
                      }
                    }}
                  >
                    {creatorMode === "agentic_rag" && (
                      <span className="absolute top-1.5 right-1.5 inline-flex h-9 w-9 rounded-full bg-base-100 shadow items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width={24}
                          height={24}
                          fill="#2563eb"
                          aria-hidden="true"
                        >
                          <path d="M20.285 6.709a1 1 0 010 1.414l-9.193 9.193a1 1 0 01-1.414 0L3.715 11.357a1 1 0 111.414-1.414l5.143 5.143 8.486-8.486a1 1 0 011.527.109z" />
                        </svg>
                      </span>
                    )}
                    <div className="font-semibold text-sm">Agentic RAG</div>
                    <div className="muted text-xs">
                      Retrieval-augmented generation with smarter runs.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1">Vector Database</div>
                <div className="card bg-base-100 shadow-sm">
                  <div className="card-body p-3">
                    <div className="flex items-center gap-2">
                      <div className="badge badge-outline">DB</div>
                      <div>LanceDB (fixed)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-1 flex justify-end">
                <button
                  className="btn btn-primary"
                  onClick={onCreateKB}
                  disabled={creating || !kbName.trim()}
                >
                  {creating ? "Creating…" : "Create Knowledge Base"}
                </button>
              </div>
            </div>
          </div>
        </div>


      </main>
      <BottomNav />
    </div>
  );

  return page;
}
