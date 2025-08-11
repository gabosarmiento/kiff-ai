"use client";
import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";
import { KiffComposePanel } from "@/components/kiffs/KiffComposePanel";
import { apiJson } from "@/lib/api";

export default function KiffComposerPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  type BagItem = {
    api_service_id: string;
    api_name?: string;
    provider_name?: string;
  };
  const [bag, setBag] = React.useState<BagItem[]>([]);
  const [bagLoading, setBagLoading] = React.useState<boolean>(false);
  const [editOpen, setEditOpen] = React.useState<boolean>(false);

  async function refreshBag() {
    try {
      setBagLoading(true);
      const items = await apiJson<any[]>("/api-gallery/bag", { method: "GET" });
      const mapped: BagItem[] = (items || []).map((it: any) => ({
        api_service_id: String(it.api_service_id || it.id || ""),
        api_name: it.name || it.api_name,
        provider_name: it.provider_name,
      })).filter(x => x.api_service_id);
      setBag(mapped);
    } catch (e) {
      console.warn("compose: failed to load bag", e);
      setBag([]);
    } finally {
      setBagLoading(false);
    }
  }

  async function removeFromBag(api_service_id: string) {
    await apiJson(`/api-gallery/bag/${encodeURIComponent(api_service_id)}`, { method: "DELETE" });
    await refreshBag();
  }

  async function clearBag() {
    await apiJson(`/api-gallery/bag`, { method: "DELETE" });
    await refreshBag();
  }

  React.useEffect(() => {
    refreshBag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main
        className="pane pane-with-sidebar"
        style={{ padding: 16, maxWidth: 1200, paddingLeft: leftWidth + 24, margin: "0 auto", overflowX: "hidden", paddingBottom: 96 }}
      >
        {/* Selected APIs chips */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ padding: 12 }}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="label">Selected APIs</span>
                <span className="pill pill-info">{bagLoading ? "Loading…" : `${bag.length}`}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="button" onClick={() => setEditOpen(true)}>Edit</button>
              </div>
            </div>
            <div className="chips" style={{ marginTop: 8 }}>
              {bag.length === 0 && !bagLoading ? (
                <span className="muted">No APIs selected. Use the API Gallery to add some.</span>
              ) : (
                bag.map((it) => (
                  <span key={it.api_service_id} className="chip">
                    {it.api_name || it.api_service_id}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <KiffComposePanel />
      </main>
      <BottomNav />
      {/* Edit modal to manage Kiff Packs */}
      <EditBagModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        bag={bag}
        bagLoading={bagLoading}
        onRemove={removeFromBag}
        onClear={clearBag}
      />
    </div>
  );
}

// Inline Edit modal to manage Kiff Packs on the Compose page
function EditBagModal(props: {
  open: boolean;
  onClose: () => void;
  bag: Array<{ api_service_id: string; api_name?: string; provider_name?: string }>;
  bagLoading: boolean;
  onRemove: (api_service_id: string) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between p-3">
          <div className="font-semibold">Edit Kiff Packs</div>
          <button className="button" onClick={props.onClose}>Close</button>
        </div>
        <div className="px-3 pb-3">
          {props.bagLoading ? (
            <div className="muted text-sm p-3">Loading…</div>
          ) : props.bag.length === 0 ? (
            <div className="muted text-sm p-3">No APIs selected. Use the API Gallery to add some.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {props.bag.map((it) => (
                <li key={it.api_service_id} className="flex items-center gap-3 p-3">
                  <div className="h-6 w-6 rounded bg-white ring-1 ring-slate-200 text-xs flex items-center justify-center">
                    <span>🔌</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.api_name || it.api_service_id}</div>
                    {it.provider_name ? (
                      <div className="truncate text-xs text-slate-500">{it.provider_name}</div>
                    ) : null}
                  </div>
                  <button className="button" onClick={() => props.onRemove(it.api_service_id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-3">
          <button className="button" onClick={props.onClear} disabled={props.bag.length === 0}>Clear</button>
          <button className="button primary" onClick={props.onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

