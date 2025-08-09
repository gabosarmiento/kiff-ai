"use client";

import React from "react";
import { Navbar } from "../../components/layout/Navbar";
import { AppSidebar } from "../../components/navigation/AppSidebar";
import { useLayoutState } from "../../components/layout/LayoutState";
import { apiJson } from "../../lib/api";

type ApiItem = {
  id: string;
  name: string;
  description?: string;
  website?: string;
  icon?: string;
  categories: string[];
  docs_url?: string;
  sitemap_url?: string;
  url_filters?: string[];
  status?: string;
};

type SitemapResp = {
  api_id: string;
  sitemap_url?: string | null;
  total_urls: number;
  selected_urls: string[];
};

type Chunk = { text: string; url: string; index: number; tokens_est: number; metadata?: any };
type ExtractTotals = { chunks: number; tokens_est: number; duration_ms?: number };
type Costs = {
  tokens_est: number;
  embed_tokens_est: number;
  est_usd: number;
  model?: string;
  price_per_1k_input?: number;
  price_per_1k_output?: number;
};

type ExtractPreviewResp = {
  chunks: Chunk[];
  totals: ExtractTotals;
  per_url: Record<string, any>;
  config: Record<string, any>;
  logs: string[];
  costs: Costs;
};

export default function ExtractorPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const [apis, setApis] = React.useState<ApiItem[]>([]);
  const [apiId, setApiId] = React.useState<string>("");
  const [resolving, setResolving] = React.useState(false);
  const [urls, setUrls] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  const [mode, setMode] = React.useState<string>("fast");
  const [strategy, setStrategy] = React.useState<string>("fixed");
  const [chunkSize, setChunkSize] = React.useState<number>(5000);
  const [overlap, setOverlap] = React.useState<number>(300);
  const [includeMeta, setIncludeMeta] = React.useState<boolean>(true);

  const [extracting, setExtracting] = React.useState(false);
  const [chunks, setChunks] = React.useState<Chunk[]>([]);
  const [totals, setTotals] = React.useState<ExtractTotals | null>(null);
  const [perUrl, setPerUrl] = React.useState<Record<string, any>>({});
  const [config, setConfig] = React.useState<Record<string, any> | null>(null);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [costs, setCosts] = React.useState<Costs | null>(null);
  const [activeTab, setActiveTab] = React.useState<"chunks" | "metadata" | "costs" | "logs">("chunks");
  const [contentTab, setContentTab] = React.useState<"text" | "markdown" | "raw">("text");
  const [stage, setStage] = React.useState<"configuration" | "processing" | "result">("configuration");
  const [progress, setProgress] = React.useState<number>(0);

  const [ingesting, setIngesting] = React.useState(false);
  const [kbName, setKbName] = React.useState("kb-demo");
  const [kbId, setKbId] = React.useState<string | null>(null);
  const [kiffName, setKiffName] = React.useState("my-first-kiff");
  const [creatingKiff, setCreatingKiff] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const list = await apiJson<ApiItem[]>("/api/apis");
        setApis(list);
        if (list.length) setApiId(list[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Auto-fetch URLs when API changes
  React.useEffect(() => {
    if (!apiId) return;
    (async () => {
      setResolving(true);
      try {
        const resp = await apiJson<SitemapResp>(`/api/apis/${apiId}/sitemap?limit=20`);
        const list = resp.selected_urls || [];
        setUrls(list);
        setSelected(Object.fromEntries(list.map((u) => [u, true])));
      } catch (e) {
        console.error(e);
      } finally {
        setResolving(false);
      }
    })();
  }, [apiId]);

  const fetchUrls = async () => {
    if (!apiId) return;
    setResolving(true);
    try {
      const resp = await apiJson<SitemapResp>(`/api/apis/${apiId}/sitemap?limit=20`);
      setUrls(resp.selected_urls || []);
      const sel: Record<string, boolean> = {};
      for (const u of resp.selected_urls || []) sel[u] = true;
      setSelected(sel);
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(false);
    }
  };

  const extractPreview = async () => {
    const chosen = urls.filter((u) => selected[u]);
    if (!chosen.length) return;
    setExtracting(true);
    setStage("processing");
    setProgress(10);
    const tick = setInterval(() => setProgress((p) => Math.min(95, p + Math.random() * 8)), 250);
    try {
      const resp = await apiJson<ExtractPreviewResp>(
        "/api/extract/preview",
        {
          method: "POST",
          asJson: true,
          body: {
            api_id: apiId,
            urls: chosen,
            mode,
            strategy,
            chunk_size: Math.min(Math.max(chunkSize || 1, 1), 12000),
            chunk_overlap: Math.min(Math.max(overlap || 0, 0), 500),
            include_metadata: includeMeta,
          },
        } as any
      );
      setChunks(resp.chunks);
      setTotals(resp.totals);
      setPerUrl(resp.per_url || {});
      setConfig(resp.config || null);
      setLogs(resp.logs || []);
      setCosts(resp.costs || null);
      setProgress(100);
      setStage("result");
    } catch (e) {
      console.error(e);
    } finally {
      clearInterval(tick);
      setExtracting(false);
    }
  };

  const ingestToKB = async () => {
    if (!chunks.length) return;
    setIngesting(true);
    try {
      const kb = await apiJson<{ id: string }>("/api/kb", {
        method: "POST",
        asJson: true,
        body: { name: kbName, vector_store: "lancedb" },
      } as any);
      setKbId(kb.id);
      const items = chunks.map((c) => ({ text: c.text, url: c.url, metadata: c.metadata }));
      await apiJson<{ ok: boolean; ingested: number }>(`/api/kb/${kb.id}/ingest`, {
        method: "POST",
        asJson: true,
        body: { items },
      } as any);
      alert(`Ingested ${items.length} chunks to KB ${kb.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIngesting(false);
    }
  };

  const createKiff = async () => {
    if (!kbId) return;
    setCreatingKiff(true);
    try {
      const kiff = await apiJson<{ id: string }>("/api/kiffs", {
        method: "POST",
        asJson: true,
        body: { name: kiffName, kb_id: kbId, model: "mock", top_k: 5 },
      } as any);
      window.location.href = `/kiffs/${kiff.id}`;
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingKiff(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <AppSidebar />
      <main className="pane" style={{ padding: 16, maxWidth: 1200, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>API Extraction Tester</h1>
              <p className="label" style={{ marginTop: 8 }}>Select a provider, configure chunking, preview results, then ingest into LanceDB.</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
              {/* Left: API select and URLs (auto-fetched) */}
              <div>
                <label className="label">API Provider</label>
                <select className="input" value={apiId} onChange={(e) => setApiId(e.target.value)}>
                  {apis.map((p) => (
                    <option key={p.id} value={p.id}>{p.icon ? `${p.icon} ` : ""}{p.name}</option>
                  ))}
                </select>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button className="button" onClick={() => setSelected(Object.fromEntries(urls.map((u) => [u, true])))} disabled={!urls.length}>Select All</button>
                  <button className="button" onClick={() => setSelected({})} disabled={!urls.length}>Clear</button>
                </div>
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="card-body">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="label">Sources {resolving ? "(loading…)" : `(${urls.length} shown)`}</div>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 260, overflow: "auto" }}>
                      {urls.map((u) => (
                        <li key={u} style={{ marginBottom: 6 }}>
                          <label className="row" style={{ alignItems: "center", gap: 8 }}>
                            <input type="checkbox" checked={!!selected[u]} onChange={(e) => setSelected({ ...selected, [u]: e.target.checked })} />
                            <span className="muted" style={{ wordBreak: "break-all" }}>{u}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Right: Controls and single Extract action */}
              <div>
                <label className="label">Extraction</label>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="fast">Fast</option>
                    <option value="agentic">Quality</option>
                  </select>
                  <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                    <option value="fixed">Fixed Size</option>
                    <option value="document">Document</option>
                    {/* Future: semantic/agentic/recursive when backend supports */}
                  </select>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Chunk Size (tokens)</label>
                    <input className="input" type="range" min={256} max={12000} step={64} value={chunkSize} onChange={(e) => setChunkSize(parseInt(e.target.value || "5000", 10))} />
                    <div className="muted" style={{ fontSize: 12 }}>{chunkSize}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Overlap</label>
                    <input className="input" type="range" min={0} max={500} step={10} value={overlap} onChange={(e) => setOverlap(parseInt(e.target.value || "300", 10))} />
                    <div className="muted" style={{ fontSize: 12 }}>{overlap}</div>
                  </div>
                </div>
                <div className="row" style={{ alignItems: "center", gap: 6, marginTop: 8 }}>
                  <input type="checkbox" checked={includeMeta} onChange={(e) => setIncludeMeta(e.target.checked)} />
                  <span className="label">Extract metadata</span>
                </div>
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                  <button className="button primary" onClick={extractPreview} disabled={extracting || !urls.length}>{extracting ? "Extracting…" : "Extract"}</button>
                </div>
              </div>
            </div>
          </div>

          {stage === "processing" && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-body">
                <div className="label">Extracting API Documentation…</div>
                <div style={{ height: 8, background: "#eef2ff", borderRadius: 6, overflow: "hidden", marginTop: 8 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#60a5fa,#34d399,#f472b6)", transition: "width .2s" }} />
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{Math.round(progress)}%</div>
              </div>
            </div>
          )}

          {stage === "result" && totals && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
                <div>
                  {/* Content tabs (Storybook-style) */}
                  <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                    <button className="button" onClick={() => setContentTab("text")} data-active={contentTab === "text"}>TEXT</button>
                    <button className="button" onClick={() => setContentTab("markdown")} data-active={contentTab === "markdown"}>MARKDOWN</button>
                    <button className="button" onClick={() => setContentTab("raw")} data-active={contentTab === "raw"}>RAW</button>
                  </div>

                  {/* Content preview area */}
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div className="card-body" style={{ minHeight: 260 }}>
                      {contentTab === "text" && (
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
{(chunks.slice(0, 10).map(c => c.text).join("\n\n")).slice(0, 8000)}
                        </pre>
                      )}
                      {contentTab === "markdown" && (
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
{(chunks.slice(0, 10).map(c => c.text).join("\n\n")).slice(0, 8000)}
                        </pre>
                      )}
                      {contentTab === "raw" && (
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify({ per_url: perUrl, config }, null, 2)}</pre>
                      )}
                    </div>
                  </div>

                  {/* Analysis tabs */}
                  <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                    <button className="button" onClick={() => setActiveTab("chunks")} data-active={activeTab === "chunks"}>Chunks</button>
                    <button className="button" onClick={() => setActiveTab("metadata")} data-active={activeTab === "metadata"}>Metadata</button>
                    <button className="button" onClick={() => setActiveTab("costs")} data-active={activeTab === "costs"}>Costs</button>
                    <button className="button" onClick={() => setActiveTab("logs")} data-active={activeTab === "logs"}>Logs</button>
                  </div>

                  {/* Ingest controls */}
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                    <div className="muted">Chunks: {totals.chunks} • Tokens (est): {totals.tokens_est}</div>
                    <div className="row" style={{ gap: 8 }}>
                      <input className="input" value={kbName} onChange={(e) => setKbName(e.target.value)} placeholder="KB name" />
                      <button className="button primary" onClick={ingestToKB} disabled={ingesting}>{ingesting ? "Ingesting..." : "Ingest to KB (LanceDB)"}</button>
                    </div>
                  </div>

                  {activeTab === "chunks" && (
                    <div>
                      <div className="muted">Chunks: {totals.chunks} • Tokens: {totals.tokens_est} • Duration: {totals.duration_ms ?? 0}ms</div>
                      <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 300, overflow: "auto" }}>
                        {chunks.slice(0, 50).map((c, i) => (
                          <li key={i} style={{ marginBottom: 8 }}>
                            <div className="muted" style={{ fontSize: 12 }}>{c.url} • #{c.index} • {c.tokens_est}t</div>
                            <div style={{ whiteSpace: "pre-wrap" }}>{c.text.slice(0, 400)}{c.text.length > 400 ? "…" : ""}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeTab === "metadata" && (
                    <div className="row" style={{ gap: 24 }}>
                      <div style={{ flex: 1 }}>
                        <div className="label">Config</div>
                        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(config, null, 2)}</pre>
                      </div>
                      <div style={{ width: 320 }}>
                        <div className="label">Per URL</div>
                        <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 260, overflow: "auto" }}>
                          {Object.entries(perUrl).map(([u, data]) => (
                            <li key={u} style={{ marginBottom: 8 }}>
                              <div className="muted" style={{ fontSize: 12 }}>{u}</div>
                              <div className="muted" style={{ fontSize: 12 }}>chunks: {(data as any).chunks} • tokens: {(data as any).tokens_est}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeTab === "costs" && costs && (
                    <div>
                      <div className="muted">Model: {costs.model ?? "(unknown)"}</div>
                      <div className="muted">Price/1k (input): ${typeof costs.price_per_1k_input === "number" ? costs.price_per_1k_input.toFixed(3) : "-"} • Price/1k (output): ${typeof costs.price_per_1k_output === "number" ? costs.price_per_1k_output.toFixed(3) : "-"}</div>
                      <div className="muted">Tokens: {costs.tokens_est} • Embed tokens: {costs.embed_tokens_est}</div>
                      <div className="muted">Est. cost: ${costs.est_usd.toFixed ? costs.est_usd.toFixed(6) : costs.est_usd}</div>
                    </div>
                  )}

                  {activeTab === "logs" && (
                    <div>
                      <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 300, overflow: "auto" }}>
                        {logs.map((l, i) => (
                          <li key={i} className="muted" style={{ fontSize: 12 }}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Ingest CTA (optional for tester) */}
                  {kbId && (
                    <div style={{ marginTop: 12 }}>
                      <div className="pill pill-success">KB created: {kbId}</div>
                      <div className="row" style={{ gap: 8, marginTop: 8 }}>
                        <input className="input" value={kiffName} onChange={(e) => setKiffName(e.target.value)} placeholder="Kiff name" />
                        <button className="button primary" onClick={createKiff} disabled={creatingKiff}>{creatingKiff ? "Creating..." : "Create Kiff & Open"}</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Run stats panel */}
                <div className="card">
                  <div className="card-body">
                    <div className="label" style={{ marginBottom: 8 }}>Run stats</div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="pill">Duration</span>
                      <span className="pill pill-muted">{totals.duration_ms ?? 0} ms</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                      <span className="pill">Total tokens</span>
                      <span className="pill pill-muted">{totals.tokens_est}</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                      <span className="pill">Chunks</span>
                      <span className="pill pill-muted">{totals.chunks}</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                      <span className="pill">Est. cost</span>
                      <span className="pill pill-muted">${(costs?.est_usd ?? 0).toFixed(4)}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Model: {costs?.model} • In/Out per 1k: ${typeof costs?.price_per_1k_input === "number" ? costs!.price_per_1k_input.toFixed(3) : "-"}/${typeof costs?.price_per_1k_output === "number" ? costs!.price_per_1k_output.toFixed(3) : "-"}</div>
                    <div className="label" style={{ marginTop: 12 }}>Context</div>
                    <div className="card" style={{ marginTop: 6 }}>
                      <div className="card-body">
                        <div className="muted" style={{ fontSize: 12 }}>View: {activeTab.toUpperCase()}</div>
                        <div className="muted" style={{ fontSize: 12 }}>Doc: {urls[0] || Object.keys(perUrl)[0] || "(n/a)"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
