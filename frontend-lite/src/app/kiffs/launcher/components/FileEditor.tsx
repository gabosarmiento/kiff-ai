"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export default function FileEditor({
  path,
  content,
  onChange,
  onSave,
  readOnly,
  className,
}: {
  path?: string | null;
  content: string;
  onChange?: (v: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="text-sm text-gray-600 truncate">{path || "No file selected"}</div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!onSave || readOnly}
            onClick={() => onSave && onSave()}
          >
            Save
          </Button>
        </div>
      </div>
      <textarea
        className="flex-1 p-3 text-sm font-mono outline-none resize-none"
        value={content}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={path ? "" : "Select a file to view its contents"}
      />
    </div>
  );
}
