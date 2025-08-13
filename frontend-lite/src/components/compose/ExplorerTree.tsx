"use client";
import React from "react";

export type TreeFile = { path: string; size: number };

function groupByDir(files: TreeFile[]) {
  const root: any = { name: '', type: 'dir', children: new Map<string, any>() };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        node.children.set(part, { name: part, type: 'file', path: f.path, size: f.size });
      } else {
        if (!node.children.has(part)) node.children.set(part, { name: part, type: 'dir', children: new Map<string, any>() });
        node = node.children.get(part);
      }
    }
  }
  return root;
}

export function ExplorerTree(props: {
  files: TreeFile[];
  selected?: string | null;
  onSelect: (path: string) => void;
  className?: string;
}){
  const [open, setOpen] = React.useState<Record<string, boolean>>({ 'src': true });
  const tree = React.useMemo(() => groupByDir(props.files), [props.files]);

  function NodeView({ node, base }: { node: any; base: string }){
    const entries = Array.from(node.children.entries());
    entries.sort((a: any, b: any) => {
      if (a[1].type === b[1].type) return a[0].localeCompare(b[0]);
      return a[1].type === 'dir' ? -1 : 1;
    });
    return (
      <div className="pl-2">
        {entries.map(([name, child]) => {
          if (child.type === 'dir') {
            const key = (base ? base + '/' : '') + name;
            const isOpen = open[key] ?? false;
            return (
              <div key={key}>
                <div
                  className="flex items-center gap-2 text-xs cursor-pointer select-none hover:bg-gray-50 rounded px-1 py-0.5"
                  onClick={() => setOpen(o => ({ ...o, [key]: !isOpen }))}
                >
                  <span className="inline-block w-3 text-gray-500">{isOpen ? '▾' : '▸'}</span>
                  <span className="font-medium text-gray-700">{name}</span>
                </div>
                {isOpen && <NodeView node={child} base={key} />}
              </div>
            );
          }
          const filePath = child.path as string;
          const active = props.selected === filePath;
          return (
            <button
              key={filePath}
              className={`w-full text-left text-xs px-4 py-0.5 rounded hover:bg-gray-50 ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              onClick={() => props.onSelect(filePath)}
              title={filePath}
            >
              {name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={("rounded border "+(props.className||""))}>
      <div className="px-3 py-2 text-sm border-b font-medium">Explorer</div>
      <div className="h-60 overflow-auto p-1">
        {props.files.length === 0 ? (
          <div className="text-xs text-gray-500 p-2">No files yet.</div>
        ) : (
          <NodeView node={tree} base="" />
        )}
      </div>
    </div>
  );
}

export default ExplorerTree;
