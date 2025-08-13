"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Navbar } from "../../../components/layout/Navbar";
import { Sidebar } from "../../../components/navigation/Sidebar";
import { BottomNav } from "../../../components/navigation/BottomNav";
import { useLayoutState } from "../../../components/layout/LayoutState";
import { apiJson } from "../../../lib/api";
import { getTenantId } from "../../../lib/tenant";

import PreviewPane from "../launcher/components/PreviewPane";

export default function KiffRunPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const [prompt, setPrompt] = React.useState("Explain how to create and charge a customer in Stripe.");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  // Preview state
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  // Handler to load preview
  const loadPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewUrl(null);
    try {
      // You may need to adjust this endpoint to match your backend
      const resp = await apiJson(`/api/preview/sandbox`, {
        method: "POST",
        asJson: true,
        body: { session_id: id }, // assumes backend expects session_id as kiff id
        headers: { "X-Tenant-ID": getTenantId() },
      } as any) as { preview_url?: string };
      if (resp && resp.preview_url) {
        setPreviewUrl(resp.preview_url);
      } else {
        setPreviewError("No preview URL returned.");
      }
    } catch (e: any) {
      setPreviewError(e?.message || "Failed to load preview");
    } finally {
      setLoadingPreview(false);
    }
  };

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
      <main className="pane pane-with-sidebar" style={{ padding: 16, maxWidth: 1100, paddingLeft: leftWidth + 24, margin: "0 auto" }}>
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
        {/* --- Preview Sandbox Test --- */}
        <div className="card" style={{ marginTop: 32 }}>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="button primary" onClick={loadPreview} disabled={loadingPreview}>
                {loadingPreview ? "Loading Preview..." : "Load Preview Sandbox"}
              </button>
              {previewError && <span style={{ color: 'red', fontSize: 13 }}>{previewError}</span>}
            </div>
            {previewUrl && (
              <div style={{ marginTop: 18 }}>
                <PreviewPane previewUrl={previewUrl} />
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
