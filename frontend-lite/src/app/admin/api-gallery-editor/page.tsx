"use client";

import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { useLayoutState } from "@/components/layout/LayoutState";
import { apiJson } from "@/lib/api";

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
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apis, setApis] = useState<ApiService[]>([]);

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

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

  const filteredApis = useMemo(() => {
    if (!selectedProviderId) return apis;
    return apis.filter((a) => a.provider_id === selectedProviderId);
  }, [apis, selectedProviderId]);

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

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ providers: Provider[]; apis: ApiService[] }>(
        "/admin/api_gallery_editor/list",
        { method: "GET" } as any
      );
      setProviders(data.providers || []);
      setApis(data.apis || []);
      // maintain selected provider if still present
      if (selectedProviderId && !data.providers.find((p) => p.id === selectedProviderId)) {
        setSelectedProviderId(null);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
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
    await apiJson("/admin/api_gallery_editor/provider", {
      method: "POST",
      asJson: true,
      body,
    } as any);
    await loadAll();
  };

  const removeProvider = async (id: string) => {
    if (!confirm("Delete this provider?")) return;
    await apiJson(`/admin/api_gallery_editor/provider/${id}`, { method: "DELETE" } as any);
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
    await apiJson("/admin/api_gallery_editor/api", { method: "POST", asJson: true, body } as any);
    await loadAll();
  };

  const removeApi = async (id: string) => {
    if (!confirm("Delete this API service?")) return;
    await apiJson(`/admin/api_gallery_editor/api/${id}`, { method: "DELETE" } as any);
    await loadAll();
  };

  const reindexApi = async (id: string) => {
    await apiJson(`/admin/api_gallery_editor/api/${id}/reindex`, { method: "POST" } as any);
    await loadAll();
  };

  const seedInitial = async () => {
    await apiJson("/admin/api_gallery_editor/seed", { method: "POST" } as any);
    await loadAll();
  };

  const preindexAll = async () => {
    await apiJson("/admin/api_gallery_editor/preindex_all", { method: "POST" } as any);
    await loadAll();
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar" style={{ padding: 16, maxWidth: 1280, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="text-[22px] font-semibold m-0">Admin · API Gallery Editor</h1>
            <p className="label mt-2">Manage providers and their API services. Seed, preindex and control visibility.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="button" onClick={seedInitial}>Seed initial</button>
            <button className="button" onClick={preindexAll}>Preindex all</button>
            <button className="button" onClick={loadAll} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          </div>
        </div>

        {error && <div className="pill pill-danger" style={{ marginTop: 8 }}>{error}</div>}

        <div className="card mt-4">
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>1. Providers</div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="label">Providers ({providers.length})</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="button" onClick={() => resetProviderForm()}>New</button>
                  <button className="button" onClick={() => selectedProviderId && resetProviderForm(providers.find(p => p.id === selectedProviderId) || undefined)} disabled={!selectedProviderId}>Load selected</button>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 360, overflow: "auto" }}>
                {providers.map(p => (
                  <li key={p.id} className="row" style={{ justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <label className="row" style={{ alignItems: "center", gap: 8 }}>
                      <input type="radio" name="provider" checked={selectedProviderId === p.id} onChange={() => setSelectedProviderId(p.id)} />
                      <span>{p.name}</span>
                    </label>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="button" onClick={() => resetProviderForm(p)}>Edit</button>
                      <button className="button" onClick={() => removeProvider(p.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="card" style={{ marginTop: 8 }}>
                <div className="card-body">
                  <div className="label">Provider form</div>
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
            </div>

            <div>
              <div className="label" style={{ marginBottom: 6 }}>2. APIs</div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="label">APIs ({filteredApis.length})</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="button" onClick={() => resetApiForm({ provider_id: selectedProviderId || providers[0]?.id })}>New</button>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 360, overflow: "auto" }}>
                {filteredApis.map(a => (
                  <li key={a.id} className="card" style={{ marginBottom: 8 }}>
                    <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                      <div>
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                          <div className="row" style={{ gap: 8, alignItems: "center" }}>
                            <span className="pill">{providers.find(p => p.id === a.provider_id)?.name || "(provider)"}</span>
                            <strong>{a.name}</strong>
                            {a.is_visible === false && <span className="pill pill-muted">hidden</span>}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>URLs: {a.url_count ?? 0} • Status: {a.status || "ready"}</div>
                        </div>
                        <div className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{a.doc_base_url}</div>
                        {a.last_indexed_at && <div className="muted" style={{ fontSize: 12 }}>Last indexed: {a.last_indexed_at}</div>}
                      </div>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <button className="button" onClick={() => resetApiForm(a)}>Edit</button>
                        <button className="button" onClick={() => reindexApi(a.id)}>Reindex</button>
                        <button className="button" onClick={() => removeApi(a.id)}>Delete</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="card" style={{ marginTop: 8 }}>
                <div className="card-body">
                  <div className="label">API form</div>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label">Provider</label>
                      <select className="input" value={aProviderId ?? ""} onChange={(e) => setAProviderId(e.target.value)}>
                        <option value="" disabled>Select provider</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label">Name</label>
                      <input className="input" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="API name" />
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
                    <button className="button" onClick={() => resetApiForm({ provider_id: selectedProviderId || providers[0]?.id })}>Clear</button>
                  </div>
                  {!aProviderId && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Select a provider first to enable saving the API.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
