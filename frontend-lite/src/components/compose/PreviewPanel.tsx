"use client";
import React from "react";
import { useComposeUi } from "./composeUiStore";
import { SandboxPreview } from "./SandboxPreview";
import { BuildProgress, type BuildEvent } from "./BuildProgress";
import { FileCode2, PlayCircle, List } from "lucide-react";

// Icon wrapper to avoid JSX typing issues
const wrap = (C: any) => {
  const W: React.FC<React.SVGProps<SVGSVGElement>> = (props) => React.createElement(C as any, props as any);
  W.displayName = `${C?.displayName || C?.name || "Icon"}Wrapper`;
  return W;
};
const FileCode2Icon = wrap(FileCode2);
const PlayCircleIcon = wrap(PlayCircle);
const ListIcon = wrap(List);

export function PreviewPanel(props: {
  sessionId?: string | null;
  previewUrl?: string | null;
  status?: string;
  logs?: string;
  events?: BuildEvent[];
  busy?: boolean;
  onOpen?: () => void;
  onRestart?: () => void;
  className?: string;

}){
  const { selectedTab, setTab } = useComposeUi();

  const tabs: Array<{ id: 'code'|'run'|'logs'; label: string; icon: React.ReactNode }>= [
    { id: 'code', label: 'Code', icon: <FileCode2Icon className="h-4 w-4"/> },
    { id: 'run', label: 'Run', icon: <PlayCircleIcon className="h-4 w-4"/> },
    { id: 'logs', label: 'Logs', icon: <ListIcon className="h-4 w-4"/> },
  ];

  return (
    <section className={("rounded border bg-white "+(props.className||""))}>
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border ${selectedTab===t.id? 'bg-blue-50 text-blue-700 border-blue-200':'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'}`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500">{props.sessionId ? `Session ${props.sessionId.slice(0,6)}…` : 'No session'}</div>
      </div>

      {selectedTab === 'code' && (
        <div className="p-2 text-sm text-gray-500">No code explorer in this panel.</div>
      )}

      {selectedTab === 'run' && (
        <div className="p-2">
          <SandboxPreview previewUrl={props.previewUrl} status={props.status} onOpen={props.onOpen} />
        </div>
      )}

      {selectedTab === 'logs' && (
        <div className="p-2 grid gap-2">
          <BuildProgress events={props.events || []} busy={props.busy} onRestart={props.onRestart} />
          {props.logs ? (
            <div className="rounded border">
              <div className="px-3 py-2 text-sm border-b font-medium">Runtime Logs</div>
              <pre className="text-xs font-mono bg-gray-50 p-2 rounded h-56 overflow-auto whitespace-pre-wrap">{props.logs}</pre>
            </div>
          ): null}
        </div>
      )}
    </section>
  );
}

export default PreviewPanel;
