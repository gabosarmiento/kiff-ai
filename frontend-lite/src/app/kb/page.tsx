"use client";
import React from "react";
import { Navbar } from "../../components/layout/Navbar";
import { Sidebar } from "../../components/navigation/Sidebar";
import { useLayoutState } from "../../components/layout/LayoutState";
import { createKB, listKBs } from "../../lib/api";

type KB = { id: string; name: string; created_at?: number; vectors?: number };
// Removed extractor preview types

export default function KBPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  // KB state
  const [kbs, setKbs] = React.useState<KB[]>([]);
  const [selectedKbId, setSelectedKbId] = React.useState<string | null>(null);
  const [kbName, setKbName] = React.useState<string>("");
  const [retrievalMode, setRetrievalMode] = React.useState<"agentic-search" | "agentic-rag">("agentic-search");
  const [creating, setCreating] = React.useState(false);
  // New simplified creator UI state
  type Source = { type: 'api' | 'url'; value: string };
  const [selectedApi, setSelectedApi] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [urlModalOpen, setUrlModalOpen] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState("");
  // Card selection mode (snake_case) for UI; map to backend on create
  const [creatorMode, setCreatorMode] = React.useState<'agentic_search' | 'agentic_rag'>('agentic_search');

  // Ingest and indexing panels removed

  // Extractor removed

  const refreshKBs = async () => {
    try {
      const list = await listKBs();
      setKbs(list);
      if (!selectedKbId && list.length) setSelectedKbId(list[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  // onIngest/onIndex removed
  

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
    // map creatorMode to backend expected dash-case
    const mappedMode: "agentic-search" | "agentic-rag" = creatorMode === 'agentic_search' ? 'agentic-search' : 'agentic-rag';
    setCreating(true);
    try {
      const kb = await createKB({ name: kbName.trim(), retrieval_mode: mappedMode, vector_store: 'lancedb', embedder: 'sentence-transformers' });
      setKbName("");
      await refreshKBs();
      setSelectedKbId(kb.id);
      // Keep retrievalMode state in sync for rest of page
      setRetrievalMode(mappedMode);
    } catch (e: any) {
      alert(e?.message || "Failed to create KB");
    } finally {
      setCreating(false);
    }
  }

  // Handlers for extractor removed
  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane" style={{ padding: 16, maxWidth: 1200, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>Knowledge Base</h1>
              <p className="label" style={{ marginTop: 8 }}>Create and manage your Knowledge Bases.</p>
            </div>
            {/* Tenant pill hidden */}
          </div>

          {/* Create KB - Simplified two-column creator */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>
              {/* Left column */}
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="pill" style={{ borderRadius: 8, padding: '6px 8px' }}>KB</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Create Knowledge Base</div>
                    <div className="muted" style={{ fontSize: 12 }}>Choose a source and retrieval strategy. You can add more later.</div>
                  </div>
                </div>
                <label className="label">Knowledge Base Name</label>
                <input className="input" placeholder="e.g. Marketing Docs" value={kbName} onChange={(e) => setKbName(e.target.value)} />

                <div>
                  <label className="label">Select API</label>
                  <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: 12 }}>
                    <select className="input" value={selectedApi ?? ''} onChange={e => {
                      const val = e.target.value || null;
                      setSelectedApi(val);
                      setSources(prev => {
                        const rest = prev.filter(s => s.type !== 'api');
                        return val ? [{ type: 'api', value: val }, ...rest] : rest;
                      });
                    }}>
                      <option value="">Choose API</option>
                      <option value="agno">Agno</option>
                      <option value="openai">OpenAI</option>
                      <option value="stripe">Stripe</option>
                      <option value="slack">Slack</option>
                      <option value="github">GitHub</option>
                    </select>
                    <div style={{ marginTop: 8 }}>
                      <button className="button-outline" onClick={() => setUrlModalOpen(true)}>+ Add from URL</button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="label" style={{ fontSize: 12 }}>Selected sources</div>
                      {sources.length === 0 ? (
                        <div className="muted" style={{ fontSize: 12 }}>No sources yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {sources.map((s, i) => (
                            <span key={i} className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span className="muted" style={{ textTransform: 'uppercase', fontSize: 10 }}>{s.type}</span>
                              <span title={s.value} style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</span>
                              <button className="button-ghost" onClick={() => setSources(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Right column */}
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Retrieval Mode</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <button
                      type="button"
                      role="button"
                      aria-pressed={creatorMode === 'agentic_search'}
                      className={["card", creatorMode === 'agentic_search' ? 'selected' : ''].join(' ')}
                      onClick={() => setCreatorMode('agentic_search')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreatorMode('agentic_search'); } }}
                      style={{ padding: 14, textAlign: 'left', minHeight: 96, cursor: 'pointer', userSelect: 'none', pointerEvents: 'auto', position: 'relative' }}
                    >
                      {creatorMode === 'agentic_search' && (
                        <span style={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex', height: 36, width: 36, borderRadius: 9999, background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                          <svg viewBox="0 0 24 24" width={24} height={24} fill="#2563eb" aria-hidden="true"><path d="M20.285 6.709a1 1 0 010 1.414l-9.193 9.193a1 1 0 01-1.414 0L3.715 11.357a1 1 0 111.414-1.414l5.143 5.143 8.486-8.486a1 1 0 011.527.109z"/></svg>
                        </span>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Agentic Search</div>
                      <div className="muted" style={{ fontSize: 12 }}>Search-first strategy with lightweight context building.</div>
                    </button>
                    <button
                      type="button"
                      role="button"
                      aria-pressed={creatorMode === 'agentic_rag'}
                      className={["card", creatorMode === 'agentic_rag' ? 'selected' : ''].join(' ')}
                      onClick={() => setCreatorMode('agentic_rag')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreatorMode('agentic_rag'); } }}
                      style={{ padding: 14, textAlign: 'left', minHeight: 96, cursor: 'pointer', userSelect: 'none', pointerEvents: 'auto', position: 'relative' }}
                    >
                      {creatorMode === 'agentic_rag' && (
                        <span style={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex', height: 36, width: 36, borderRadius: 9999, background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                          <svg viewBox="0 0 24 24" width={24} height={24} fill="#2563eb" aria-hidden="true"><path d="M20.285 6.709a1 1 0 010 1.414l-9.193 9.193a1 1 0 01-1.414 0L3.715 11.357a1 1 0 111.414-1.414l5.143 5.143 8.486-8.486a1 1 0 011.527.109z"/></svg>
                        </span>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Agentic RAG</div>
                      <div className="muted" style={{ fontSize: 12 }}>Retrieval-augmented generation with smarter runs.</div>
                    </button>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Vector Database</div>
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="pill" style={{ borderRadius: 6 }}>DB</div>
                      <div>LanceDB (fixed)</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="button" onClick={onCreateKB} disabled={creating || !kbName.trim()}>{creating ? 'Creating…' : 'Create Knowledge Base'}</button>
                </div>
              </div>
            </div>
          </div>

          {/* URL Modal */}
          {urlModalOpen && (
            <div className="modal-backdrop" onClick={() => setUrlModalOpen(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '90vw', padding: 16 }}>
                <div className="modal-header" style={{ marginBottom: 8 }}><strong>Add from URL</strong></div>
                <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
                  <input
                    className="input"
                    placeholder="Paste or write the URL here"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="button-ghost" onClick={() => setUrlModalOpen(false)}>Cancel</button>
                  <button className="button" onClick={() => {
                    const url = urlInput.trim();
                    if (!url) return;
                    setSources(prev => [{ type: 'url', value: url }, ...prev]);
                    setUrlInput("");
                    setUrlModalOpen(false);
                  }}>Load</button>
                </div>
              </div>
            </div>
          )}

          {/* Ingest panel removed */}

      </main>
    </div>
  );
}
