"use client";
import React from "react";
import Image from "next/image";
import { Navbar } from "../../components/layout/Navbar";
import { Sidebar } from "../../components/navigation/Sidebar";
import { BottomNav } from "../../components/navigation/BottomNav";
import { useLayoutState } from "../../components/layout/LayoutState";
import { listKBs } from "../../lib/api";

// We still use the KB backend types/endpoints; UI wording is "Kiff Packs"
type KB = { id: string; name: string; created_at?: number; vectors?: number };

export default function KiffPacksPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  const [kbs, setKbs] = React.useState<KB[]>([]);
  const [selectedKbId, setSelectedKbId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await listKBs();
        if (!mounted) return;
        setKbs(list);
        if (!selectedKbId && list.length) setSelectedKbId(list[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mainStyle: React.CSSProperties = {
    maxWidth: 1200,
    paddingLeft: leftWidth + 24,
    margin: "0 auto",
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main 
        className="pane pane-with-sidebar px-4 pt-10 md:pt-6 pb-24 overflow-x-hidden"
        style={mainStyle}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="m-0 text-xl font-semibold">Kiff Packs</h1>
            <p className="label mt-2">Create and manage your Kiff Packs.</p>
          </div>
        </div>

        <div className="mt-4">
          {kbs.length === 0 ? (
            <div className="mt-10 flex min-h-[40vh] items-center justify-center">
              <div className="flex h-80 w-80 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-700">
                <div className="flex w-full flex-col items-center gap-2">
                  <a
                    href="/api-gallery"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                  >
                    Open API Gallery
                  </a>
                  <a
                    href="/kiffs/launcher"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
                  >
                    Go to Compose
                  </a>
                </div>
                <div className="mt-3 text-center text-xs text-slate-600">
                  Add APIs to your pack, then compose with that knowledge.
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="font-semibold">Your Kiff Packs</div>
                  <span className="pill pill-info">{kbs.length}</span>
                </div>
                <ul className="divide-y divide-base-200 mt-2">
                  {kbs.map((kb) => (
                    <li key={kb.id} className="py-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{kb.name}</div>
                        <div className="text-xs text-base-content/60">
                          {kb.vectors ? `${kb.vectors} vectors` : 'Vectors unknown'}
                          {kb.created_at ? ` • ${new Date(kb.created_at).toLocaleString()}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
