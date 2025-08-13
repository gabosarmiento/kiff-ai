"use client";

import React, { useMemo, useState, useCallback } from "react";
import { Folder, FileText, ChevronRight, ChevronDown } from "lucide-react";

export type FileNode = {
  name: string;
  path: string;
  children?: FileNode[];
  isDir: boolean;
};

function buildTree(paths: string[]): FileNode[] {
  const root: Record<string, any> = {};
  for (const p of paths) {
    const parts = p.split("/");
    let cur = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isLast = i === parts.length - 1;
      cur.children = cur.children || {};
      if (!cur.children[part]) cur.children[part] = { name: part, path: acc, isDir: !isLast };
      cur = cur.children[part];
    }
  }
  const toArray = (nodeMap: Record<string, any>): FileNode[] =>
    Object.values(nodeMap)
      .map((n: any) => ({
        name: n.name,
        path: n.path,
        isDir: !!n.isDir,
        children: n.children ? toArray(n.children) : undefined,
      }))
      .sort((a: FileNode, b: FileNode) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  return root.children ? toArray(root.children) : [];
}

export default function FileExplorer({
  files,
  onSelect,
  selectedPath,
  className,
}: {
  files: string[];
  onSelect: (path: string) => void;
  selectedPath?: string | null;
  className?: string;
}) {
  const tree = useMemo(() => buildTree(files || []), [files]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = useCallback((path: string) => {
    setExpanded((e) => ({ ...e, [path]: !e[path] }));
  }, []);

  const Node = ({ node, depth = 0 }: { node: FileNode; depth?: number }) => {
    const isSelected = selectedPath === node.path;
    const isOpen = !!expanded[node.path];
    return (
      <div>
        <div className="group">
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
              isSelected && !node.isDir ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
            }`}
            style={{ paddingLeft: depth * 12 + 8 }}
            onClick={() => {
              if (node.isDir) {
                toggle(node.path);
              } else {
                onSelect(node.path);
              }
            }}
          >
            {node.isDir ? (
              <>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <Folder className="w-4 h-4 text-amber-600" />
              </>
            ) : (
              <>
                <span className="w-4 h-4 inline-block" />
                <FileText className="w-4 h-4 text-gray-500" />
              </>
            )}
            <span className="text-sm truncate" title={node.path}>{node.name}</span>
          </div>
        </div>
        {node.children && isOpen && node.children.map((c) => (
          <Node key={c.path} node={c} depth={(depth || 0) + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className={`h-full overflow-auto ${className || ""}`}>
      {tree.length === 0 ? (
        <div className="text-sm text-gray-500 p-3">No files yet</div>
      ) : (
        tree.map((n) => (
          <Node key={n.path} node={n} />
        ))
      )}
    </div>
  );
}
