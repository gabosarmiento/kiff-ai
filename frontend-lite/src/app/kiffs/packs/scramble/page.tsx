'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useLayoutState } from '@/components/layout/LayoutState';
import PageContainer from '@/components/ui/PageContainer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { apiClient } from '../../launcher/utils/api';
import toast from 'react-hot-toast';

function useModels() {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = await apiClient.fetchModels();
        if (!cancelled) {
          const fallback = [
            'moonshotai/kimi-k2-instruct',
            'qwen/qwen3-32b',
            'deepseek-r1-distill-llama-70b',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'llama3-70b-8192',
          ];
          const available = ids && ids.length >= 5 ? ids : Array.from(new Set([...(ids || []), ...fallback]));
          setModels(available);
        }
      } catch (e) {
        if (!cancelled) {
          setModels([
            'moonshotai/kimi-k2-instruct',
            'qwen/qwen3-32b',
            'deepseek-r1-distill-llama-70b',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'llama3-70b-8192',
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // refs are updated in onDone handlers

  return { models, loading } as const;
}

export default function ScrambleComparatorPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const searchParams = useSearchParams();
  const packId = useMemo(() => searchParams.get('pack') || '', [searchParams]);

  // Top input
  const [question, setQuestion] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // Models
  const { models } = useModels();
  const [leftModel, setLeftModel] = useState<string>('moonshotai/kimi-k2-instruct');
  const [rightModel, setRightModel] = useState<string>('moonshotai/kimi-k2-instruct');

  useEffect(() => {
    if (models && models.length > 0) {
      if (!models.includes(leftModel)) setLeftModel(models[0]);
      if (!models.includes(rightModel)) setRightModel(models[0]);
    }
  }, [models, leftModel, rightModel]);

  // Output states
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const leftAbortRef = useRef<AbortController | null>(null);
  const rightAbortRef = useRef<AbortController | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Proposed changes from tools (per stream). We track a shared list tied to session.
  type ProposedChange = { path: string; new_content?: string; language?: string };
  type Proposal = { proposal_id?: string; changes: ProposedChange[] };
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isActing, setIsActing] = useState<string | null>(null); // proposal_id in progress

  // Drop noisy backend logs occasionally interleaved in SSE streams
  const sanitizeToken = useCallback((t: string): string => {
    if (!t) return '';
    // Split on newlines to filter per-line
    const lines = t.split(/\r?\n/);
    const filtered = lines.filter((line) => {
      const s = line.trim();
      if (!s) return false;
      // Common noisy patterns to ignore
      // Only drop bracketed lines when they clearly look like backend logs
      if (/^\[(launcher|INFO|DEBUG|WARNING|ERROR)\b.*\]/i.test(s)) return false;
      if (/^\[SQL:\s/i.test(s)) return false;
      // Drop explicit SQL/driver/trace noise
      if (/(sqlite3\.OperationalError|sqlalchemy|sqlalche\.me\/e\/|OperationalError:)/i.test(s)) return false;
      if (/^(DEBUG|INFO|WARNING|ERROR)[:\s]/.test(s)) return false;
      if (/^SQL:\s/i.test(s)) return false;
      if (/^parameters:\s/i.test(s)) return false;
      if (/^Traceback\s*\(most recent call last\)/i.test(s)) return false;
      if (/Tokens per second/i.test(s)) return false;
      if (/Groq Async Response Stream End/i.test(s)) return false;
      return true;
    });
    return filtered.join('\n');
  }, []);

  // Reasoning state per side
  type ReasoningState = { started: boolean; steps: string[]; completed: boolean };
  const [leftReasoning, setLeftReasoning] = useState<ReasoningState>({ started: false, steps: [], completed: false });
  const [rightReasoning, setRightReasoning] = useState<ReasoningState>({ started: false, steps: [], completed: false });
  const [leftDone, setLeftDone] = useState(false);
  const [rightDone, setRightDone] = useState(false);
  const leftDoneRef = useRef(false);
  const rightDoneRef = useRef(false);

  const handleReasoningEvent = useCallback((side: 'left' | 'right', e: any) => {
    if (!e || typeof e !== 'object') return;
    if (e.type === 'ReasoningStarted') {
      if (side === 'left') setLeftReasoning((r) => ({ ...r, started: true }));
      else setRightReasoning((r) => ({ ...r, started: true }));
    } else if (e.type === 'ReasoningStep') {
      let text = '';
      if (typeof e.content === 'string') {
        text = e.content;
      } else if (e.content && typeof e.content === 'object') {
        // Extract meaningful text from structured reasoning objects
        if (e.content.reasoning) {
          text = e.content.reasoning;
        } else if (e.content.title && e.content.reasoning) {
          text = `${e.content.title}: ${e.content.reasoning}`;
        } else if (e.content.title) {
          text = e.content.title;
        } else {
          // Fallback to formatted JSON for debugging
          text = JSON.stringify(e.content, null, 2);
        }
      }
      if (!text) return;
      if (side === 'left') setLeftReasoning((r) => ({ ...r, started: true, steps: [...r.steps, text] }));
      else setRightReasoning((r) => ({ ...r, started: true, steps: [...r.steps, text] }));
    } else if (e.type === 'ReasoningCompleted') {
      if (side === 'left') setLeftReasoning((r) => ({ ...r, completed: true }));
      else setRightReasoning((r) => ({ ...r, completed: true }));
    } else if (e.type === 'SessionStarted' && typeof e.session_id === 'string') {
      setSessionId(e.session_id);
    } else if (e.type === 'ProposedFileChanges' && e.changes) {
      // Append new proposal; keep latest 5 for brevity
      setProposals((prev) => {
        const next = [...prev, { proposal_id: e.proposal_id, changes: Array.isArray(e.changes) ? e.changes : [] }];
        return next.slice(-5);
      });
    }
    // Optional: surface tool events in steps (commented out to keep clean)
    // else if (e.type === 'ToolCallStarted' || e.type === 'ToolCallCompleted') { ... }
  }, []);

  const runComparison = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    if (!packId) {
      toast.error('Missing pack id. Open this page from Packs → Preview.');
      return;
    }

    // reset columns
    setLeftText('');
    setRightText('');
    setLeftReasoning({ started: false, steps: [], completed: false });
    setRightReasoning({ started: false, steps: [], completed: false });
    setLeftDone(false);
    setRightDone(false);
    setProposals([]);
    setSessionId(null);
    setIsRunning(true);

    // abort any previous
    try { leftAbortRef.current?.abort(); } catch {}
    try { rightAbortRef.current?.abort(); } catch {}
    leftAbortRef.current = new AbortController();
    rightAbortRef.current = new AbortController();

    // Common payload bits
    const basePayload = {
      message: q,
      chat_history: [],
      session_id: undefined as string | undefined,
      kiff_id: undefined as string | undefined,
      images: [],
      files: [],
    };

    // Left: baseline (no knowledge)
    apiClient
      .sendMessageStream(
        {
          ...basePayload,
          selected_packs: undefined,
          model_id: leftModel,
        } as any,
        {
          signal: leftAbortRef.current.signal,
          onToken: (t) => {
            const clean = sanitizeToken(t);
            if (!clean) return;
            setLeftText((prev) => prev + clean);
          },
          onEvent: (evt) => {
            handleReasoningEvent('left', evt);
          },
          onDone: () => {
            setLeftDone(true);
            leftDoneRef.current = true;
            if (rightDoneRef.current) setIsRunning(false);
          },
          onError: (e) => {
            if ((e as any)?.name === 'AbortError') return;
            setLeftText((prev) => (prev || '') + '\n[Error] Failed to fetch response.');
          },
        }
      )
      .catch(() => {});

    // Right: with knowledge (selected pack)
    apiClient
      .sendMessageStream(
        {
          ...basePayload,
          selected_packs: [packId],
          model_id: rightModel,
        } as any,
        {
          signal: rightAbortRef.current.signal,
          onToken: (t) => {
            const clean = sanitizeToken(t);
            if (!clean) return;
            setRightText((prev) => prev + clean);
          },
          onEvent: (evt) => {
            handleReasoningEvent('right', evt);
          },
          onDone: () => {
            setRightDone(true);
            rightDoneRef.current = true;
            if (leftDoneRef.current) setIsRunning(false);
          },
          onError: (e) => {
            setIsRunning(false);
            if ((e as any)?.name === 'AbortError') return;
            setRightText((prev) => (prev || '') + '\n[Error] Failed to fetch response.');
          },
        }
      )
      .catch(() => setIsRunning(false));
  }, [question, packId, leftModel, rightModel, sanitizeToken, handleReasoningEvent]);

  useEffect(() => {
    return () => {
      try { leftAbortRef.current?.abort(); } catch {}
      try { rightAbortRef.current?.abort(); } catch {}
    };
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main
        className="pane pane-with-sidebar"
        style={{ paddingLeft: leftWidth + 24 }}
      >
        <PageContainer padded>
          {/* Top controls */}
          <Card className="p-3 mb-3">
            <div className="flex items-center gap-2">
              <Link href="/kiffs/packs">
                <Button variant="outline">Back</Button>
              </Link>
              <Input
                placeholder={packId ? 'Ask a question to compare agents…' : 'Missing pack id'}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    runComparison();
                  }
                }}
                disabled={!packId || isRunning}
              />
              <Button onClick={runComparison} disabled={!packId || isRunning}>
                {isRunning ? 'Running…' : 'Ask'}
              </Button>
              {sessionId && (
                <span className="ml-auto text-[10px] px-2 py-1 rounded bg-zinc-100 text-zinc-600 border">
                  session: {sessionId.slice(0, 6)}…
                </span>
              )}
            </div>
          </Card>

          {/* Two fixed-height columns with internal scroll, no outer scroll */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            style={{
              height: 'calc(100vh - 180px)', // roughly accounts for navbar + paddings
              overflow: 'hidden',
            }}
          >
            {/* Left column: baseline */}
            <Card className="flex flex-col overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Baseline (no knowledge)</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Model</span>
                  <Select value={leftModel} onValueChange={setLeftModel}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 text-xs text-gray-500 border-b">Same AGNO agent as launcher, no packs.</div>
              <div className="flex-1 grid grid-rows-3">
                <div className="overflow-auto border-b p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold">Thoughts</div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-2">
                      {!leftReasoning.completed && (leftReasoning.started || isRunning) ? (
                        <>
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                          <span>Thinking…</span>
                        </>
                      ) : (
                        <span>{leftReasoning.steps.length} step{leftReasoning.steps.length === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>
                  {leftReasoning.steps.length > 0 ? (
                    <ol className="text-xs whitespace-pre-wrap list-decimal list-inside space-y-1">
                      {leftReasoning.steps.map((s, i) => (
                        <li key={i} className="break-words">{s}</li>
                      ))}
                    </ol>
                  ) : (
                    !isRunning && <div className="text-xs text-gray-400">—</div>
                  )}
                </div>
                <div className="overflow-auto border-b p-4 whitespace-pre-wrap text-sm">
                  {leftText || (!isRunning && 'No output yet. Ask a question above.')}
                </div>
                <div className="overflow-auto p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold">Proposed changes</div>
                    {!proposals.length && <span className="text-[10px] text-gray-400">—</span>}
                  </div>
                  {proposals.length > 0 && (
                    <ul className="space-y-2">
                      {proposals.map((p, i) => (
                        <li key={p.proposal_id || i} className="border rounded p-2">
                          <div className="text-[10px] text-gray-500 mb-1">{p.proposal_id ? `Proposal ${p.proposal_id.slice(0,6)}…` : 'Proposal'}</div>
                          <ol className="list-decimal list-inside space-y-1">
                            {p.changes.map((c, j) => (
                              <li key={j} className="break-all">
                                <span className="font-mono text-[11px]">{c.path}</span>
                              </li>
                            ))}
                          </ol>
                          {sessionId && p.proposal_id && (
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                disabled={isActing === p.proposal_id}
                                onClick={async () => {
                                  try {
                                    setIsActing(p.proposal_id!);
                                    await apiClient.approveProposal({ session_id: sessionId, proposal_id: p.proposal_id! });
                                    toast.success('Applied');
                                    setProposals((prev) => prev.filter((q) => q.proposal_id !== p.proposal_id));
                                  } catch (e) {
                                    toast.error('Failed to apply');
                                  } finally {
                                    setIsActing(null);
                                  }
                                }}
                              >Approve</Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActing === p.proposal_id}
                                onClick={async () => {
                                  try {
                                    setIsActing(p.proposal_id!);
                                    await apiClient.rejectProposal({ session_id: sessionId, proposal_id: p.proposal_id! });
                                    toast.success('Rejected');
                                    setProposals((prev) => prev.filter((q) => q.proposal_id !== p.proposal_id));
                                  } catch (e) {
                                    toast.error('Failed to reject');
                                  } finally {
                                    setIsActing(null);
                                  }
                                }}
                              >Reject</Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>

            {/* Right column: with pack knowledge */}
            <Card className="flex flex-col overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between gap-3">
                <div className="text-sm font-medium">With Pack Knowledge</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Model</span>
                  <Select value={rightModel} onValueChange={setRightModel}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 text-xs text-gray-500 border-b">Uses selected pack: {packId || '—'}</div>
              <div className="flex-1 grid grid-rows-3">
                <div className="overflow-auto border-b p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold">Thoughts</div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-2">
                      {!rightReasoning.completed && (rightReasoning.started || isRunning) ? (
                        <>
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                          <span>Thinking…</span>
                        </>
                      ) : (
                        <span>{rightReasoning.steps.length} step{rightReasoning.steps.length === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>
                  {rightReasoning.steps.length > 0 ? (
                    <ol className="text-xs whitespace-pre-wrap list-decimal list-inside space-y-1">
                      {rightReasoning.steps.map((s, i) => (
                        <li key={i} className="break-words">{s}</li>
                      ))}
                    </ol>
                  ) : (
                    !isRunning && <div className="text-xs text-gray-400">—</div>
                  )}
                </div>
                <div className="overflow-auto p-4 whitespace-pre-wrap text-sm">
                  {rightText.trim()
                    ? rightText
                    : isRunning
                      ? ''
                      : (question.trim()
                          ? <span className="text-zinc-400 italic">No results found in the selected knowledge pack.</span>
                          : <span className="text-zinc-400 italic">No output yet. Ask a question above.</span>
                        )
                  }
                </div>
                <div className="overflow-auto p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold">Proposed changes</div>
                    {!proposals.length && <span className="text-[10px] text-gray-400">—</span>}
                  </div>
                  {proposals.length > 0 && (
                    <ul className="space-y-2">
                      {proposals.map((p, i) => (
                        <li key={p.proposal_id || i} className="border rounded p-2">
                          <div className="text-[10px] text-gray-500 mb-1">{p.proposal_id ? `Proposal ${p.proposal_id.slice(0,6)}…` : 'Proposal'}</div>
                          <ol className="list-decimal list-inside space-y-1">
                            {p.changes.map((c, j) => (
                              <li key={j} className="break-all">
                                <span className="font-mono text-[11px]">{c.path}</span>
                              </li>
                            ))}
                          </ol>
                          {sessionId && p.proposal_id && (
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                disabled={isActing === p.proposal_id}
                                onClick={async () => {
                                  try {
                                    setIsActing(p.proposal_id!);
                                    await apiClient.approveProposal({ session_id: sessionId, proposal_id: p.proposal_id! });
                                    toast.success('Applied');
                                    setProposals((prev) => prev.filter((q) => q.proposal_id !== p.proposal_id));
                                  } catch (e) {
                                    toast.error('Failed to apply');
                                  } finally {
                                    setIsActing(null);
                                  }
                                }}
                              >Approve</Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActing === p.proposal_id}
                                onClick={async () => {
                                  try {
                                    setIsActing(p.proposal_id!);
                                    await apiClient.rejectProposal({ session_id: sessionId, proposal_id: p.proposal_id! });
                                    toast.success('Rejected');
                                    setProposals((prev) => prev.filter((q) => q.proposal_id !== p.proposal_id));
                                  } catch (e) {
                                    toast.error('Failed to reject');
                                  } finally {
                                    setIsActing(null);
                                  }
                                }}
                              >Reject</Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </PageContainer>
      </main>
      <BottomNav />
    </div>
  );
}
