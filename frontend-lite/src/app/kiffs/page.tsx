"use client";
import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";
import { apiJson, apiFetch } from "@/lib/api";
import PageContainer from "@/components/ui/PageContainer";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Trash } from "lucide-react";

// Icon wrapper to avoid JSX typing issues with lucide-react in this setup
const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) =>
  React.createElement(Trash as any, props as any);

interface KiffItem { id: string; name: string; created_at?: string; content_preview?: string }

export default function KiffsIndexPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const [kiffs, setKiffs] = React.useState<KiffItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  // Delete confirmation modal state
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [targetKiff, setTargetKiff] = React.useState<KiffItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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
      <main className="pane pane-with-sidebar" style={{ padding: 16, paddingLeft: leftWidth + 24, margin: "0 auto", maxWidth: 1200 }}>
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
              <div className="mt-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-900">All Kiffs</h3>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1fr,16rem]">
                  {/* Left: Kiffs List */}
                  <div className="space-y-4">
                    <div className="text-xs text-slate-500">{kiffs.length} total</div>
                    {kiffs.map((k) => (
                      <div key={k.id} className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 pt-8 pr-24 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors gap-4 sm:gap-6">
                        <span className="absolute top-3 right-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Active</span>
                        <div className="flex-1 mb-1 sm:mb-0 pr-2 sm:pr-20">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-base font-semibold text-slate-900">{k.name || k.id}</h4>
                          </div>
                          {k.created_at && (
                            <p className="text-sm text-slate-500">Created {new Date(k.created_at).toLocaleDateString()}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 sm:pr-2">
                          <a
                            href={`/kiffs/${k.id}`}
                            className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors text-center"
                          >
                            Open
                          </a>
                          <button
                            onClick={() => { setTargetKiff(k); setDeleteOpen(true); }}
                            className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right: New Kiff Button - fixed square */}
                  <div className="flex justify-center lg:justify-start">
                    <a
                      href="/kiffs/compose"
                      className="flex h-32 w-full max-w-xs lg:h-64 lg:w-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <button className="rounded-lg px-4 py-2 text-base font-medium text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">+ New Kiff</button>
                      <div className="mt-3 text-sm text-slate-600 text-center px-2">Start composing a new integration</div>
                    </a>
                  </div>
                </div>
              </div>
            )
          )}
        </PageContainer>
        {/* Protected Delete Modal */}
        <ConfirmModal
          open={deleteOpen}
          title="Delete Kiff"
          message={targetKiff ? `Type "${targetKiff.name || targetKiff.id}" to confirm. This action is irreversible.` : "This action is irreversible."}
          confirmText={deleting ? "Deleting…" : "Delete"}
          cancelText="Cancel"
          confirmMatch={targetKiff ? (targetKiff.name || targetKiff.id) : undefined}
          onCancel={() => { if (!deleting) { setDeleteOpen(false); setTargetKiff(null); } }}
          onConfirm={async () => {
            if (!targetKiff) return;
            try {
              setDeleting(true);
              const res = await apiFetch(`/api/kiffs/${encodeURIComponent(targetKiff.id)}`, { method: 'DELETE' });
              if (!res.ok) {
                const msg = await res.text().catch(() => 'Failed to delete');
                throw new Error(msg || `HTTP ${res.status}`);
              }
              // Optimistically remove from list
              setKiffs((prev) => prev.filter((x) => x.id !== targetKiff.id));
              setDeleteOpen(false);
              setTargetKiff(null);
            } catch (e: any) {
              alert(e?.message || 'Failed to delete');
            } finally {
              setDeleting(false);
            }
          }}
        />
      </main>
      <BottomNav />
    </div>
  );
}
