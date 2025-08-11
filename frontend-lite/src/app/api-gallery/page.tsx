"use client";
import { Navbar } from "../../components/layout/Navbar";
import React from "react";
import { Sidebar } from "../../components/navigation/Sidebar";
import { BottomNav } from "../../components/navigation/BottomNav";
import { useLayoutState } from "../../components/layout/LayoutState";
import { apiJson } from "../../lib/api";

const CATEGORIES = [
  "AI/ML",
  "Text Generation",
  "Conversation",
  "Analysis",
  "Data",
  "Maps",
  "Translation",
  "Payments",
  "Finance",
  "E-commerce",
  "Communication",
  "SMS",
  "Voice",
  "Email",
  "Marketing",
];

function ProviderCard(props: {
  name: string;
  logo_url?: string | null;
  description?: string | null;
  tags: string[];
  apisCount: number;
  initiallyAdded?: boolean;
  homepage_url?: string | null;
  doc_base_url?: string | null;
}) {
  const [added, setAdded] = React.useState(!!props.initiallyAdded);
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="card" style={{ height: "100%", alignSelf: "start", margin: 0 }}>
      <div className="card-body" style={{ position: "relative", padding: 16, display: "flex", flexDirection: "column", height: "100%" }}>
        {added ? (
          <span className="pill pill-success" style={{ position: "absolute", right: 12, top: 10 }}>✓ Added</span>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingRight: 110, minHeight: 32 }}>
          {props.logo_url ? (
            <img src={props.logo_url} alt={props.name} style={{ width: 24, height: 24, objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 18, lineHeight: 1 }}>🔌</span>
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
        <div className="row" style={{ marginTop: "auto", paddingTop: 12, justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted">{props.apisCount} APIs available</span>
          <div className="row">
            {props.doc_base_url ? (
              <a className="button" href={props.doc_base_url} target="_blank" rel="noreferrer">Docs</a>
            ) : null}
            <button
              className={"button " + (added ? "" : "primary")}
              onClick={() => setAdded((v) => !v)}
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
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const toggleCat = (c: string) => {
    setActiveCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    apiJson<ProviderItem[]>("/api-gallery/providers")
      .then((data) => {
        if (!isMounted) return;
        setItems(data.filter((p) => p.is_visible !== false));
      })
      .catch((err) => {
        console.error("Failed to load providers", err);
      })
      .finally(() => isMounted && setLoading(false));
    return () => { isMounted = false; };
  }, []);

  const filtered = items.filter((p) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    const matchCats = activeCats.length === 0 || p.categories.some((c) => activeCats.includes(c));
    return matchQ && matchCats;
  });

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar" style={{ padding: 16, maxWidth: 1100, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>API Gallery</h1>
            <p className="label" style={{ marginTop: 8 }}>Browse and integrate API providers into your system</p>
          </div>
          <div className="pill pill-info">{loading ? "Loading..." : `${filtered.length} providers`}</div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body">
            <input
              className="input"
              placeholder="Search providers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="chips" style={{ marginTop: 12 }}>
              {CATEGORIES.map((c) => (
                <span
                  key={c}
                  className={"chip" + (activeCats.includes(c) ? " active" : "")}
                  onClick={() => toggleCat(c)}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: 16,
              marginTop: 12,
              alignItems: "start",
              justifyItems: "stretch",
              alignContent: "start",
            }}>
            {filtered.map((p) => (
              <ProviderCard
                key={p.provider_id}
                name={p.name}
                logo_url={p.logo_url || undefined}
                description={p.description}
                tags={p.categories}
                apisCount={p.api_count}
                initiallyAdded={p.added}
                homepage_url={p.homepage_url}
                doc_base_url={p.doc_base_url || undefined}
              />
            ))}
          </div>
      </main>
      <BottomNav />
    </div>
  );
}
