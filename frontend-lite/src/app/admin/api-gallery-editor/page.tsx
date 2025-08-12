"use client";

import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { useLayoutState } from "@/components/layout/LayoutState";
import { apiJson, apiConfig } from "@/lib/api";
import { withTenantHeaders } from "@/lib/tenant";

export default function AdminApiGalleryEditorPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminApiGalleryEditorPageContent />
    </ProtectedRoute>
  );
}

type Provider = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  categories?: string[];
  logo_url?: string;
  homepage_url?: string;
  is_visible?: boolean;
  sort_order?: number;
};

type ApiService = {
  id: string;
  provider_id: string;
  name: string;
  slug?: string;
  doc_base_url: string;
  status?: string;
  is_visible?: boolean;
  url_count?: number;
  last_indexed_at?: string | null;
};

function AdminApiGalleryEditorPageContent() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [didSync, setDidSync] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apis, setApis] = useState<ApiService[]>([]);

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
  const [showProviderAdvanced, setShowProviderAdvanced] = useState(false);
  const [q, setQ] = useState("");

  // Provider form
  const [pId, setPId] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pCats, setPCats] = useState(""); // comma-separated
  const [pLogo, setPLogo] = useState("");
  const [pHome, setPHome] = useState("");
  const [pVisible, setPVisible] = useState(true);
  const [pOrder, setPOrder] = useState<number>(0);

  // API form
  const [aId, setAId] = useState<string | null>(null);
  const [aProviderId, setAProviderId] = useState<string | null>(null);
  const [aName, setAName] = useState("");
  const [aDoc, setADoc] = useState("");
  const [aVisible, setAVisible] = useState(true);

  const filteredProviders = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return providers;
    return providers.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.categories || []).join(",").toLowerCase().includes(s)
    );
  }, [providers, q]);

  const providerApis = (pid: string) => apis.filter(a => a.provider_id === pid);

  const resetProviderForm = (preset?: Partial<Provider>) => {
    setPId(preset?.id ?? null);
    setPName(preset?.name ?? "");
    setPDesc(preset?.description ?? "");
    setPCats((preset?.categories || []).join(", "));
    setPLogo(preset?.logo_url ?? "");
    setPHome(preset?.homepage_url ?? "");
    setPVisible(preset?.is_visible ?? true);
    setPOrder(preset?.sort_order ?? 0);
  };

  const resetApiForm = (preset?: Partial<ApiService>) => {
    setAId(preset?.id ?? null);
    setAProviderId(preset?.provider_id ?? selectedProviderId ?? providers[0]?.id ?? null);
    setAName(preset?.name ?? "");
    setADoc(preset?.doc_base_url ?? "");
    setAVisible(preset?.is_visible ?? true);
  };

  const syncBackendSession = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/bridge/auth/sync', { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      setDidSync(true);
      return true;
    } catch {
      return false;
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ providers: Provider[]; apis: ApiService[] }>(
        "/backend/admin/api_gallery_editor/list",
        { method: "GET" } as any
      );
      setProviders(data.providers || []);
      setApis(data.apis || []);
      // maintain selected provider if still present
      if (selectedProviderId && !data.providers.find((p) => p.id === selectedProviderId)) {
        setSelectedProviderId(null);
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to load";
      setError(msg);
      if (msg.includes("401")) {
        // try once to auto-sync backend session, then retry
        if (!didSync) {
          const ok = await syncBackendSession();
          if (ok) {
            try {
              const data = await apiJson<{ providers: Provider[]; apis: ApiService[] }>(
                "/backend/admin/api_gallery_editor/list",
                { method: "GET" } as any
              );
              setProviders(data.providers || []);
              setApis(data.apis || []);
              setError(null);
              setAuthNeeded(false);
              return; // success after sync
            } catch (e2: any) {
              setError(e2?.message || "Failed after sync");
            }
          }
        }
        setAuthNeeded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Attempt sync early then load
    (async () => {
      if (!didSync) await syncBackendSession();
      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actions
  const saveProvider = async () => {
    const body: any = {
      id: pId || undefined,
      name: pName,
      description: pDesc || undefined,
      categories: pCats
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      logo_url: pLogo || undefined,
      homepage_url: pHome || undefined,
      is_visible: !!pVisible,
      sort_order: Number.isFinite(pOrder) ? pOrder : 0,
    };
    await apiJson("/backend/admin/api_gallery_editor/provider", {
      method: "POST",
      asJson: true,
      body,
    } as any);
    await loadAll();
  };

  const removeProvider = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    await apiJson(`/backend/admin/api_gallery_editor/provider/${id}`, { method: "DELETE" } as any);
    if (selectedProviderId === id) setSelectedProviderId(null);
    await loadAll();
  };

  const saveApi = async () => {
    const body: any = {
      id: aId || undefined,
      provider_id: aProviderId!,
      name: aName,
      doc_base_url: aDoc,
      is_visible: !!aVisible,
    };
    await apiJson("/backend/admin/api_gallery_editor/api", { method: "POST", asJson: true, body } as any);
    await loadAll();
  };

  const removeApi = async (id: string) => {
    if (!confirm("Delete this API service?")) return;
    await apiJson(`/backend/admin/api_gallery_editor/api/${id}`, { method: "DELETE" } as any);
    await loadAll();
  };

  const reindexApi = async (id: string) => {
    await apiJson(`/backend/admin/api_gallery_editor/api/${id}/reindex`, { method: "POST" } as any);
    await loadAll();
  };

  const indexFull = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const body: any = {
        strategy: "semantic",
        mode: "fast",
        embedder: "sentence-transformers",
        chunk_size: 4400,
        chunk_overlap: 300,
        create_kb_if_missing: true,
      };
      const res = await apiJson(`/backend/admin/api_gallery_editor/api/${id}/index_full`, {
        method: "POST",
        asJson: true,
        body,
      } as any);
      console.log("Index full result:", res);
      await loadAll();
      alert("Indexing completed. KB is ready.");
    } catch (e: any) {
      console.error("Index full error:", e);
      setError(`Index full failed: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const seedInitial = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiJson<{ providers?: number; apis?: number }>(
        "/backend/admin/api_gallery_editor/seed",
        { method: "POST" } as any
      );
      console.log("Seed result:", result);
      await loadAll();
      alert(`Successfully seeded ${result.providers || 0} providers and ${result.apis || 0} APIs!`);
    } catch (e: any) {
      console.error("Seed error:", e);
      setError(`Seed failed: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const preindexAll = async () => {
    await apiJson("/backend/admin/api_gallery_editor/preindex_all", { method: "POST" } as any);
    await loadAll();
  };

  const loginBackend = async () => {
    setError(null);
    try {
      const res = await fetch(`/backend/api/auth/login`, {
        method: "POST",
        headers: { ...withTenantHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setAuthNeeded(false);
      await loadAll();
    } catch (e: any) {
      setError(`Backend login failed: ${e?.message || "Unknown error"}`);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar" style={{ padding: 16, maxWidth: 1000, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <h1 className="h3">Admin · API Gallery</h1>
              <div className="muted">Kiff</div>
            </div>
            <p className="label mt-2">Manage APIs grouped by provider. Seed, preindex and control visibility.</p>
            {authNeeded && (
              <div className="card mt-3" style={{ maxWidth: 560 }}>
                <div className="card-body">
                  <div className="label mb-2">Backend session required</div>
                  <div className="muted mb-2">Log into the backend once to access admin endpoints.</div>
                  <div className="row" style={{ gap: 8 }}>
                    <input className="input" placeholder="admin@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                    <input className="input" type="password" placeholder="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                    <button className="button primary" onClick={loginBackend} disabled={!loginEmail || !loginPassword}>Login</button>
                  </div>
                  <div className="muted mt-2" style={{ fontSize: 12 }}>Tip: use the same admin account; default tenant header is added automatically.</div>
                </div>
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="button" onClick={seedInitial} disabled={loading}>
              {loading ? "Seeding..." : "Seed initial"}
            </button>
            <button className="button" onClick={preindexAll}>Preindex all</button>
            <button className="button" onClick={loadAll} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          </div>
        </div>

        {error && <div className="pill pill-danger" style={{ marginTop: 8 }}>{error}</div>}

        <div className="card mt-4">
          <div className="card-body">
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <input className="input" placeholder="Search providers or categories" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="muted">{filteredProviders.length} providers • {apis.length} APIs</div>
            </div>

            <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
              {filteredProviders.map((p) => {
                const pApis = providerApis(p.id);
                const expanded = expandedProviderId === p.id;
                return (
                  <li key={p.id} className="card" style={{ marginBottom: 10 }}>
                    <div className="card-body">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                          <strong>{p.name}</strong>
                          {p.is_visible === false && <span className="pill pill-muted">hidden</span>}
                        </div>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="button" onClick={() => { setExpandedProviderId(expanded ? null : p.id); setSelectedProviderId(p.id); }}>View APIs ({pApis.length})</button>
                          <button className="button" onClick={() => { setSelectedProviderId(p.id); resetApiForm({ provider_id: p.id }); setExpandedProviderId(p.id); }}>+ Add API</button>
                          <button className="button" onClick={() => { resetProviderForm(p); setShowProviderAdvanced((v) => !v); setSelectedProviderId(p.id); setExpandedProviderId(p.id); }}>Provider details</button>
                          <button className="button" onClick={() => removeProvider(p.id)}>Delete provider</button>
                        </div>
                      </div>
                      {p.homepage_url && <div className="muted" style={{ marginTop: 4, wordBreak: "break-all" }}>{p.homepage_url}</div>}
                      {(p.categories?.length ?? 0) > 0 && (
                        <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          {p.categories!.map((c) => (<span key={c} className="pill">{c}</span>))}
                        </div>
                      )}

                      {expanded && (
                        <div style={{ marginTop: 12 }}>
                          <div className="label">APIs</div>
                          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                            {pApis.map((a) => (
                              <li key={a.id} className="card" style={{ marginTop: 8 }}>
                                <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                                  <div>
                                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                      <strong>{a.name}</strong>
                                      <div className="muted" style={{ fontSize: 12 }}>URLs: {a.url_count ?? 0} • Status: {a.status || "ready"}</div>
                                    </div>
                                    <div className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{a.doc_base_url}</div>
                                    {a.last_indexed_at && <div className="muted" style={{ fontSize: 12 }}>Last indexed: {a.last_indexed_at}</div>}
                                  </div>
                                  <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                                    <button className="button" onClick={() => { setSelectedProviderId(p.id); resetApiForm(a); }}>Edit</button>
                                    <button className="button" onClick={() => indexFull(a.id)} disabled={loading}>Index Full</button>
                                    <button className="button" onClick={() => reindexApi(a.id)}>Reindex</button>
                                    <button className="button" onClick={() => removeApi(a.id)}>Delete</button>
                                  </div>
                                </div>
                              </li>
                            ))}
                            {pApis.length === 0 && <div className="muted" style={{ marginTop: 6 }}>No APIs yet.</div>}
                          </ul>

                          {/* API editor */}
                          <div className="card" style={{ marginTop: 12 }}>
                            <div className="card-body">
                              <div className="label">API editor</div>
                              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <label className="label">Provider</label>
                                  <select className="input" value={aProviderId ?? ""} onChange={(e) => setAProviderId(e.target.value)}>
                                    <option value="" disabled>Select provider</option>
                                    {providers.map(pp => (
                                      <option key={pp.id} value={pp.id}>{pp.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label className="label">API name</label>
                                  <input className="input" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Embeddings, Chat, TTS..." />
                                </div>
                              </div>
                              <label className="label" style={{ marginTop: 6 }}>Documentation base URL</label>
                              <input className="input" value={aDoc} onChange={(e) => setADoc(e.target.value)} placeholder="https://docs.example.com" />
                              <div className="row" style={{ alignItems: "center", gap: 8, marginTop: 8 }}>
                                <input type="checkbox" checked={aVisible} onChange={(e) => setAVisible(e.target.checked)} />
                                <span className="label">Visible</span>
                              </div>
                              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                                <button className="button primary" onClick={saveApi} disabled={!aProviderId || !aName || !aDoc}>Save API</button>
                                <button className="button" onClick={() => resetApiForm({ provider_id: p.id })}>Clear</button>
                              </div>
                            </div>
                          </div>

                          {/* Provider advanced */}
                          {showProviderAdvanced && selectedProviderId === p.id && (
                            <div className="card" style={{ marginTop: 12 }}>
                              <div className="card-body">
                                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                  <div className="label">Provider details (advanced)</div>
                                  <button className="button" onClick={() => setShowProviderAdvanced(false)}>Close</button>
                                </div>
                                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <label className="label">Name</label>
                                    <input className="input" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Provider name" />
                                  </div>
                                  <div style={{ width: 200 }}>
                                    <label className="label">Sort</label>
                                    <input className="input" type="number" value={pOrder} onChange={(e) => setPOrder(parseInt(e.target.value || "0", 10))} />
                                  </div>
                                </div>
                                <label className="label" style={{ marginTop: 6 }}>Description</label>
                                <textarea className="input" rows={3} value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
                                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                                  <div style={{ flex: 1 }}>
                                    <label className="label">Homepage URL</label>
                                    <input className="input" value={pHome} onChange={(e) => setPHome(e.target.value)} placeholder="https://example.com" />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="label">Logo URL (optional)</label>
                                    <input className="input" value={pLogo} onChange={(e) => setPLogo(e.target.value)} placeholder="https://logo.clearbit.com/example.com" />
                                  </div>
                                </div>
                                <label className="label" style={{ marginTop: 6 }}>Categories (comma-separated)</label>
                                <input className="input" value={pCats} onChange={(e) => setPCats(e.target.value)} placeholder="voice, speech, llm" />
                                <div className="row" style={{ alignItems: "center", gap: 8, marginTop: 8 }}>
                                  <input type="checkbox" checked={pVisible} onChange={(e) => setPVisible(e.target.checked)} />
                                  <span className="label">Visible</span>
                                </div>
                                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                                  <button className="button primary" onClick={saveProvider}>Save provider</button>
                                  <button className="button" onClick={() => resetProviderForm()}>Clear</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
