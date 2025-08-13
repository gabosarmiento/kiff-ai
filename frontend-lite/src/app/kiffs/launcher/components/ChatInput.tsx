"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Attachment } from "../types";

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isGenerating,
  autoFocus = false,
  inputRef,
  attachments = [],
  onAddFiles,
  onRemoveAttachment,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  attachments?: Attachment[];
  onAddFiles?: (files: File[]) => void;
  onRemoveAttachment?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Auto-resize logic up to 15 lines, then enable scroll
  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Reset height to compute scrollHeight accurately
    ta.style.height = "auto";
    const styles = window.getComputedStyle(ta);
    const lineHeight = parseFloat(styles.lineHeight || "20");
    const paddingTop = parseFloat(styles.paddingTop || "0");
    const paddingBottom = parseFloat(styles.paddingBottom || "0");
    const maxLines = 15;
    const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;
    const next = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  // Adjust on mount and whenever value changes
  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  // Focus on mount/open
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      setExpanded(true);
      // Ensure height correct after focus paint
      requestAnimationFrame(() => adjustHeight());
    }
  }, [autoFocus]);

  // Expose textarea ref to parent if provided
  useEffect(() => {
    if (inputRef && textareaRef.current) {
      (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = textareaRef.current;
    }
  }, [inputRef]);

  // Expand on focus
  const handleFocus = () => {
    setExpanded(true);
    // Resize when expanding
    adjustHeight();
  };

  // Collapse on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const c = containerRef.current;
      if (!c) return;
      if (!c.contains(e.target as Node)) {
        setExpanded(false);
        // Collapse to single line
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = "40px";
          ta.style.overflowY = "hidden";
        }
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Drag & drop support
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onAddFiles) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onAddFiles(files);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Paste images/files
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onAddFiles) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of items as any) {
      if (it.kind === "file") {
        const f = it.getAsFile?.();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      onAddFiles(files);
    }
  };

  return (
    <div ref={containerRef} className="p-3 border-t border-gray-200" onDrop={handleDrop} onDragOver={handleDragOver}>
      {!!attachments.length && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((a, idx) => (
            <div key={idx} className="flex items-center gap-2 px-2 py-1 rounded-full border bg-gray-50 text-gray-800 text-xs">
              <span className="max-w-[180px] truncate" title={`${a.name} (${(a.size/1024).toFixed(1)} KB)`}>
                {a.name}
              </span>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => onRemoveAttachment && onRemoveAttachment(idx)}
                aria-label={`Remove ${a.name}`}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          className={`flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none w-full ${
            expanded ? "min-h-[40px]" : "min-h-[40px]"
          }`}
          placeholder="Describe what you want to build..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            adjustHeight();
          }}
          onFocus={handleFocus}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape") {
              (e.currentTarget as HTMLTextAreaElement).blur();
            }
          }}
          disabled={isGenerating}
          rows={1}
          aria-label="Message input"
        />
        <div className="flex flex-col items-end gap-1 min-w-[88px]">
          <div className="text-[11px] text-gray-500 select-none">{value.length}/4000</div>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={onSubmit}
          disabled={isGenerating || !value.trim()}
        >
          {isGenerating ? "Thinking..." : "Send"}
        </button>
        </div>
      </div>
    </div>
  );
}
