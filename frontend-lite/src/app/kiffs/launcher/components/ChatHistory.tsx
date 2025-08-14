"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { ChatMessage } from "../types";

type Props = {
  messages: ChatMessage[];
  onRetryAssistant?: (assistantIndex: number) => void;
  onEditLastUser?: (content: string) => void;
  onApproveProposal?: (proposalId: string) => void;
  onRejectProposal?: (proposalId: string) => void;
};

// Local component to render a single proposed change with optional diff toggle
function ChangeRow({ pid, index, label, path, diff }: { pid: string; index: number; label: string; path: string; diff?: string }) {
  const [open, setOpen] = React.useState(false);
  const hasDiff = typeof diff === 'string' && diff.length > 0;
  return (
    <li className="text-[11px]">
      <div className="flex items-center gap-1">
        <span className="inline-block w-12 text-gray-500">{label}</span>
        <span className="truncate flex-1">{path}</span>
        {hasDiff ? (
          <button
            className="ml-2 px-1.5 py-0.5 rounded border text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={`diff-${pid}-${index}`}
          >
            {open ? 'Hide diff' : 'View diff'}
          </button>
        ) : null}
      </div>
      {hasDiff && open ? (
        <div id={`diff-${pid}-${index}`} className="mt-1 border rounded bg-gray-50">
          <pre className="overflow-x-auto text-[11px] leading-5 p-2">
            <code>
              {diff}
            </code>
          </pre>
        </div>
      ) : null}
    </li>
  );
}

// Inline code renderer
function InlineCode({ className, children }: { className?: string; children: React.ReactNode }) {
  const text = String(children ?? "");
  return (
    <code className={`px-1 py-0.5 rounded bg-gray-100 text-gray-900 font-mono text-[0.9em] ${className || ""}`.trim()}>{text}</code>
  );
}

// Block code renderer used as a <pre> wrapper from react-markdown
function CodeBlock({ children }: { children: React.ReactNode }) {
  // react-markdown renders <pre><code class="language-xyz">content</code></pre>
  // We receive that structure as children here; extract the inner text and language
  let codeText = "";
  let language = "text";
  if (React.isValidElement(children)) {
    const child: any = children;
    const raw = child?.props?.children;
    if (typeof raw === "string") codeText = raw;
    else if (Array.isArray(raw) && typeof raw[0] === "string") codeText = raw[0];
    const match = /language-([\w-]+)/.exec(child?.props?.className || "");
    if (match?.[1]) language = match[1];
  } else if (Array.isArray(children) && children.length > 0) {
    const first: any = children[0];
    const raw = first?.props?.children;
    if (typeof raw === "string") codeText = raw;
    else if (Array.isArray(raw) && typeof raw[0] === "string") codeText = raw[0];
    const match = /language-([\w-]+)/.exec(first?.props?.className || "");
    if (match?.[1]) language = match[1];
  }
  const lines = useMemo(() => codeText.replace(/\n$/,"" ).split("\n"), [codeText]);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = codeText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Code copied");
    } catch {
      toast.error("Copy failed—press Ctrl/Cmd+C");
    }
  };

  return (
    <div className="relative group not-prose my-2 border border-gray-200 rounded bg-white">
      <div className="absolute left-2 top-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-mono">
        {language}
      </div>
      <button
        onClick={copy}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition text-xs px-2 py-1 rounded bg-gray-800 text-white"
        aria-label="Copy code"
      >
        Copy
      </button>
      <pre className="overflow-x-auto max-h-[480px] whitespace-pre border-t border-gray-200 mt-7">
        <code className="block font-mono text-[13px] leading-6">
          {lines.map((ln, i) => (
            <div key={i} className="min-w-full flex">
              <span className="select-none text-gray-400 w-10 pr-3 text-right">{i + 1}</span>
              <span className="flex-1 text-gray-900 overflow-x-auto">
                {ln.length ? ln : "\u00A0"}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

export default function ChatHistory({ messages, onRetryAssistant, onEditLastUser, onApproveProposal, onRejectProposal }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // When messages change, only autoscroll if user is at bottom.
  useEffect(() => {
    if (atBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      setPendingCount(0);
    } else {
      setPendingCount((c) => c + 1);
    }
  }, [messages, atBottom]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const nearBottom = distance < 120;
    setAtBottom(nearBottom);
    if (nearBottom) setPendingCount(0);
  }, []);

  const jumpToLatest = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setAtBottom(true);
    setPendingCount(0);
  }, []);

  const copyWhole = useCallback(async (md: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(md);
      } else {
        const ta = document.createElement("textarea");
        ta.value = md;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Copied");
    } catch {
      toast.error("Copy failed—press Ctrl/Cmd+C");
    }
  }, []);

  return (
    <div className="relative flex-1 min-h-0 bg-white dark:bg-neutral-900">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="overflow-y-auto p-4 space-y-3 h-full aria-live-polite bg-white dark:bg-neutral-900"
        aria-live="polite"
        aria-relevant="additions"
        role="log"
      >
        {!atBottom && pendingCount > 0 ? (
          <div className="sticky top-0 z-10 text-center text-xs text-gray-600 my-1">
            New replies below
          </div>
        ) : null}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const bubbleClasses = isUser
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-gray-50 text-gray-900 border-gray-200";
          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`relative group max-w-[80%] p-3 rounded-lg border ${bubbleClasses}`}>
                {!isUser ? (
                  <div className="absolute -top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      className="text-[10px] px-2 py-1 rounded bg-gray-800 text-white"
                      onClick={() => copyWhole(m.content)}
                      aria-label="Copy response"
                      title="Copy response"
                    >
                      Copy response
                    </button>
                    {onRetryAssistant ? (
                      <button
                        className="text-[10px] px-2 py-1 rounded bg-gray-700 text-white"
                        onClick={() => onRetryAssistant(i)}
                        aria-label="Retry"
                        title="Retry"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                ) : (
                  // Edit & resend for the most recent user message
                  i === messages.map((_, idx) => idx).filter((idx) => messages[idx].role === "user").slice(-1)[0] && onEditLastUser ? (
                    <div className="absolute -top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        className="text-[10px] px-2 py-1 rounded bg-gray-800 text-white"
                        onClick={() => onEditLastUser(m.content)}
                        aria-label="Edit & resend"
                        title="Edit & resend"
                      >
                        Edit & resend
                      </button>
                    </div>
                  ) : null
                )}

                {m.tool_calls?.length ? (
                  <div className="mb-2 text-xs opacity-75">
                    🔧 {m.tool_calls.map((t) => String((t as any).function?.name || "tool")).join(", ")}
                  </div>
                ) : null}

                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    // Security: skip raw HTML
                    skipHtml
                    components={{
                      // Render paragraphs as divs to avoid block elements inside <p>
                      p: ({ children }: any) => <div>{children}</div>,
                      // Custom pre wrapper renders our rich code block
                      pre: ({ children }: any) => <CodeBlock>{children}</CodeBlock>,
                      // Inline code stays inline; for block code we let <pre> handle it
                      code: (props: any) => (
                        props?.inline ? <InlineCode className={props.className}>{props.children}</InlineCode> : <code className={props.className}>{props.children}</code>
                      ),
                      a: (props: any) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" className="underline text-blue-600" />
                      ),
                    } as any}
                  >
                    {typeof m.content === 'string' ? m.content : String(m.content ?? '')}
                  </ReactMarkdown>
                </div>

                {/* Inline HITL proposal cards */}
                {(() => {
                  if (isUser) return null;
                  const metaProposals: any[] = Array.isArray((m as any).metadata?.proposals) ? (m as any).metadata!.proposals : [];
                  // Fallback: parse proposals embedded in assistant content like "DEBUG PROPOSAL:{...json...}"
                  const contentStr = typeof m.content === 'string' ? m.content : '';
                  const parsedFromContent: any[] = [];
                  try {
                    // Handle possibly line-broken markers e.g. "DEBUG PROPOSAL:{\n  ... }"
                    const markerIdx = contentStr.indexOf('PROPOSAL');
                    if (markerIdx >= 0) {
                      // Find first "{" after the marker
                      const jsonStart = contentStr.indexOf('{', markerIdx);
                      if (jsonStart >= 0) {
                        // Heuristic: find last closing brace before next DEBUG or end
                        const tail = contentStr.slice(jsonStart);
                        // Try progressively to parse a JSON block by balancing braces
                        let depth = 0; let end = -1;
                        for (let i = 0; i < tail.length; i++) {
                          const ch = tail[i];
                          if (ch === '{') depth++;
                          else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
                        }
                        if (end > 0) {
                          const jsonText = tail.slice(0, end);
                          try {
                            const obj = JSON.parse(jsonText);
                            const changes = Array.isArray(obj?.changes) ? obj.changes : [];
                            parsedFromContent.push({ id: obj?.proposal_id || obj?.id, title: obj?.title || 'Proposed file changes', changes });
                          } catch {}
                        }
                      }
                    }
                  } catch {}
                  const proposals: any[] = [...metaProposals, ...parsedFromContent];
                  if (proposals.length === 0) return null;
                  return (
                  <div className="mt-3 space-y-2">
                    {proposals.map((p: any, idx: number) => {
                      const pid = p?.id || p?.proposal_id || `proposal-${idx}`;
                      const title = p?.title || "Proposed file changes";
                      const changes = Array.isArray(p?.changes) ? p.changes : [];
                      const status = p?.status; // optional: 'approved' | 'rejected'
                      return (
                        <div key={pid} className="border rounded bg-white text-gray-900 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-medium">{title}</div>
                            {status ? (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'approved' ? 'bg-green-100 text-green-700' : status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                {status}
                              </span>
                            ) : null}
                          </div>
                          {changes.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {changes.map((c: any, ci: number) => (
                                <ChangeRow
                                  key={ci}
                                  pid={pid}
                                  index={ci}
                                  label={String(c?.action || c?.op || 'edit')}
                                  path={String(c?.path || c?.file || '')}
                                  diff={typeof c?.diff === 'string' ? c.diff : undefined}
                                />
                              ))}
                            </ul>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              className="text-[11px] px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                              onClick={() => pid && onApproveProposal && onApproveProposal(pid)}
                              disabled={!onApproveProposal || status === 'approved'}
                              aria-label="Approve proposed changes"
                            >
                              Approve
                            </button>
                            <button
                              className="text-[11px] px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                              onClick={() => pid && onRejectProposal && onRejectProposal(pid)}
                              disabled={!onRejectProposal || status === 'rejected'}
                              aria-label="Reject proposed changes"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })()}
                <div className="text-[10px] opacity-60 mt-1">
                  {m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {!atBottom ? (
        <button
          onClick={jumpToLatest}
          className="fixed bottom-24 right-6 px-3 py-1.5 rounded-full shadow bg-gray-900 text-white text-sm"
          aria-label="Jump to latest"
        >
          Jump to latest{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>
      ) : null}
    </div>
  );
}
