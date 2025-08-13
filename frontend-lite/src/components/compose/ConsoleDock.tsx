"use client";
import React from "react";
import { useComposeUi } from "./composeUiStore";
import { Terminal, ChevronUp, ChevronDown } from "lucide-react";

// Icon wrapper to avoid JSX typing issues (matches BottomNav pattern)
const wrap = (C: any) => {
  const W: React.FC<React.SVGProps<SVGSVGElement>> = (props) => React.createElement(C as any, props as any);
  W.displayName = `${C?.displayName || C?.name || "Icon"}Wrapper`;
  return W;
};
const TerminalIcon = wrap(Terminal);
const ChevronUpIcon = wrap(ChevronUp);
const ChevronDownIcon = wrap(ChevronDown);

export function ConsoleDock(props: {
  onExec?: (cmd: string) => Promise<void> | void;
  logs?: string;
}){
  const { consoleOpen, toggleConsole } = useComposeUi();
  const [cmd, setCmd] = React.useState("");

  function submit(e: React.FormEvent){
    e.preventDefault();
    const v = cmd.trim();
    if (!v) return;
    try { props.onExec && props.onExec(v); } catch {}
    setCmd("");
  }

  return (
    <div className="fixed right-3 bottom-3 z-40 w-full max-w-3xl">
      <div className="ml-auto rounded-xl border bg-white shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            <TerminalIcon className="h-4 w-4"/> Console
          </div>
          <button className="button" onClick={toggleConsole}>
            {consoleOpen ? (<span className="inline-flex items-center gap-1"><ChevronDownIcon className="h-4 w-4"/> Hide</span>) : (<span className="inline-flex items-center gap-1"><ChevronUpIcon className="h-4 w-4"/> Show</span>)}
          </button>
        </div>
        {consoleOpen && (
          <div className="p-2 grid gap-2">
            <pre className="text-xs font-mono bg-gray-50 p-2 rounded h-36 overflow-auto whitespace-pre-wrap">{props.logs || 'No output yet.'}</pre>
            <form onSubmit={submit} className="flex items-center gap-2">
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                placeholder="Type a command and press Ctrl+Enter"
                className="flex-1 h-9 rounded-md border px-3 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    const v = cmd.trim();
                    if (v) { try { props.onExec && props.onExec(v); } catch {}; setCmd(''); }
                  }
                }}
              />
              <button type="submit" className="button primary">Run</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConsoleDock;
