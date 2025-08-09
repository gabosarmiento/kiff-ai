"use client";
import { Navbar } from "../../components/layout/Navbar";
import React from "react";
import { AppSidebar } from "../../components/navigation/AppSidebar";
import { useLayoutState } from "../../components/layout/LayoutState";

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
  icon?: string;
  description: string;
  tags: string[];
  apisCount: number;
  initiallyAdded?: boolean;
  apis?: { name: string; description: string }[];
}) {
  const [added, setAdded] = React.useState(!!props.initiallyAdded);
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="card" style={{ height: "100%", alignSelf: "start", margin: 0 }}>
      <div className="card-body" style={{ position: "relative", padding: 16, display: "flex", flexDirection: "column", height: "100%" }}>
        {added ? (
          <span className="pill pill-success" style={{ position: "absolute", right: 12, top: 10 }}>✓ Added</span>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingRight: 110, height: 32 }}>
          <div style={{ width: 24, height: 24, display: "grid", placeItems: "center", flex: "0 0 24px" }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{props.icon || "🔌"}</span>
          </div>
          <div style={{ fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap" }}>{props.name}</div>
        </div>
        <p className="muted" style={{ margin: 0 }}>{props.description}</p>
        <div className="chips" style={{ marginTop: 12 }}>
          {props.tags.map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
        <div className="row" style={{ marginTop: "auto", paddingTop: 12, justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted">{props.apisCount} APIs available</span>
          <div className="row">
            <button className="button" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Hide APIs" : "View APIs"}
            </button>
            <button
              className={"button " + (added ? "" : "primary")}
              onClick={() => setAdded((v) => !v)}
            >
              {added ? "Added" : "+ Add"}
            </button>
          </div>
        </div>
        {expanded && (
          <div style={{ marginTop: 12 }}>
            <div className="card" style={{ background: "var(--muted)", borderColor: "var(--muted)" }}>
              <div className="card-body">
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {(props.apis || []).map((a) => (
                    <li key={a.name} style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>{a.name}</div>
                      <div className="muted">{a.description}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApiGalleryPage() {
  const [query, setQuery] = React.useState("");
  const [activeCats, setActiveCats] = React.useState<string[]>([]);
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const toggleCat = (c: string) => {
    setActiveCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  return (
    <div className="app-shell">
      <Navbar />
      <AppSidebar />
      <main className="pane" style={{ padding: 16, maxWidth: 1100, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>API Gallery</h1>
              <p className="label" style={{ marginTop: 8 }}>Browse and integrate API providers into your system</p>
            </div>
            <div className="pill pill-info">2 providers available</div>
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: 16,
              marginTop: 12,
              alignItems: "start",
              justifyItems: "stretch",
              alignContent: "start",
            }}
          >
            <ProviderCard
              name="OpenAI"
              icon="🤖"
              description="Leading AI company providing GPT models and advanced language capabilities."
              tags={["AI/ML", "Text Generation", "Conversation"]}
              apisCount={2}
              initiallyAdded
              apis={[
                { name: "Chat Completions", description: "Generate conversational responses with GPT models." },
                { name: "Embeddings", description: "Create vector embeddings for search and retrieval." },
              ]}
            />
            <ProviderCard
              name="Anthropic"
              icon="🧠"
              description="AI safety company creating helpful, harmless, and honest AI systems like Claude."
              tags={["AI/ML", "Conversation", "Analysis"]}
              apisCount={2}
              apis={[
                { name: "Messages API", description: "Chat with Claude for safe and helpful responses." },
                { name: "Tool Use", description: "Structured tool calling for complex workflows." },
              ]}
            />
          </div>
      </main>
    </div>
  );
}
