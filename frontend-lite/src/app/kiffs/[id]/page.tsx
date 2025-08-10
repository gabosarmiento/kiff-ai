"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Navbar } from "../../../components/layout/Navbar";
import { Sidebar } from "../../../components/navigation/Sidebar";
import { useLayoutState } from "../../../components/layout/LayoutState";
import { apiJson } from "../../../lib/api";

export default function KiffRunPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const [prompt, setPrompt] = React.useState("Explain how to create and charge a customer in Stripe.");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  const run = async () => {
    if (!id) return;
    setRunning(true);
    try {
      const resp = await apiJson(`/api/kiffs/${id}/run`, {
        method: "POST",
        asJson: true,
        body: { prompt },
      } as any);
      setResult(resp);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane" style={{ padding: 16, maxWidth: 1100, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>Kiff Sandbox</h1>
              <p className="label" style={{ marginTop: 8 }}>Kiff ID: {id}</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-body">
              <textarea className="input" style={{ height: 120 }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <button className="button primary" onClick={run} disabled={running}>{running ? "Running..." : "Run"}</button>
              </div>
            </div>
          </div>

          {result && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-body">
                <div className="label">Output</div>
                <pre style={{ whiteSpace: "pre-wrap" }}>{result.output}</pre>
                {Array.isArray(result.retrieved) && result.retrieved.length > 0 && (
                  <>
                    <div className="label" style={{ marginTop: 12 }}>Retrieved Chunks</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {result.retrieved.map((r: any, i: number) => (
                        <li key={i} style={{ marginBottom: 8 }}>
                          <div className="muted" style={{ fontSize: 12 }}>{r.url}</div>
                          <div>{(r.text || "").slice(0, 400)}{(r.text || "").length > 400 ? "…" : ""}</div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
