"use client";
import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { useLayoutState } from "@/components/layout/LayoutState";
import { apiJson } from "@/lib/api";
import PageContainer from "@/components/ui/PageContainer";

interface KiffItem { id: string; name: string; created_at?: string; content_preview?: string }

export default function KiffsIndexPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const [kiffs, setKiffs] = React.useState<KiffItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      async function tryList(): Promise<KiffItem[] | null> {
        // 1) Preferred: GET /api/kiffs
        try {
          const list = await apiJson<KiffItem[]>("/api/kiffs", { method: "GET" });
          return Array.isArray(list) ? list : [];
        } catch (err: any) {
          if (!String(err?.message || "").includes("405")) throw err;
        }
        // 2) Alternate trailing slash variant
        try {
          const list = await apiJson<KiffItem[]>("/api/kiffs/", { method: "GET" });
          return Array.isArray(list) ? list : [];
        } catch (err: any) {
          if (!String(err?.message || "").includes("405")) throw err;
        }
        // 3) Some backends use a list/search route
        try {
          const list = await apiJson<KiffItem[]>("/api/kiffs/list", { method: "POST", body: {} as any });
          return Array.isArray(list) ? list : [];
        } catch (err: any) {
          // fallthrough
        }
        return null;
      }
      try {
        const result = await tryList();
        if (result) setKiffs(result);
        else setError("Listing endpoint not found. Backend may not expose GET /api/kiffs.\nTry adding GET /api/kiffs or POST /api/kiffs/list.");
      } catch (e: any) {
        setError(e?.message || "Failed to load kiffs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane" style={{ padding: 16, paddingLeft: leftWidth + 24, margin: "0 auto", maxWidth: 1200 }}>
        <PageContainer padded>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-lg font-semibold">Kiffs</h2>
              <p className="mt-1 text-sm text-slate-600">Your saved integrations. Click to open, or create a new one.</p>
            </div>
          </div>

          {loading && <div className="mt-6 text-sm text-slate-600">Loading…</div>}
          {error && <div className="mt-6 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

          {!loading && !error && (
            kiffs.length === 0 ? (
              <div className="mt-10 flex min-h-[40vh] items-center justify-center">
                <a
                  href="/kiffs/compose"
                  className="flex h-80 w-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-700 hover:bg-slate-50"
                >
                  <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm">+ New Kiff</button>
                  <div className="mt-3 text-xs text-slate-600">Start composing a new integration</div>
                </a>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <a
                  href="/kiffs/compose"
                  className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm">+ New Kiff</button>
                  <div className="mt-2 text-xs text-slate-600">Start composing a new integration</div>
                </a>
                {kiffs.map((k) => (
                  <a key={k.id} href={`/kiffs/${k.id}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:bg-slate-50">
                    <div className="text-sm font-semibold">{k.name || k.id}</div>
                    {k.created_at && (
                      <div className="text-xs text-slate-500">{new Date(k.created_at).toLocaleString()}</div>
                    )}
                    {k.content_preview && (
                      <div className="mt-2 line-clamp-3 text-xs text-slate-700">{k.content_preview}</div>
                    )}
                  </a>
                ))}
              </div>
            )
          )}
        </PageContainer>
      </main>
    </div>
  );
}
