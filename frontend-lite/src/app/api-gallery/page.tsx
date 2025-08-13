"use client";
import { Navbar } from "../../components/layout/Navbar";
import React from "react";
import { Sidebar } from "../../components/navigation/Sidebar";
import { BottomNav } from "../../components/navigation/BottomNav";
import { useLayoutState } from "../../components/layout/LayoutState";
import { apiJson } from "../../lib/api";
import { getTenantId } from "../../lib/tenant";
import Image from "next/image";

type CategoriesResponse = {
  categories: string[];
  curated?: string[];
  discovered?: string[];
  counts?: Record<string, number>;
};

function ProviderCard(props: {
  provider_id: string;
  name: string;
  logo_url?: string | null;
  description?: string | null;
  tags: string[];
  apisCount: number;
  initiallyAdded?: boolean;
  homepage_url?: string | null;
  doc_base_url?: string | null;
  // When provided, use express add flow instead of immediate add
  onExpressAdd?: (provider: ProviderItem) => void;
  provider?: ProviderItem; // full object for express flow
}) {
  const [added, setAdded] = React.useState(!!props.initiallyAdded);
  const [expanded, setExpanded] = React.useState(false);
  // Track if the logo failed to load so we can show a default icon
  const [logoFailed, setLogoFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handleAddToggle() {
    if (busy) return;
    try {
      setBusy(true);
      if (!added) {
        // If express flow handler exists, open drawer instead
        if (props.onExpressAdd && props.provider) {
          props.onExpressAdd(props.provider);
          return;
        }
        // Add: fetch ready APIs for provider and add the first one to the bag
        const apis = await apiJson<Array<{
          api_service_id: string;
          name: string;
          added: boolean;
          is_visible: boolean;
        }>>(`/api-gallery/provider/${encodeURIComponent(props.provider_id)}`, { method: "GET" });
        const first = (apis || []).find((a) => true);
        if (!first) throw new Error("No ready APIs found for provider");
        await apiJson(`/api-gallery/bag`, { method: "POST", body: ({ api_service_id: first.api_service_id } as any) });
        setAdded(true);
      } else {
        // Remove: find any added API for this provider and remove one
        const apis = await apiJson<Array<{
          api_service_id: string;
          name: string;
          added: boolean;
        }>>(`/api-gallery/provider/${encodeURIComponent(props.provider_id)}`, { method: "GET" });
        const chosen = (apis || []).find((a) => a.added);
        if (chosen) {
          await apiJson(`/api-gallery/bag/${encodeURIComponent(chosen.api_service_id)}`, { method: "DELETE" });
        }
        setAdded(false);
      }
    } catch (e) {
      console.warn("Bag toggle failed", e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card" style={{ height: "100%", alignSelf: "start", margin: 0 }}>
      <div className="card-body" style={{ position: "relative", padding: 16, display: "flex", flexDirection: "column", height: "100%" }}>
        {added ? (
          <span className="pill pill-success" style={{ position: "absolute", right: 12, top: 10 }}>✓ Added</span>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, minHeight: 32, flexWrap: "wrap" }}>
          {props.logo_url && !logoFailed ? (
            <Image
              src={props.logo_url}
              alt={props.name}
              width={24}
              height={24}
              style={{ width: 24, height: 24, objectFit: "contain" }}
              unoptimized
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span title="Logo unavailable" style={{ fontSize: 18, lineHeight: 1 }}>🌐</span>
          )}
          <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{props.name}</div>
        </div>
        {props.description ? (
          <p className="muted" style={{ margin: 0 }}>{props.description}</p>
        ) : null}
        <div className="chips" style={{ marginTop: 12 }}>
          {props.tags.map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
        <div className="row" style={{ marginTop: "auto", paddingTop: 12, justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="muted">{props.apisCount} APIs available</span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {props.doc_base_url ? (
              <a className="button" href={props.doc_base_url} target="_blank" rel="noreferrer">Docs</a>
            ) : null}
            <button
              className={"button " + (added ? "" : "primary")}
              onClick={handleAddToggle}
              disabled={busy}
              title={busy ? "Working..." : undefined}
            >
              {added ? "Added" : "+ Add"}
            </button>
          </div>
        </div>
        {/* Placeholder for future expansion */}
      </div>
    </div>
  );
}

type ProviderItem = {
  provider_id: string;
  name: string;
  description?: string | null;
  categories: string[];
  logo_url?: string | null;
  homepage_url?: string | null;
  doc_base_url?: string | null;
  api_count: number;
  added: boolean;
  is_visible: boolean;
};

export default function ApiGalleryPage() {
  const [query, setQuery] = React.useState("");
  const [activeCats, setActiveCats] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<ProviderItem[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loadingCats, setLoadingCats] = React.useState<boolean>(true);
  const [catCounts, setCatCounts] = React.useState<Record<string, number>>({});
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [moreQuery, setMoreQuery] = React.useState("");
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  // Express Add Drawer state
  const [expressOpen, setExpressOpen] = React.useState(false);
  const [target, setTarget] = React.useState<ProviderItem | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdPackId, setCreatedPackId] = React.useState<string | null>(null);

  const toggleCat = (c: string) => {
    setActiveCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    Promise.all([
      apiJson<ProviderItem[]>("/api-gallery/providers").catch((e) => {
        console.error("Failed to load providers", e);
        return [] as ProviderItem[];
      }),
      apiJson<CategoriesResponse>("/api-gallery/categories").catch((e) => {
        console.warn("Failed to load categories, will derive from providers", e);
        return { categories: [] } as CategoriesResponse;
      }),
    ])
      .then(([providers, catsResp]) => {
        if (!isMounted) return;
        const visible = providers.filter((p) => p.is_visible !== false);
        setItems(visible);
        // Use backend-provided curated+discovered if available; otherwise derive
        let cats = catsResp?.categories || [];
        if (!cats.length) {
          const set = new Set<string>();
          for (const p of visible) {
            for (const c of p.categories || []) set.add(c);
          }
          cats = Array.from(set).sort();
        }
        setCategories(cats);
        setCatCounts(catsResp?.counts || {});
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
        setLoadingCats(false);
      });
    return () => { isMounted = false; };
  }, []);

  const filtered = items.filter((p) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    const matchCats = activeCats.length === 0 || p.categories.some((c) => activeCats.includes(c));
    return matchQ && matchCats;
  });

  const TOP_N = 12;
  const topCats = categories.slice(0, TOP_N);
  const moreCats = categories.slice(TOP_N);
  const moreCatsFiltered = moreCats.filter((c) => !moreQuery || c.toLowerCase().includes(moreQuery.toLowerCase()));

  // Express Add handlers
  function openExpress(provider: ProviderItem) {
    setTarget(provider);
    setError(null);
    setCreatedPackId(null);
    setExpressOpen(true);
  }

  function closeExpress() {
    if (creating) return;
    setExpressOpen(false);
    setTarget(null);
  }

  async function confirmExpress() {
    if (!target || creating) return;
    setCreating(true);
    setError(null);
    try {
      // Build minimal body from provider
      const nameBase = `${target.name}`.trim();
      const displayName = `${nameBase} API`;
      const category = (target.categories && target.categories[0]) || 'API';
      // Prefer documentation URL as primary for indexing
      const api_url = target.doc_base_url || target.homepage_url || '';
      // Include both docs and homepage in additional_urls when available
      const additional_urls = (
        [target.doc_base_url, target.homepage_url].filter(Boolean) as string[]
      ).filter((u, idx, arr) => arr.indexOf(u) === idx);
      const body: any = {
        name: nameBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        display_name: displayName,
        description: target.description || `${target.name} API pack`,
        category,
        api_url,
        additional_urls,
        logo_url: target.logo_url || undefined,
        make_public: true,
      };
      // Ensure tenant is set (defensive)
      getTenantId();
      const res = await apiJson<{ pack_id: string }>(`/api/packs/create`, {
        method: 'POST',
        body,
      });
      setCreatedPackId(res.pack_id);
    } catch (e: any) {
      console.error('Express create failed', e);
      setError(e?.message || 'Failed to start indexing');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar" style={{ padding: 16, maxWidth: 1100, paddingLeft: leftWidth + 24, margin: "0 auto", overflowX: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>API Gallery</h1>
            <p className="label" style={{ marginTop: 8 }}>Browse and integrate API providers into your system</p>
          </div>
          <div className="pill pill-info" style={{ marginLeft: "auto" }}>{loading ? "Loading..." : `${filtered.length} providers`}</div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body">
            <input
              className="input"
              placeholder="Search providers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="chips" style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(loadingCats ? [] : topCats).map((c) => (
                <span
                  key={c}
                  className={"chip" + (activeCats.includes(c) ? " active" : "")}
                  onClick={() => toggleCat(c)}
                  title={`${catCounts[c] ? catCounts[c] + " providers" : ""}`}
                >
                  {c}{catCounts?.[c] ? <span className="badge" style={{ marginLeft: 6 }}>{catCounts[c]}</span> : null}
                </span>
              ))}
              {moreCats.length > 0 ? (
                <span className="chip" onClick={() => setMoreOpen(true)}>+ More filters</span>
              ) : null}
            </div>
          </div>
        </div>

        {moreOpen ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => {
            if (e.target === e.currentTarget) setMoreOpen(false);
          }}>
            <div className="modal" style={{ maxWidth: 640 }}>
              <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>Filter by categories</div>
                <button className="button" onClick={() => setMoreOpen(false)}>Close</button>
              </div>
              <div className="modal-body">
                <input
                  className="input"
                  placeholder="Search categories..."
                  value={moreQuery}
                  onChange={(e) => setMoreQuery(e.target.value)}
                />
                <div style={{ marginTop: 12, maxHeight: 360, overflowY: "auto" }}>
                  {moreCatsFiltered.map((c) => (
                    <label key={c} className="row" style={{ gap: 8, alignItems: "center", padding: "6px 0" }}>
                      <input
                        type="checkbox"
                        checked={activeCats.includes(c)}
                        onChange={() => toggleCat(c)}
                      />
                      <span className={"chip" + (activeCats.includes(c) ? " active" : "")}
                            onClick={() => toggleCat(c)}
                            style={{ cursor: "pointer" }}>
                        {c}
                        {catCounts?.[c] ? <span className="badge" style={{ marginLeft: 6 }}>{catCounts[c]}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions" style={{ display: "flex", justifyContent: "space-between" }}>
                <div className="muted">
                  {activeCats.length > 0 ? `${activeCats.length} filters selected` : "No filters selected"}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {activeCats.length > 0 ? (
                    <button className="button" onClick={() => setActiveCats([])}>Clear all</button>
                  ) : null}
                  <button className="button primary" onClick={() => setMoreOpen(false)}>Apply</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {filtered.map((p) => (
            <ProviderCard
              key={p.provider_id}
              provider_id={p.provider_id}
              name={p.name}
              description={p.description}
              tags={p.categories || []}
              apisCount={p.api_count}
              initiallyAdded={p.added}
              logo_url={p.logo_url}
              homepage_url={p.homepage_url}
              doc_base_url={p.doc_base_url}
              onExpressAdd={openExpress}
              provider={p}
            />
          ))}
        </div>
      </main>
      {expressOpen && target ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => {
          if (e.target === e.currentTarget) closeExpress();
        }}>
          <div
            className="modal"
            style={{
              width: 380,
              maxWidth: 380,
              height: '100%',
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
              <div style={{ fontWeight: 600 }}>Index API</div>
              <button className="button" onClick={closeExpress} disabled={creating} aria-label="Close" title="Close" style={{ fontWeight: 700 }}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
              <div className="card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                    {target.logo_url ? (
                      <Image
                        src={target.logo_url}
                        alt={target.name}
                        width={28}
                        height={28}
                        style={{ width: 28, height: 28, objectFit: 'contain' }}
                        unoptimized
                      />
                    ) : (
                      <span style={{ fontSize: 20 }}>🌐</span>
                    )}
                    <div style={{ fontWeight: 600 }}>{target.name}</div>
                  </div>
                  <p className="muted" style={{ margin: 0 }}>
                    You are about to start indexing this API into a Kiff Pack. This can take a couple of minutes. You can track progress only in
                    <a href="/kiffs/packs/" className="link" style={{ marginLeft: 4 }}>/kiffs/packs/</a>.
                  </p>
                  {target.doc_base_url ? (
                    <div className="muted" style={{ fontSize: 12 }}>Docs: <a href={target.doc_base_url} target="_blank" rel="noreferrer">{target.doc_base_url}</a></div>
                  ) : null}
                  {error ? (
                    <div className="pill pill-error">{error}</div>
                  ) : null}
                  {createdPackId ? (
                    <div className="pill pill-success">Started indexing. We will let you know when it is ready.</div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: 12 }}>
              <button className="button" onClick={closeExpress} disabled={creating}>Cancel</button>
              <button className="button primary" onClick={confirmExpress} disabled={creating || !!createdPackId}>
                {creating ? 'Starting…' : 'Confirm to Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <BottomNav />
    </div>
  );
}
