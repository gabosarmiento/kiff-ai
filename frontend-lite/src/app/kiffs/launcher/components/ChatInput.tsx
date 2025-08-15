"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Attachment } from "../types";
import { ArrowRight } from "lucide-react";


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
  modelOptions = [],
  model,
  onModelChange,
  isModelMenuOpen,
  setModelMenuOpen,
  modelMenuRef,
  modelHighlight,
  setModelHighlight,
  modelTypeahead,
  setModelTypeahead,
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
  modelOptions?: string[];
  model?: string;
  onModelChange?: (model: string) => void;
  isModelMenuOpen?: boolean;
  setModelMenuOpen?: (open: boolean) => void;
  modelMenuRef?: React.RefObject<HTMLDivElement>;
  modelHighlight?: number | null;
  setModelHighlight?: (highlight: number | null) => void;
  modelTypeahead?: string;
  setModelTypeahead?: (typeahead: string) => void;
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
        {modelOptions && modelOptions.length > 0 && (
          <div className="relative min-w-[180px] max-w-[220px] mr-2 flex-shrink-0" ref={modelMenuRef}>
            <div
              role="combobox"
              aria-expanded={isModelMenuOpen ? 'true' : 'false'}
              aria-controls="model-listbox"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  setModelMenuOpen && setModelMenuOpen(true);
                  setTimeout(() => {
                    const el = document.getElementById('model-listbox');
                    el?.focus();
                  }, 0);
                }
              }}
              onClick={() => setModelMenuOpen && setModelMenuOpen(!(isModelMenuOpen || false))}
              className="cursor-pointer select-none rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              aria-label="Model selector"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium leading-tight">{model}</div>
                  <div className="truncate text-[10px] leading-tight text-slate-500">Choose the AI model</div>
                </div>
                <svg
                  className={`h-3.5 w-3.5 text-slate-500 transition-transform ${(isModelMenuOpen ? 'rotate-180' : '')}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.084l3.71-3.853a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z" />
                </svg>
              </div>
            </div>
            {isModelMenuOpen && (
              <div
                role="listbox"
                id="model-listbox"
                tabIndex={-1}
                aria-label="Models"
                className="absolute z-20 mt-1 w-[min(300px,90vw)] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setModelMenuOpen && setModelMenuOpen(false); return; }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setModelHighlight && setModelHighlight(Math.min(((modelHighlight ?? -1) + 1), modelOptions.length - 1)); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setModelHighlight && setModelHighlight(Math.max(((modelHighlight ?? modelOptions.length) - 1), 0)); return; }
                  if (e.key === 'Home') { e.preventDefault(); setModelHighlight && setModelHighlight(0); return; }
                  if (e.key === 'End') { e.preventDefault(); setModelHighlight && setModelHighlight(modelOptions.length - 1); return; }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const idx = modelHighlight ?? 0;
                    const sel = modelOptions[idx];
                    if (sel && onModelChange) { onModelChange(sel); setModelMenuOpen && setModelMenuOpen(false); }
                    return;
                  }
                  // simple typeahead
                  const ch = e.key?.toLowerCase();
                  if (ch && ch.length === 1 && /[a-z0-9_\-./]/.test(ch)) {
                    setModelTypeahead && setModelTypeahead(((modelTypeahead || '') + ch).slice(-32));
                    const idx = modelOptions.findIndex((m) => m.toLowerCase().startsWith(((modelTypeahead || '') + ch)));
                    if (idx >= 0) setModelHighlight && setModelHighlight(idx);
                  }
                }}
              >
                {modelOptions.map((m, i) => (
                  <div
                    role="option"
                    aria-selected={m === model}
                    key={m}
                    onMouseEnter={() => setModelHighlight && setModelHighlight(i)}
                    onMouseDown={(e) => { e.preventDefault(); }}
                    onClick={() => { onModelChange && onModelChange(m); setModelMenuOpen && setModelMenuOpen(false); }}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer ${i === modelHighlight ? 'bg-slate-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium leading-tight">{m}</div>
                      <div className="truncate text-[10px] leading-tight text-slate-500">General-purpose model</div>
                    </div>
                    {m === model && (
                      <svg className="h-3.5 w-3.5 text-blue-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3-3a1 1 0 011.42-1.42l2.29 2.29 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            className={`flex-1 border border-gray-300 rounded px-3 py-2 pr-12 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none w-full ${
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
          {/* Mobile inline send button */}
          <button
            className="sm:hidden absolute right-2 bottom-2 h-8 w-8 inline-flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50"
            onClick={onSubmit}
            disabled={isGenerating || !value.trim()}
            aria-label="Send"
            title="Send"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {/* Desktop controls */}
        <div className="hidden sm:flex flex-col items-end gap-1 min-w-[88px]">
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
