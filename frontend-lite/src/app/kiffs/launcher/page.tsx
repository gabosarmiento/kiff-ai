"use client";

import React, { useCallback, useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";
import dynamic from "next/dynamic";
const ChatHistory = dynamic(() => import("./components/ChatHistory"), { ssr: false });
const ChatInput = dynamic(() => import("./components/ChatInput"), { ssr: false });
const PackSelector = dynamic(() => import("@/components/compose/PackSelector"), { ssr: false });
import type { Attachment } from "./types";
import { ChatMessage } from "./types";
import { apiClient } from "./utils/api";
import { apiJson } from "@/lib/api";
import FeatureIntroModal from "@/components/FeatureIntroModal";
import Image from "next/image";

function getTenantId(): string {
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem("tenant_id");
    if (fromStorage && fromStorage !== "null" && fromStorage !== "undefined") return fromStorage;
  }
  return process.env.NEXT_PUBLIC_TENANT_ID || "4485db48-71b7-47b0-8128-c6dca5be352d";
}
import { Button } from "@/components/ui/button";
import { Package, ChevronLeft, ChevronRight, Rocket, RotateCcw, Monitor, FileCode, MessageSquare, X, Plus, Minus, Trash2, Settings, ArrowRight } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
const FileExplorer = dynamic(() => import("./components/FileExplorer"), { ssr: false, loading: () => <div className="animate-pulse h-full bg-gray-100 rounded" /> });
const FileEditor = dynamic(() => import("./components/FileEditor"), { ssr: false, loading: () => <div className="animate-pulse h-full bg-gray-100 rounded" /> });
const PreviewPane = dynamic(() => import("./components/PreviewPane"), { ssr: false, loading: () => <div className="animate-pulse h-full bg-gray-100 rounded" /> });
import toast from "react-hot-toast";
import { usePacks } from "@/contexts/PackContext";

import { Suspense } from "react";

function LauncherPageContent() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Guard to ensure we only bootstrap the "t" param once per mount
  const bootstrappedRef = useRef(false);
  // Guard to ensure we only process a given 't' once to avoid effect loops
  const handledTRef = useRef<string | null>(null);
  const { selectedPacks: globalSelectedPacks, setSelectedPacks: setGlobalSelectedPacks, removePack: removePackGlobal } = usePacks();
  const ideaInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Ephemeral attachments for this session only (not persisted)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showPreviewOnly, setShowPreviewOnly] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasProject, setHasProject] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [kiffUpdate, setKiffUpdate] = useState<any | null>(null);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [showPackSelector, setShowPackSelector] = useState(false);
  const [showPackManager, setShowPackManager] = useState(false);
  const [packConflict, setPackConflict] = useState<string | null>(null);
  const [currentIdea, setCurrentIdea] = useState("");
  const [ideaInput, setIdeaInput] = useState("");
  const [kiffId, setKiffId] = useState<string | null>(null);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [showDeployLogs, setShowDeployLogs] = useState(false);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const [installState, setInstallState] = useState<string>("");
  const [previewScale, setPreviewScale] = useState(1);
  // Debounce and guards for agent_state persistence
  const saveDebounceRef = useRef<any>(null);
  const appliedAgentStateRef = useRef<boolean>(false);

  // Auto-resize for IdleHero idea textarea up to 10 lines, then enable scroll
  const adjustIdeaHeight = useCallback(() => {
    const ta = ideaInputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const styles = window.getComputedStyle(ta);
    const lineHeight = parseFloat(styles.lineHeight || '20');
    const paddingTop = parseFloat(styles.paddingTop || '0');
    const paddingBottom = parseFloat(styles.paddingBottom || '0');
    const maxLines = 10;
    const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;
    const next = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    adjustIdeaHeight();
  }, [ideaInput, adjustIdeaHeight]);

  // If user lands on /kiffs/launcher without kiff or t, append a one-shot t param.
  // We guard with a ref to avoid re-appending during the brief window before SessionStarted sets kiff.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const hasKiff = !!sp.get('kiff');
      const hasT = !!sp.get('t');
      // If neither param exists, always append a one-shot t, even if Fast Refresh
      // preserved the ref. The ref only prevents re-appending when params already exist.
      if (!hasKiff && !hasT) {
        console.debug('[launcher] bootstrap: no kiff/t found, appending t', { pathname, search: window.location.search });
        sp.set('t', String(Date.now()));
        router.replace(`${pathname}?${sp.toString()}`);
        bootstrappedRef.current = true;
        return;
      }
      console.debug('[launcher] bootstrap: params present, skipping append', { pathname, search: window.location.search, hasKiff, hasT });
      if (bootstrappedRef.current) return;
      bootstrappedRef.current = true;
    } catch {}
  }, [pathname, router]);

  // Model selection (like compose)
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [model, setModel] = useState<string>("moonshotai/kimi-k2-instruct");
  // Accessible combobox state
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelHighlight, setModelHighlight] = useState<number | null>(null);
  const [modelTypeahead, setModelTypeahead] = useState("");
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  // Fetch available models on mount
  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        const res = await fetch('/api/models', {
          headers: {
            'X-Tenant-ID': getTenantId(),
          },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`models ${res.status}`);
        const data = await res.json();
        const list: string[] = Array.isArray(data?.models)
          ? data.models.map((m: any) => (typeof m === 'string' ? m : (m?.id || m?.name))).filter(Boolean)
          : Array.isArray(data) ? data : [];
        if (!cancelled) {
          const unique = Array.from(new Set(list.concat(model)));
          setModelOptions(unique);
        }
      } catch (e) {
        if (!cancelled) {
          const fallback = [
            model,
            'google/gemini-1.5-pro',
            'anthropic/claude-3.5-sonnet',
            'openai/gpt-4o-mini',
          ];
          setModelOptions(Array.from(new Set(fallback)));
        }
      }
    };
    loadModels();
    return () => { cancelled = true; };
  }, []);
  // Stable derived URL params to avoid effect reruns due to identity churn
  const tParam = useMemo(() => searchParams.get('t'), [searchParams]);
  const kiffParam = useMemo(() => searchParams.get('kiff'), [searchParams]);
  const packParam = useMemo(() => searchParams.get('pack'), [searchParams]);
  const resetParam = useMemo(() => searchParams.get('reset'), [searchParams]);
  const arraysEqual = (a: string[] | null | undefined, b: string[] | null | undefined) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };
  useEffect(() => {
    function onDocKey(e: KeyboardEvent) { if (e.key === 'Escape') setModelMenuOpen(false); }
    function onDocClick(e: MouseEvent) {
      const el = modelMenuRef.current; if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setModelMenuOpen(false);
    }
    document.addEventListener('keydown', onDocKey);
    document.addEventListener('mousedown', onDocClick);
    return () => { document.removeEventListener('keydown', onDocKey); document.removeEventListener('mousedown', onDocClick); };
  }, []);
  // Holds the active SSE stopper for file-apply, to allow cleanup on reset/navigation
  const sseStopRef = useRef<(() => void) | null>(null);

  // Load models (from unified Next API route) and prefer Kimi models when available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log("🔄 Loading models from API...");
        const res = await fetch(`/api/models`, {
          headers: { 'X-Tenant-ID': getTenantId() },
          cache: "force-cache",
          next: { revalidate: 300 } // Cache for 5 minutes
        });
        console.log("📡 Models API response status:", res.status, res.ok);
        
        if (!res.ok) {
          console.warn("❌ Models API not OK, using fallback");
          const fallbackModels = ["moonshotai/kimi-k2-instruct", "qwen/qwen3-32b", "deepseek-r1-distill-llama-70b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192"];
          setModelOptions(fallbackModels);
          setModel(fallbackModels[0]);
          return;
        }
        
        const data = await res.json();
        console.log("📊 Raw API data:", data);
        
        const arr = Array.isArray(data) ? data : (Array.isArray((data as any).models) ? (data as any).models : []);
        console.log("🔍 Processed array:", arr);
        
        const ids: string[] = arr
          .map((m: any) => (typeof m === "string" ? m : (m && (m.id || (m as any).name)) || null))
          .filter(Boolean);
        console.log("🎯 Extracted IDs:", ids);
        
        if (cancelled) return;
        
        // If no models from API, provide fallback models
        const fallbackModels = ["moonshotai/kimi-k2-instruct", "qwen/qwen3-32b", "deepseek-r1-distill-llama-70b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192"];
        // If backend returns a very small set (e.g., 4), merge with fallback to ensure a robust default list
        const availableIds = ids.length >= 5 ? ids : Array.from(new Set([...(ids || []), ...fallbackModels]));
        console.log("📋 Available IDs (with fallback):", availableIds);
        
        const preferred = ["moonshotai/kimi-k2-instruct", "qwen/qwen3-32b", "deepseek-r1-distill-llama-70b"];
        const set = new Set(availableIds);
        const ordered: string[] = [];
        for (const p of preferred) if (set.has(p)) ordered.push(p);
        for (const id of availableIds) if (!ordered.includes(id)) ordered.push(id);
        console.log("⚡ Final ordered models:", ordered);
        
        setModelOptions(ordered);
        
        // Only set model if current model is not in the list or if we don't have a model set
        if (!model || !ordered.includes(model)) {
          const selectedModel = ordered[0] || "moonshotai/kimi-k2-instruct";
          console.log("🎯 Setting model to:", selectedModel);
          setModel(selectedModel);
        }
      } catch (e) {
        console.warn("❌ Models load failed:", e);
        // Ensure we have fallback models even on error
        const fallbackModels = ["moonshotai/kimi-k2-instruct", "qwen/qwen3-32b", "deepseek-r1-distill-llama-70b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192"];
        console.log("🔄 Using fallback models on error:", fallbackModels);
        setModelOptions(fallbackModels);
        setModel(fallbackModels[0]);
      }
    })();
    return () => { cancelled = true; };
  }, []); // Do not depend on model to avoid loop

  // Load persisted state
  useEffect(() => {
    try {
      const persisted = localStorage.getItem("kiff_launcher_state");
      if (persisted) {
        const parsed = JSON.parse(persisted);
        if (parsed?.hasProject) setHasProject(true);
        if (parsed?.idea) setIdeaInput(parsed.idea);
      }
    } catch {}
  }, []);

  // Initialize selected packs from global context and auto-open selector if packs exist
  useEffect(() => {
    if (globalSelectedPacks.length > 0) {
      setSelectedPacks(prev => (arraysEqual(prev, globalSelectedPacks) ? prev : globalSelectedPacks));
      // Auto-open pack selector when there are selected packs
      setShowPackSelector(prev => (prev ? prev : true));
    }
  }, [globalSelectedPacks]);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(
        "kiff_launcher_state",
        JSON.stringify({ hasProject, idea: ideaInput })
      );
    } catch {}
  }, [hasProject, ideaInput]);

  // Check for pack parameter in URL
  useEffect(() => {
    if (packParam) {
      setSelectedPacks(prev => (prev.length === 1 && prev[0] === packParam ? prev : [packParam]));
    }
  }, [packParam]);

  // Force reset to idle state when navigating via sidebar "New Kiff" (adds ?t=...)
  // Only do this when there is NO explicit kiff to load
  useEffect(() => {
    const t = tParam;
    const kid = kiffParam;
    if (t && !kid) {
      // If we already handled this exact 't', do nothing to avoid re-running the reset.
      if (handledTRef.current === t) {
        return;
      }
      handledTRef.current = t;
      // Clear persisted launcher state
      try { localStorage.removeItem('kiff_launcher_state'); } catch {}
      // Remove any stored packs for previous kiffs
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('kiff_packs_')) keysToRemove.push(k);
        }
        for (const k of keysToRemove) localStorage.removeItem(k);
      } catch {}
      // Reset local state to show idle/new view
      setHasProject(false);
      setSessionId(null);
      setKiffId(null);
      setChatMessages([]);
      setChatOpen(false);
      setIsGenerating(false);
      setPreviewUrl(null);
      setFilePaths([]);
      setSelectedPath(null);
      setFileContent("");
      setAttachments([]);
      setCurrentIdea("");
      setIdeaInput("");
      setShowPreviewOnly(false);
      setDeployLogs([]);
      setShowDeployLogs(false);
      setUnreadCount(0);
      setKiffUpdate(null);
      setShowPackSelector(false);
      setShowPackManager(false);
      setPackConflict(null);
      setPreviewScale(1);
      // Clear selected packs (local + global context)
      setSelectedPacks([]);
      setGlobalSelectedPacks([]);
      // Abort any in-flight generation/requests
      try { if (abortRef.current) abortRef.current.abort(); } catch {}
      abortRef.current = null;
      // Stop any ongoing file-apply SSE
      try { sseStopRef.current && sseStopRef.current(); } catch {}
      sseStopRef.current = null;
      // Defer removing the 't' param until 'kiff' is present in the URL.
      // This keeps '?t=...' visible briefly on bare launcher, then swaps to '?kiff=...'.
      try {
        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search);
          const hasKiffNow = !!sp.get('kiff');
          if (hasKiffNow) {
            console.debug('[launcher] cleanup: kiff present, removing t', { pathname, search: window.location.search });
            sp.delete('t');
            const q = sp.toString();
            router.replace(`${pathname}${q ? `?${q}` : ''}`);
          } else {
            console.debug('[launcher] cleanup: kiff not yet present, keeping t', { pathname, search: window.location.search });
          }
        }
      } catch {}
    }
  }, [tParam, kiffParam, setGlobalSelectedPacks, router, pathname]);

  // Handle opening a specific kiff from URL (?kiff=ID): flush current chat and load its history
  useEffect(() => {
    const kid = kiffParam;
    if (!kid || kid === kiffId) return;
    setKiffId(kid);
    setSessionId(null);
    // Flush chat to empty immediately
    setChatMessages([]);
    // Load full session state for this Kiff: session_id, messages, files, preview, and packs (local)
    (async () => {
      try {
        // 1) Load latest chat session for this kiff (returns session_id + messages)
        const loadRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/chat/load-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Tenant-ID": getTenantId() },
          body: JSON.stringify({ kiff_id: kid }),
        });
        if (loadRes.ok) {
          const data = await loadRes.json();
          if (data?.session_id) setSessionId(data.session_id as string);
          if (Array.isArray(data?.messages)) {
            const chatMsgs: ChatMessage[] = data.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp || new Date().toISOString(),
            }));
            setChatMessages(chatMsgs);
          }
          // Consider we now have a project to show
          setHasProject(true);
          // 2) Restore agent_state (model, selected_packs) from backend if present
          try {
            const stRaw = data?.agent_state;
            const st = typeof stRaw === 'string' ? JSON.parse(stRaw) : (stRaw || {});
            if (st && typeof st === 'object') {
              const packs = Array.isArray(st.selected_packs) ? st.selected_packs.filter((x: any) => typeof x === 'string') : null;
              const mid = typeof st.model_id === 'string' ? st.model_id : null;
              if (packs && packs.length >= 0) {
                setSelectedPacks(packs);
                setGlobalSelectedPacks(packs);
                try { localStorage.setItem(`kiff_packs_${kid}`, JSON.stringify(packs)); } catch {}
              }
              if (mid) setModel(mid);
              appliedAgentStateRef.current = true;
            }
          } catch (e) {
            console.warn('Failed to apply agent_state from backend', e);
          }
          // 2b) Fallback: restore packs selected for this kiff from localStorage
          try {
            const packsKey = `kiff_packs_${kid}`;
            const packsRaw = localStorage.getItem(packsKey);
            if (packsRaw) {
              const parsed = JSON.parse(packsRaw);
              if (Array.isArray(parsed)) setSelectedPacks(parsed);
            }
          } catch {}
          // 3) Restore preview and files via preview session
          if (data?.session_id) {
            try {
              const { getPreviewUrl, getFileTree, getFile } = await import("./utils/preview");
              // Preview URL (ensures sandbox/session is known on backend)
              const url = await getPreviewUrl(data.session_id);
              if (url) {
                setPreviewUrl(url);
                setShowPreviewOnly(true);
              }
              // File tree
              const tree = await getFileTree(data.session_id);
              setFilePaths(tree.files || []);
              const firstTsx = (tree.files || []).find((p: string) => p.endsWith("app/page.tsx")) || (tree.files || [])[0] || null;
              setSelectedPath(firstTsx);
              if (firstTsx) {
                const f = await getFile(data.session_id, firstTsx);
                setFileContent(f.content || "");
              }
            } catch (e) {
              console.warn("Failed to restore preview/files for kiff", e);
            }
          }
        } else {
          // Fallback: if load-session fails, at least get the kiff messages history
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/kiffs/${kid}/messages`, {
              headers: { "X-Tenant-ID": getTenantId() },
            });
            if (response.ok) {
              const messages = await response.json();
              if (Array.isArray(messages)) {
                const chatMsgs: ChatMessage[] = messages.map((m: any) => ({
                  role: m.role,
                  content: m.content,
                  timestamp: m.created_at || new Date().toISOString(),
                }));
                setChatMessages(chatMsgs);
              }
            }
          } catch (e) {
            console.warn("Failed to load kiff messages (fallback)", e);
          }
        }
      } catch (e) {
        console.warn("Failed to load session for kiff", e);
      }
    })();
  }, [kiffParam, kiffId]);

  // Persist agent_state (model_id, selected_packs) when they change
  useEffect(() => {
    if (!sessionId) return;
    // If we just applied backend state, skip the first save to avoid echoing unchanged values
    if (appliedAgentStateRef.current) {
      appliedAgentStateRef.current = false;
      return;
    }
    // Keep localStorage in sync for backwards compatibility
    try {
      if (kiffId) localStorage.setItem(`kiff_packs_${kiffId}`, JSON.stringify(selectedPacks));
    } catch {}
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      apiClient
        .saveSession({ session_id: sessionId, agent_state: { model_id: model, selected_packs: selectedPacks, chat_active: true } })
        .catch((e) => console.warn('save-session failed', e));
    }, 500);
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [sessionId, model, selectedPacks, kiffId]);

  // Check for reset parameter in URL and reset state
  useEffect(() => {
    const shouldReset = resetParam;
    if (shouldReset === 'true') {
      // Reset all state to initial values
      setHasProject(false);
      setIsGenerating(false);
      setShowPreviewOnly(false);
      setChatOpen(false);
      setSessionId(null);
      setKiffId(null);
      setFilePaths([]);
      setSelectedPath(null);
      setFileContent("");
      setPreviewUrl(null);
      setInstallState("");
      setSelectedPacks([]);
      setShowPackSelector(false);
      setCurrentIdea("");
      setIdeaInput("");
      setChatMessages([]);
      setChatInput("");
      setKiffUpdate(null);
      
      // Clear localStorage
      try {
        localStorage.removeItem("kiff_launcher_state");
      } catch {}
      
      // Clear the URL parameter to avoid repeated resets
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.pathname + url.search);
      
      toast.success("New Kiff ready!");
    }
  }, [resetParam]);

  // Refresh files from sandbox (e2b) for current session and keep selection when possible
  const refreshFiles = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { getFileTree, getFile } = await import("./utils/preview");
      const tree = await getFileTree(sessionId);
      const files: string[] = tree?.files || [];
      setFilePaths(files);
      // keep previous selection if it still exists
      setSelectedPath((prev) => {
        if (prev && files.includes(prev)) return prev;
        const fallback = files.find((p) => p.endsWith("app/page.tsx")) || files[0] || null;
        return fallback || null;
      });
      const pathToLoad = (prev => {
        if (prev && files.includes(prev)) return prev;
        const fallback = files.find((p) => p.endsWith("app/page.tsx")) || files[0] || null;
        return fallback;
      })(selectedPath);
      if (pathToLoad) {
        const f = await getFile(sessionId, pathToLoad);
        setFileContent(f?.content || "");
      } else {
        setFileContent("");
      }
    } catch (e) {
      console.warn("refreshFiles failed", e);
    }
  }, [sessionId, selectedPath]);

  // Only auto-sync with sandbox when Live Preview is active
  useEffect(() => {
    if (!kiffUpdate) return;
    if (!(showPreviewOnly && sessionId)) return;
    (async () => {
      try { await refreshFiles(); } catch (e) { console.warn("refreshFiles (preview) failed", e); }
      try {
        const { restartDevServer } = await import("./utils/preview");
        await restartDevServer(sessionId!);
      } catch (e) {
        console.warn("restartDevServer failed", e);
      }
    })();
  }, [kiffUpdate, showPreviewOnly, sessionId, refreshFiles]);

  // Chat submit handler (defined before effects that depend on it)
  const handleChatSubmit = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg) return;

    // Update current idea context for pack suggestions
    setCurrentIdea(msg);

    const userMsg: ChatMessage = {
      role: "user",
      content: msg,
      timestamp: new Date().toISOString(),
    };
    // If starting a brand-new kiff via chat (no kiffId yet) and we still have old messages,
    // flush chat to empty before adding the new user message.
    setChatMessages((prev) => {
      const needsFlush = !kiffId && prev.length > 1;
      const base = needsFlush ? [] : prev;
      return [...base, userMsg];
    });
    setChatInput("");
    setIsGenerating(true);
    // capture current attachments snapshot for this send and clear UI immediately (ephemeral)
    const attSnapshot = [...attachments];
    setAttachments([]);
    // Create placeholder assistant message for streaming tokens
    let assistantIndex = -1;
    setChatMessages((prev) => {
      assistantIndex = prev.length + 0; // index after adding userMsg
      return [
        ...prev,
        {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        },
      ];
    });

    try {
      // Abort any previous stream
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      // Get current project files from localStorage for agent context
      let projectFiles: any[] = [];
      if (sessionId && hasProject) {
        try {
          const storedFiles = localStorage.getItem(`files_${sessionId}`);
          if (storedFiles) {
            projectFiles = JSON.parse(storedFiles);
          }
        } catch (e) {
          console.warn('Failed to load project files from localStorage', e);
        }
      }

      await apiClient.sendMessageStream(
        {
          message: msg,
          chat_history: chatMessages,
          session_id: sessionId || undefined,
          kiff_id: kiffId || undefined,
          selected_packs: selectedPacks.length > 0 ? selectedPacks : undefined,
          model_id: model,
          images: attSnapshot
            .filter((a) => a.mime.startsWith("image/"))
            .map((a) => ({ name: a.name, mime: a.mime, content_base64: a.content_base64 })),
          files: attSnapshot
            .filter((a) => !a.mime.startsWith("image/"))
            .map((a) => ({ name: a.name, mime: a.mime, content_base64: a.content_base64 })),
          // Include current project files so the agent has context
          project_files: projectFiles.length > 0 ? projectFiles : undefined,
        },
        {
          signal: abortRef.current.signal,
          onToken: (t) => {
            setChatMessages((prev) => {
              const next = [...prev];
              const idx = assistantIndex >= 0 ? assistantIndex : next.findIndex((m, i) => i > 0 && next[i - 1] === userMsg && m.role === "assistant");
              const target = idx >= 0 ? idx : next.length - 1;
              next[target] = { ...next[target], content: (next[target]?.content || "") + t } as ChatMessage;
              return next;
            });
          },
          onEvent: (evt: any) => {
            // Attach proposal metadata to the current assistant message
            try {
              if (!evt) return;
              // 1) Capture early session id if backend emits it
              if (evt.type === 'SessionStarted' && typeof evt.session_id === 'string') {
                setSessionId(evt.session_id);
                // Prefer kiff_id for URL so reload can restore by kiff
                try {
                  if (typeof window !== 'undefined') {
                    const sp = new URLSearchParams(window.location.search);
                    const urlId = typeof evt.kiff_id === 'string' && evt.kiff_id ? evt.kiff_id : evt.session_id;
                    sp.set('kiff', urlId);
                    sp.delete('t');
                    const q = sp.toString();
                    router.replace(`${pathname}${q ? `?${q}` : ''}`);
                  }
                } catch {}
                return;
              }
              // 1b) Reasoning events: persist progressively on the active assistant message
              if (evt.type === 'ReasoningStarted' || evt.type === 'ReasoningStep' || evt.type === 'ReasoningCompleted') {
                setChatMessages((prev) => {
                  const next = [...prev];
                  const idx = assistantIndex >= 0 ? assistantIndex : next.findIndex((m, i) => i > 0 && next[i - 1].role === 'user' && m.role === 'assistant');
                  const target = idx >= 0 ? idx : next.length - 1;
                  const m = next[target] || { role: 'assistant', content: '' } as any;
                  const meta: any = { ...(m as any).metadata };
                  const reasoning = meta.reasoning || { started: false, steps: [] as string[], completed: false };
                  if (evt.type === 'ReasoningStarted') reasoning.started = true;
                  if (evt.type === 'ReasoningStep' && typeof evt.content !== 'undefined') {
                    const text = typeof evt.content === 'string' ? evt.content : JSON.stringify(evt.content);
                    reasoning.steps = [...(reasoning.steps || []), text];
                  }
                  if (evt.type === 'ReasoningCompleted') reasoning.completed = true;
                  meta.reasoning = reasoning;
                  next[target] = { ...(m as any), metadata: meta } as any;
                  return next;
                });
                return;
              }
              // 2) Normalize: detect proposal-like payloads
              const looksProposal = evt.type === 'ProposedFileChanges' || evt.proposal_id || evt.changes;
              if (!looksProposal) return;
              setChatMessages((prev) => {
                const next = [...prev];
                // Find the assistant message we are streaming into
                const idx = assistantIndex >= 0 ? assistantIndex : next.findIndex((m, i) => i > 0 && next[i - 1].role === 'user' && m.role === 'assistant');
                const target = idx >= 0 ? idx : next.length - 1;
                const m = next[target] || { role: 'assistant', content: '' };
                const meta = { ...(m as any).metadata };
                const proposals = Array.isArray(meta.proposals) ? [...meta.proposals] : [];
                const proposal = {
                  id: evt.proposal_id || evt.id || undefined,
                  title: evt.title || 'Proposed file changes',
                  changes: Array.isArray(evt.changes) ? evt.changes : (Array.isArray(evt.files) ? evt.files : []),
                  status: evt.status,
                };
                // Avoid duplicates by id if present
                const existingIdx = proposal.id ? proposals.findIndex((p: any) => p?.id === proposal.id) : -1;
                if (existingIdx >= 0) proposals[existingIdx] = { ...proposals[existingIdx], ...proposal };
                else proposals.push(proposal);
                meta.proposals = proposals;
                next[target] = { ...(m as any), metadata: meta } as ChatMessage;
                return next;
              });
            } catch (e) {
              console.warn('onEvent proposal handling failed', e);
            }
          },
          onDone: (final) => {
            if (final?.session_id) setSessionId(final.session_id);
            if (final?.tool_calls || final?.kiff_update) {
              setChatMessages((prev) => {
                const next = [...prev];
                const idx = assistantIndex >= 0 ? assistantIndex : next.length - 1;
                next[idx] = { ...next[idx], tool_calls: (final?.tool_calls as any) } as ChatMessage;
                return next;
              });
              if (final?.kiff_update) setKiffUpdate(final.kiff_update);
            }
            setIsGenerating(false);
            // If chat is closed, mark one unread reply
            if (!chatOpen) setUnreadCount((n) => n + 1);
            abortRef.current = null;
          },
          onError: (e) => {
            // If the stream was intentionally aborted (user, timeout, inactivity), do not surface an error toast.
            if ((e as any)?.name === 'AbortError') {
              setIsGenerating(false);
              abortRef.current = null;
              return;
            }
            console.error("stream error", e);
            setChatMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "There was an error processing your message. Please try again.",
                timestamp: new Date().toISOString(),
              },
            ]);
            toast.error("Request failed");
            setIsGenerating(false);
            abortRef.current = null;
          },
        }
      );
    } catch (e) {
      console.error("send-message error", e);
      setIsGenerating(false);
    }
  }, [chatInput, chatMessages, sessionId, selectedPacks, model, attachments, kiffId, chatOpen, router, pathname]);

  // Approve/Reject proposal handlers
  const handleApproveProposal = useCallback(async (proposalId: string) => {
    if (!sessionId) return;
    try {
      await apiClient.approveProposal({ session_id: sessionId, proposal_id: proposalId });
      
      // Find the proposal changes and apply them to localStorage files
      let proposalChanges: any[] = [];
      setChatMessages((prev) => prev.map((m) => {
        const meta: any = (m as any).metadata;
        if (!meta?.proposals) return m;
        const proposals = meta.proposals.map((p: any) => {
          if (p?.id === proposalId) {
            proposalChanges = p.changes || [];
            return { ...p, status: 'approved' };
          }
          return p;
        });
        return { ...m, metadata: { ...meta, proposals } } as ChatMessage;
      }));

      // Apply changes to localStorage files
      try {
        const storedFiles = localStorage.getItem(`files_${sessionId}`);
        if (storedFiles && proposalChanges.length > 0) {
          let parsedFiles = JSON.parse(storedFiles);
          
          // Apply each change from the proposal
          for (const change of proposalChanges) {
            const existingFileIndex = parsedFiles.findIndex((f: any) => f.path === change.path);
            
            if (existingFileIndex >= 0) {
              // Update existing file
              parsedFiles[existingFileIndex] = {
                ...parsedFiles[existingFileIndex],
                content: change.content,
                language: change.language || parsedFiles[existingFileIndex].language
              };
            } else {
              // Add new file
              parsedFiles.push({
                path: change.path,
                content: change.content,
                language: change.language || 'text'
              });
            }
          }
          
          // Update localStorage with modified files
          localStorage.setItem(`files_${sessionId}`, JSON.stringify(parsedFiles));
          
          // Update UI: refresh file list and current file content
          const newFilePaths = parsedFiles.map((f: any) => f.path);
          setFilePaths(newFilePaths);
          
          // If currently selected file was changed, update its content
          if (selectedPath) {
            const updatedFile = parsedFiles.find((f: any) => f.path === selectedPath);
            if (updatedFile) {
              setFileContent(updatedFile.content || '');
            }
          }
        }
      } catch (localError) {
        console.warn('Failed to apply changes to localStorage, falling back to sandbox refresh', localError);
        
        // Fallback to sandbox refresh if localStorage approach fails
        try {
          const { getFileTree, getFile } = await import('./utils/preview');
          const tree = await getFileTree(sessionId);
          setFilePaths(tree.files || []);
          if (selectedPath) {
            const f = await getFile(sessionId, selectedPath);
            setFileContent(f.content || '');
          }
        } catch (sandboxError) {
          console.warn('Sandbox refresh also failed', sandboxError);
        }
      }
      
      toast.success('Proposal approved');
    } catch (e) {
      console.error('approveProposal failed', e);
      toast.error('Failed to approve');
    }
  }, [sessionId, selectedPath]);

  const handleRejectProposal = useCallback(async (proposalId: string) => {
    if (!sessionId) return;
    try {
      await apiClient.rejectProposal({ session_id: sessionId, proposal_id: proposalId });
      // Mark proposal as rejected in chat metadata
      setChatMessages((prev) => prev.map((m) => {
        const meta: any = (m as any).metadata;
        if (!meta?.proposals) return m;
        const proposals = meta.proposals.map((p: any) => p?.id === proposalId ? { ...p, status: 'rejected' } : p);
        return { ...m, metadata: { ...meta, proposals } } as ChatMessage;
      }));
      toast.success('Proposal rejected');
    } catch (e) {
      console.error('rejectProposal failed', e);
      toast.error('Failed to reject');
    }
  }, [sessionId]);

  // Convert dropped/pasted files to in-memory base64 Attachments
  const handleAddFiles = useCallback(async (files: File[]) => {
    const toAtt = async (f: File): Promise<Attachment> => {
      const buf = await f.arrayBuffer();
      const b64 = typeof window !== "undefined" ? window.btoa(String.fromCharCode(...new Uint8Array(buf))) : "";
      return {
        name: f.name,
        mime: f.type || "application/octet-stream",
        size: f.size,
        content_base64: b64,
      };
    };
    const newOnes = await Promise.all(files.map(toAtt));
    setAttachments((prev) => [...prev, ...newOnes]);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);
  
  

  

  const runIdeaToProject = useCallback(async () => {
    const idea = ideaInput.trim();
    if (!idea) return;
    setIsGenerating(true);
    toast.dismiss();
    toast.loading("Scaffolding project…", { id: "gen" });
    try {
      // 1) Create or reuse sandbox (also returns preview skeleton)
      const sid = sessionId || crypto.randomUUID();
      setSessionId(sid);
      try {
        const { createSandbox } = await import("./utils/preview");
        await createSandbox(sid); // Let the agent determine the appropriate runtime
      } catch (e) {
        console.warn("sandbox create failed (continuing without sandbox)", e);
      }

      // 2) Ask backend to generate initial files for this idea
      const gen = await apiClient.generateProject({ idea, session_id: sid, selected_packs: selectedPacks, model_id: model });
      setSessionId(gen.session_id);
      setKiffId(gen.kiff_id);
      // Update URL with the new kiff id via Next router and remove any bootstrap 't' param
      try {
        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search);
          sp.set('kiff', gen.kiff_id);
          sp.delete('t');
          const q = sp.toString();
          router.replace(`${pathname}${q ? `?${q}` : ''}`);
        }
      } catch {}
      // 3) Apply generated files to sandbox (SSE); do not auto-set preview URL
      await new Promise<void>((resolve) => {
        let stopFn: () => void = () => {};
        (async () => {
          const { applyFilesSSE } = await import("./utils/preview");
          stopFn = applyFilesSSE(gen.session_id, gen.files || [], (evt) => {
            if (evt?.type === "server" && evt?.preview_url) {
              setDeployLogs((prev) => [...prev, `Preview server reported URL: ${evt.preview_url}`]);
            }
            if (evt?.type === "complete") {
              try { stopFn(); } catch {}
              resolve();
            }
          });
          sseStopRef.current = stopFn;
        })();
        // Safety timeout to avoid hanging if "complete" isn't emitted
        setTimeout(() => { try { stopFn(); } catch {} resolve(); }, 2000);
      });

      // 4) Set files directly from generated response (bypass sandbox requirement)
      let filesAfterApply: string[] = [];
      try {
        // Use generated files directly instead of fetching from sandbox
        const generatedFiles = gen.files || [];
        filesAfterApply = generatedFiles.map((f: any) => f.path);
        setFilePaths(filesAfterApply);
        
        // Select first file (prefer common entry points, fallback to first file)
        const firstTsx = filesAfterApply.find((p: string) => p.endsWith("app.py") || p.endsWith("main.py") || p.endsWith("server.py")) || 
                         filesAfterApply.find((p: string) => p.endsWith("app/page.tsx")) || 
                         filesAfterApply[0] || null;
        setSelectedPath(firstTsx);
        
        if (firstTsx) {
          // Get content directly from generated files instead of sandbox
          const selectedFile = generatedFiles.find((f: any) => f.path === firstTsx);
          setFileContent(selectedFile?.content || "");
        } else {
          setFileContent("");
        }
        
        // Store generated files for later access without sandbox dependency
        if (typeof window !== 'undefined' && gen.session_id) {
          localStorage.setItem(`files_${gen.session_id}`, JSON.stringify(generatedFiles));
        }
        
      } catch (e) {
        console.warn("Failed to process generated files", e);
        // Fallback to sandbox if available
        try {
          const { getFileTree, getFile } = await import("./utils/preview");
          const tree = await getFileTree(gen.session_id);
          filesAfterApply = tree.files || [];
          setFilePaths(filesAfterApply);
          const firstTsx = (filesAfterApply || []).find((p: string) => p.endsWith("app/page.tsx")) || (filesAfterApply || [])[0] || null;
          setSelectedPath(firstTsx);
          if (firstTsx) {
            const f = await getFile(gen.session_id, firstTsx);
            setFileContent(f.content || "");
          } else {
            setFileContent("");
          }
        } catch (sandboxError) {
          console.warn("Sandbox fallback also failed", sandboxError);
        }
      }

      // 5) Install dependencies if package.json exists
      try {
        const pkgPath = (filesAfterApply || []).find((p) => p === "package.json");
        if (pkgPath) {
          const { getFile, installPackagesSSE } = await import("./utils/preview");
          const pkg = await getFile(gen.session_id, pkgPath);
          const json = JSON.parse(pkg.content || "{}");
          const deps = Object.entries({ ...(json.dependencies || {}), ...(json.devDependencies || {}) })
            .map(([name, ver]) => `${name}@${ver}`)
            .filter(Boolean);
          if (deps.length) {
            setInstallState("Installing packages…");
            await installPackagesSSE(gen.session_id, deps, (evt) => {
              if (evt?.type === "progress") setInstallState(evt.message || "Installing…");
              if (evt?.type === "complete") setInstallState("Completed");
              if (evt?.type === "aborted") setInstallState("Install aborted — continuing");
            });
            // Auto preview disabled — do not fetch preview URL automatically. Use "Load Preview".
          }
        }
      } catch (e) {
        // Non-fatal
        console.warn("install step error", e);
      }

      // Preview URL is now set dynamically when server starts during file application
      // No need to fetch it again here

      // 7) Load the conversation history that was created during project generation
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/kiffs/${gen.kiff_id}/messages`, {
          headers: {
            "X-Tenant-ID": getTenantId(),
          },
        });
        if (response.ok) {
          const messages = await response.json();
          if (Array.isArray(messages) && messages.length > 0) {
            const chatMsgs: ChatMessage[] = messages.map(m => ({
              role: m.role,
              content: m.content,
              timestamp: m.created_at || new Date().toISOString(),
            }));
            setChatMessages(chatMsgs);
          }
        }
      } catch (e) {
        console.warn("Failed to load conversation history:", e);
        // Keep default messages if loading fails
      }

      toast.success("Ready", { id: "gen" });
    } catch (e) {
      console.error("idea-to-project error", e);
      toast.error("Generation failed", { id: "gen" });
    } finally {
      setIsGenerating(false);
    }
  }, [ideaInput, selectedPacks, sessionId, model, router, pathname]);

  // Auto preview disabled; rely on manual 'Load Preview' action instead of effects.
  useEffect(() => {
    // no-op
  }, [showPreviewOnly, sessionId, previewUrl]);

  // Auto preview restore disabled; rely on manual 'Load Preview'.
  useEffect(() => {
    // no-op
  }, [hasProject, sessionId, previewUrl]);

  // Persist selected packs per-kiff
  useEffect(() => {
    if (!kiffId) return;
    try {
      const packsKey = `kiff_packs_${kiffId}`;
      localStorage.setItem(packsKey, JSON.stringify(selectedPacks || []));
    } catch {}
  }, [kiffId, selectedPacks]);

  // Apply file updates coming from chat (kiff_update) and ensure preview refreshes
  useEffect(() => {
    (async () => {
      const update: any = kiffUpdate as any;
      if (!update || !sessionId) return;
      try {
        const files = Array.isArray(update.files) ? update.files : [];
        const shouldInstall = !!update.install_deps;
        if (!files.length && !shouldInstall) return;

        toast.loading("Applying changes…", { id: "kiff_update" });

        if (files.length) {
          // Dynamically import to ensure symbols are available in this scope
          const { applyFilesSSE, getFileTree, getFile, installPackagesSSE, getPreviewUrl } = await import("./utils/preview");
          await new Promise<void>((resolve) => {
            const stop = applyFilesSSE(sessionId, files as any, (evt) => {
              if (evt?.type === "server" && evt?.preview_url) {
                // Preview URL reported; manual loading is required to display it.
              }
              if (evt?.type === "complete") { stop(); resolve(); }
            });
            setTimeout(() => { try { stop(); } catch {} resolve(); }, 2000);
          });

          // Refresh tree (best effort) and currently opened file content
          try {
            const tree = await getFileTree(sessionId);
            setFilePaths(tree.files || []);
            if (selectedPath) {
              const f = await getFile(sessionId, selectedPath);
              setFileContent(f.content || "");
            }
          } catch {}
        }

        if (shouldInstall) {
          try {
            const { getFile, installPackagesSSE, getPreviewUrl } = await import("./utils/preview");
            const pkg = await getFile(sessionId, "package.json");
            const json = JSON.parse(pkg.content || "{}");
            const deps = Object.entries({ ...(json.dependencies || {}), ...(json.devDependencies || {}) })
              .map(([name, ver]) => `${name}@${ver}`)
              .filter(Boolean);
            if (deps.length) {
              setInstallState(`Installing ${deps.length} packages…`);
              await installPackagesSSE(sessionId, deps, (evt) => {
                if (evt?.type === "complete") setInstallState("Install complete");
                if (evt?.type === "aborted") setInstallState("Install aborted — continuing");
              });
            }
          } catch {}
          // Auto preview disabled — do not fetch preview URL automatically. Use "Load Preview".
        }

        toast.success("Ready", { id: "kiff_update" });
      } catch (e) {
        console.warn("Failed to apply kiff_update", e);
        toast.error("Failed to apply changes", { id: "kiff_update" });
      } finally {
        setKiffUpdate(null);
      }
    })();
  }, [kiffUpdate, sessionId, selectedPath, previewUrl]);

  // Do not auto-switch to Preview when a URL appears; keep manual control.
  useEffect(() => {}, [previewUrl]);

  // Auto-scroll logs to bottom when new entries arrive
  useEffect(() => {
    try {
      const el = logsRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }, [deployLogs, showDeployLogs]);

  // Prevent background scroll while logs modal is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (showDeployLogs) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showDeployLogs]);

  const runIdleGenerate = useCallback(async () => {
    if (!ideaInput.trim()) {
      ideaInputRef.current?.focus();
      return;
    }
    setHasProject(true);
    // small delay to show progress bar
    await new Promise((r) => setTimeout(r, 350));
    await runIdeaToProject();
  }, [ideaInput, runIdeaToProject]);

  // Retry a specific assistant message by resending the preceding user prompt
  const handleRetryAssistant = useCallback(async (assistantIndex: number) => {
    // Find the nearest previous user message before this assistant message
    const prior = chatMessages.slice(0, assistantIndex);
    const idxUserRev = prior.slice().reverse().findIndex((m) => m.role === "user");
    const idxUser = idxUserRev >= 0 ? prior.length - 1 - idxUserRev : -1;
    const lastUser = idxUser >= 0 ? chatMessages[idxUser] : chatMessages.slice().reverse().find((m) => m.role === "user");
    if (!lastUser) {
      toast.error("No prior user message to retry");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await apiClient.sendMessage({
        message: lastUser.content,
        chat_history: idxUser >= 0 ? chatMessages.slice(0, idxUser) : [],
        session_id: sessionId || undefined,
        kiff_id: kiffId || undefined,
        selected_packs: selectedPacks.length > 0 ? selectedPacks : undefined,
        model_id: model,
      });

      setSessionId(res.session_id);

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.content,
        timestamp: new Date().toISOString(),
        tool_calls: res.tool_calls as any,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      if (!chatOpen) setUnreadCount((n) => n + 1);

      if (res.kiff_update) setKiffUpdate(res.kiff_update);
    } catch (e) {
      console.error("retry error", e);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Retry failed. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
      toast.error("Retry failed");
    } finally {
      setIsGenerating(false);
    }
  }, [chatMessages, model, selectedPacks, sessionId, kiffId, chatOpen]);

  // Edit & resend: move content to input and focus
  const handleEditLastUser = useCallback((content: string) => {
    setChatInput(content);
    setTimeout(() => {
      try { chatInputRef.current?.focus(); } catch {}
    }, 0);
  }, []);

  // Keyboard shortcuts: '/' focuses idea, Cmd/Ctrl+Enter generates
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Focus idea
      if (e.key === '/' && !hasProject) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          ideaInputRef.current?.focus();
        }
      }
      // Generate
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        if (!hasProject) runIdleGenerate(); else handleChatSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasProject, handleChatSubmit, runIdleGenerate]);

  const resetAll = useCallback(() => {
    setHasProject(false);
    setIsGenerating(false);
    setSessionId(null);
    setKiffId(null);
    setFilePaths([]);
    setSelectedPath(null);
    setFileContent("");
    setPreviewUrl(null);
    setInstallState("");
    toast("Reset to idle");
  }, []);

  const handleLoadPreview = useCallback(async () => {
    try {
      const tenant = getTenantId();
      if (!tenant || tenant === "null" || tenant === "undefined") {
        toast.error("Missing tenant. Set X-Tenant-ID in localStorage.");
        setDeployLogs((prev) => [...prev, "❌ Missing X-Tenant-ID. Set a tenant and try again."]);
        return;
      }
      const sid = sessionId || crypto.randomUUID();
      if (!sessionId) setSessionId(sid);
      setDeployLogs((prev) => [...prev, "Creating sandbox…"]);
      const { createSandbox, restartDevServer, getPreviewUrl } = await import("./utils/preview");
      const info = await createSandbox(sid);
      let url: string | null = (info && (info as any).preview_url) || null;
      if (!url) {
        try { url = await getPreviewUrl(sid); } catch (e) { console.warn("getPreviewUrl failed", e); }
      }
      if (url) {
        setPreviewUrl(url);
        setShowPreviewOnly(true);
        setDeployLogs((prev) => [...prev, "Restarting development server…"]);
        try { await restartDevServer(sid); } catch (e) { console.warn("restartDevServer failed", e); }
        setDeployLogs((prev) => [...prev, "✅ Preview ready"]);
      } else {
        toast("Preview URL not available yet. Try again shortly.");
        setDeployLogs((prev) => [...prev, "⚠️ Preview URL not available yet"]);
      }
    } catch (e) {
      console.warn("handleLoadPreview error", e);
      toast.error("Failed to load preview");
      setDeployLogs((prev) => [...prev, `❌ Load preview error: ${String(e)}`]);
    }
  }, [sessionId]);

  const TopBar = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Rocket className="w-5 h-5 text-blue-600" />
        <h2 className="m-0 text-lg font-semibold">Launcher</h2>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPackManager((open) => !open)}
          className="flex items-center gap-1"
          aria-label="Manage Packs"
          title="Manage your selected packs"
          aria-pressed={showPackManager}
        >
          <Settings className="w-4 h-4" />
          Manage Packs
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white min-w-[1.25rem]">{selectedPacks.length}</span>
        </Button>
        {hasProject && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="flex items-center gap-1" aria-label="Reset">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        )}
        {hasProject && (
  <>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowPreviewOnly((v) => !v)}
      className="flex items-center gap-1"
      aria-label="Toggle preview"
      title="Toggle Live Preview"
    >
      {showPreviewOnly ? <FileCode className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
      {showPreviewOnly ? 'Files' : 'Preview'}
    </Button>
  </>
)}
      </div>
    </div>
  );

  // Inline top progress bar
  const ProgressBar = isGenerating ? (
    <div className="h-1 w-full bg-slate-200 rounded mt-3 overflow-hidden" aria-live="polite" aria-label="Generating">
      <div className="h-full w-1/2 bg-blue-600 animate-[progress_1.2s_linear_infinite] rounded" />
      <style jsx>{`
        @keyframes progress { 0% { transform: translateX(-50%); } 100% { transform: translateX(150%); } }
      `}</style>
    </div>
  ) : null;

  const IdleHero = (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '60vh' }}>
      <h1 className="text-4xl font-bold tracking-tight">Imagine. Build. Grow. Repeat</h1>
      <p className="mt-3 text-slate-600 max-w-xl">Describe an idea. I’ll deliver a working project.</p>
      <Card className="mt-6 w-full max-w-3xl overflow-visible">
        <CardContent className="p-4 overflow-visible">
          <div className="flex gap-2 items-stretch">
            {/* inline combobox removed; lives in status row */}

            <div className="relative flex-1">
              <Textarea
                 ref={ideaInputRef}
                 placeholder="e.g., A Next.js dashboard showing Stripe revenue with charts"
                 value={ideaInput}
                 onChange={(e) => { setIdeaInput(e.target.value); adjustIdeaHeight(); }}
                 onFocus={adjustIdeaHeight}
                 aria-label="Your idea"
                 rows={1}
                 className="w-full min-h-[52px] resize-none pr-12 py-2"
                 style={{ overflowY: 'hidden' }}
               />
               {/* Mobile inline send button */}
               <button
                 className="sm:hidden absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50"
                 onClick={runIdleGenerate}
                 disabled={isGenerating || !ideaInput.trim()}
                 aria-label="Generate"
                 title="Generate"
               >
                 <ArrowRight className="h-5 w-5" />
               </button>
            </div>
            {/* Desktop generate button */}
            <Button
              onClick={runIdleGenerate}
              disabled={isGenerating}
              aria-label="Generate"
              className="hidden sm:inline-flex rounded-lg px-4 py-2 text-base font-medium text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 h-[52px]"
            >
              {isGenerating ? 'Generating…' : 'Generate'}
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-start gap-3">
            {/* Status row model selector (left) */}
            {
              <div className="relative w-[200px] sm:w-[220px]" ref={modelMenuRef}>
                <div
                  role="combobox"
                  aria-expanded={modelMenuOpen ? 'true' : 'false'}
                  aria-controls="model-listbox"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      setModelMenuOpen(true);
                      setTimeout(() => { document.getElementById('model-listbox')?.focus(); }, 0);
                    }
                  }}
                  onClick={() => setModelMenuOpen((v) => !v)}
                  className="cursor-pointer select-none rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 h-[44px]"
                  aria-label="Model selector"
                >
                  <div className="flex items-center justify-between gap-2 h-full">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium leading-tight">{model}</div>
                      <div className="truncate text-[10px] leading-tight text-slate-500">Choose the AI model</div>
                    </div>
                    <svg className={`h-3.5 w-3.5 text-slate-500 transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.084l3.71-3.853a.75.75 0 111.08 1.04l-4.24 4.4a.75.75 0 01-1.08 0l-4.24-4.4a.75.75 0 01.02-1.06z" />
                    </svg>
                  </div>
                </div>
                {modelMenuOpen && modelOptions && modelOptions.length > 0 && (
                  <div
                    role="listbox"
                    id="model-listbox"
                    tabIndex={-1}
                    aria-label="Models"
                    className="absolute z-50 mt-1 left-0 w-[min(280px,90vw)] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setModelMenuOpen(false); return; }
                      if (e.key === 'ArrowDown') { e.preventDefault(); setModelHighlight((i) => Math.min((i ?? -1) + 1, modelOptions.length - 1)); return; }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setModelHighlight((i) => Math.max((i ?? modelOptions.length) - 1, 0)); return; }
                      if (e.key === 'Home') { e.preventDefault(); setModelHighlight(0); return; }
                      if (e.key === 'End') { e.preventDefault(); setModelHighlight(modelOptions.length - 1); return; }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const idx = modelHighlight ?? 0;
                        const sel = modelOptions[idx];
                        if (sel) { setModel(sel); setModelMenuOpen(false); }
                        return;
                      }
                      const ch = e.key?.toLowerCase();
                      if (ch && ch.length === 1 && /[a-z0-9_\-./]/.test(ch)) {
                        setModelTypeahead((s) => (s + ch).slice(-32));
                        const idx = modelOptions.findIndex((m) => m.toLowerCase().startsWith(((modelTypeahead || '') + ch)));
                        if (idx >= 0) setModelHighlight(idx);
                      }
                    }}
                  >
                    {modelOptions.map((m, i) => (
                      <div
                        role="option"
                        aria-selected={m === model}
                        key={m}
                        onMouseEnter={() => setModelHighlight(i)}
                        onMouseDown={(e) => { e.preventDefault(); }}
                        onClick={() => { setModel(m); setModelMenuOpen(false); }}
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
            }
            <div className="hidden sm:block text-xs text-slate-500">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 border">/</span> focus • <span className="px-1.5 py-0.5 rounded bg-slate-100 border">⌘/Ctrl</span>+<span className="px-1.5 py-0.5 rounded bg-slate-100 border">Enter</span> generate
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Packs context like Compose */}
      <div className="mt-4 text-sm text-slate-700">
        <div className="font-semibold">Supercharged by Packs</div>
        <div className="text-slate-500">
          {selectedPacks.length === 0 ? 'No Packs selected' : `${selectedPacks.length} Pack${selectedPacks.length>1?'s':''} selected`}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = '/api-gallery')}
            className="px-2"
          >
            Browse API Gallery
          </Button>
          <span className="h-4 w-px bg-slate-200" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.location.href = '/kiffs/packs')}
            className="px-2"
          >
            Customize Packs
          </Button>
        </div>
      </div>
    </div>
  );

  const Workspace = (
    <>
      {/* Columns */}
      {showPreviewOnly ? (
        <div className="mt-6 relative" style={{ height: 'calc(100vh - 260px)' }}>
          {/* Zoom toolbar */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded border bg-white/90 backdrop-blur px-2 py-1 shadow">
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={() => setPreviewScale((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(2))))}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="text-xs w-12 text-center">{Math.round(previewScale * 100)}%</div>
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={() => setPreviewScale((s) => Math.min(1.25, parseFloat((s + 0.1).toFixed(2))))}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={() => setPreviewScale(1)}
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          {/* Scrollable scaled preview */}
          <div className="h-full w-full overflow-auto flex items-start justify-center">
            {previewUrl ? (
              <div
                className="relative"
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  width: `calc(100% / ${previewScale})`,
                  height: `calc(100% / ${previewScale})`,
                }}
              >
                <iframe
                  src={previewUrl}
                  className="border-0 block"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                <div className="flex flex-col items-center gap-2">
                  <div>Preview not ready</div>
                  <Button size="sm" onClick={handleLoadPreview}>Load Preview</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 260px)' }}>
          {/* Right sheet-like Packs */}
          {showPackSelector && (
            <Card className="col-span-12 lg:col-span-3 overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Packs</CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-48px)]">
                {packConflict && (
                  <div className="px-3 pt-3">
                    <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs p-2 flex items-start justify-between gap-2">
                      <span>{packConflict}</span>
                      <button
                        className="text-amber-900/70 hover:text-amber-900 underline"
                        onClick={() => setPackConflict(null)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                <PackSelector
                  selectedPacks={selectedPacks}
                  onPacksChange={async (p)=>{
                    // Lock after chat starts
                    if (hasProject) {
                      setPackConflict("Packs are locked for this chat. Start a new chat to change packs.");
                      toast.error("Can't change packs during an active chat");
                      return;
                    }
                    const prev = selectedPacks;
                    setSelectedPacks(p);
                    setCurrentIdea(ideaInput);
                    // Sync to backend session if available (pre-chat)
                    try {
                      if (sessionId) {
                        const res = await apiClient.updateSessionPacks(sessionId, p);
                        if (res.status === 409) {
                          setSelectedPacks(prev);
                          setPackConflict("Another process locked packs for this session. Start a new chat to change packs.");
                          toast.error("Pack change conflicted (409)");
                        }
                      }
                    } catch (e) {
                      console.warn("updateSessionPacks failed", e);
                    }
                  }}
                  context={ideaInput}
                  className="h-full p-3 overflow-auto"
                  maxSelections={3}
                />
              </CardContent>
            </Card>
          )}

          {/* Files */}
          <Card className={`${showPackSelector ? 'col-span-12 lg:col-span-3' : 'col-span-12 lg:col-span-3'} overflow-hidden`}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Files</CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-48px)]">
              <FileExplorer
                files={filePaths}
                onSelect={async (p) => {
                  setSelectedPath(p);
                  if (sessionId) {
                    // Try to get file content from localStorage first (direct from generation)
                    try {
                      const storedFiles = localStorage.getItem(`files_${sessionId}`);
                      if (storedFiles) {
                        const parsedFiles = JSON.parse(storedFiles);
                        const selectedFile = parsedFiles.find((f: any) => f.path === p);
                        if (selectedFile) {
                          setFileContent(selectedFile.content || "");
                          return;
                        }
                      }
                    } catch {}
                    
                    // Fallback to sandbox if stored files not available
                    try {
                      const { getFile } = await import("./utils/preview");
                      const f = await getFile(sessionId, p);
                      setFileContent(f.content || "");
                    } catch (e) {
                      console.warn("Failed to load file content:", e);
                      setFileContent("// File content not available");
                    }
                  }
                }}
                selectedPath={selectedPath}
                className="h-full"
              />
            </CardContent>
          </Card>

          {/* Editor */}
          <Card className={`${showPackSelector ? 'col-span-12 lg:col-span-6' : 'col-span-12 lg:col-span-9'} overflow-hidden`}>
            <CardContent className="p-0 h-full">
              <FileEditor
                key={selectedPath || 'no-file'}
                path={selectedPath}
                content={fileContent}
                onChange={setFileContent}
                onSave={async () => {
                  if (!sessionId || !selectedPath) return;
                  await new Promise<void>(async (resolve) => {
                    const { applyFilesSSE } = await import("./utils/preview");
                    const stop = applyFilesSSE(
                      sessionId,
                      [{ path: selectedPath, content: fileContent } as any],
                      (evt) => {
                        if (evt?.type === "complete") {
                          try { stop(); } catch {}
                          resolve();
                        }
                      }
                    );
                    setTimeout(() => {
                      try { stop(); } catch {}
                      resolve();
                    }, 1000);
                  });
                  toast.success("Saved");
                }}
                readOnly={false}
                className="h-full"
              />
            </CardContent>
          </Card>

          {/* No preview column in Files mode */}
        </div>
      )}
    </>
  );

  return (
    <div className="app-shell">
      {/* Hide top navbar on mobile; rely on BottomNav */}
      <div className="hidden sm:block">
        <Navbar />
      </div>
      <Sidebar />
      <main className="pane pane-with-sidebar" style={{ paddingLeft: leftWidth + 24, overflow: 'hidden' }}>
        <PageContainer padded>
          {TopBar}
          {ProgressBar}
          {!hasProject ? IdleHero : Workspace}
        </PageContainer>
      </main>
      <BottomNav />

      {/* Floating Chat */}
      {hasProject && (
        <>
          {!chatOpen ? (
            <button
              className="fixed bottom-6 right-6 z-40 rounded-full bg-white shadow border px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50"
              onClick={() => { setChatOpen(true); setUnreadCount(0); }}
              aria-label="Open Kiff Agent"
            >
              <MessageSquare className="w-4 h-4" /> Kiff Agent
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-xs font-medium">
                  {unreadCount}
                </span>
              )}
            </button>
          ) : (
            <div
              className="fixed bottom-6 right-6 z-50 w-[calc(100vw-2rem)] md:w-[75vw] max-w-[1400px] h-[80vh]"
            >
              <Card className="w-full h-full shadow-xl border bg-white dark:bg-neutral-900">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="m-0 text-base md:text-lg">Kiff Agent</CardTitle>
                  <div className="flex items-center gap-2 ml-auto">
                    {isGenerating && (
                      <>
                        <span className="text-xs text-gray-600 animate-pulse">Generating…</span>
                        <button
                          className="inline-flex items-center gap-1 md:gap-2 p-2 md:p-2.5 rounded-full bg-red-50 hover:bg-red-100 border text-red-700"
                          onClick={() => { try { abortRef.current?.abort(); } catch {}; setIsGenerating(false); }}
                          aria-label="Stop"
                          title="Stop"
                        >
                          <X className="w-4 h-4" />
                          <span className="hidden md:inline text-sm font-medium">Stop</span>
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    className="inline-flex items-center gap-1 md:gap-2 p-2 md:p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 border text-gray-700"
                    onClick={() => setChatOpen(false)}
                    aria-label="Close Kiff Agent"
                    title="Close"
                  >
                    <X className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden md:inline text-sm font-medium">Close</span>
                  </button>
                </CardHeader>
                <CardContent className="p-0 flex flex-col h-[calc(100%-48px)] bg-white dark:bg-neutral-900">
                  <div className="flex-1 overflow-auto">
                    <ChatHistory
                      messages={chatMessages}
                      onRetryAssistant={handleRetryAssistant}
                      onEditLastUser={handleEditLastUser}
                      onApproveProposal={handleApproveProposal}
                      onRejectProposal={handleRejectProposal}
                    />
                  </div>
                  <div className="border-t">
                    <ChatInput
                      value={chatInput}
                      onChange={setChatInput}
                      onSubmit={handleChatSubmit}
                      isGenerating={isGenerating}
                      autoFocus
                      inputRef={chatInputRef}
                      attachments={attachments}
                      onAddFiles={handleAddFiles}
                      onRemoveAttachment={handleRemoveAttachment}
                      modelOptions={[]}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Pack Manager Modal */}
      <PackManagerModal
        open={showPackManager}
        onClose={() => setShowPackManager(false)}
        selectedPacks={selectedPacks}
        onRemovePack={async (packId) => {
          if (hasProject) {
            setPackConflict("Packs are locked for this chat. Start a new chat to change packs.");
            toast.error("Can't change packs during an active chat");
            return;
          }
          const next = selectedPacks.filter(id => id !== packId);
          const prev = selectedPacks;
          setSelectedPacks(next);
          removePackGlobal(packId);
          try {
            if (sessionId) {
              const res = await apiClient.updateSessionPacks(sessionId, next);
              if (res.status < 200 || res.status >= 300) {
                setSelectedPacks(prev);
                toast.error("Failed to update packs");
              }
            }
          } catch (e) {
            console.warn("onRemovePack updateSessionPacks failed", e);
            setSelectedPacks(prev);
            toast.error("Failed to update packs");
          }
        }}
        onClearAll={async () => {
          if (hasProject) {
            setPackConflict("Packs are locked for this chat. Start a new chat to change packs.");
            toast.error("Can't change packs during an active chat");
            return;
          }
          const prev = selectedPacks;
          setSelectedPacks([]);
          setGlobalSelectedPacks([]);
          try {
            if (sessionId) {
              const res = await apiClient.updateSessionPacks(sessionId, []);
              if (res.status < 200 || res.status >= 300) {
                setSelectedPacks(prev);
                setGlobalSelectedPacks(prev);
                toast.error("Failed to clear packs");
              }
            }
          } catch (e) {
            console.warn("onClearAll updateSessionPacks failed", e);
            setSelectedPacks(prev);
            setGlobalSelectedPacks(prev);
            toast.error("Failed to clear packs");
          }
        }}
        />
      

      {/* Deploy Logs Toggle (top-right) */}
      {hasProject && (
        <button
          className="fixed top-4 right-4 z-40 rounded-full bg-white shadow border px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50"
          onClick={() => setShowDeployLogs(true)}
          aria-label="Open Deploy Logs"
        >
          <RotateCcw className="w-4 h-4" />
          Logs
          {deployLogs.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-slate-800 text-white text-xs font-medium">
              {deployLogs.length}
            </span>
          )}
        </button>
      )}

      {/* Deploy Logs Modal (fills app, slides from top-right) */}
      {showDeployLogs && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowDeployLogs(false)} />
          <div className="absolute top-0 right-0 w-full md:w-[85vw] lg:w-[80vw] h-full">
            <Card className="w-full h-full rounded-none shadow-2xl border-0">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  <CardTitle className="m-0 text-base md:text-lg">Deploy Logs</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 border text-gray-700 text-sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(deployLogs.join('\n'));
                        toast.success('Logs copied');
                      } catch {
                        toast.error('Copy failed');
                      }
                    }}
                    aria-label="Copy Logs"
                    title="Copy"
                  >
                    Copy
                  </button>
                  <button
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 border text-gray-700 text-sm"
                    onClick={() => setDeployLogs([])}
                    aria-label="Clear Logs"
                    title="Clear"
                  >
                    Clear
                  </button>
                  <button
                    className="inline-flex items-center gap-2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 border text-gray-700"
                    onClick={() => setShowDeployLogs(false)}
                    aria-label="Close Deploy Logs"
                    title="Close"
                  >
                    <X className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden md:inline text-sm font-medium">Close</span>
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-48px)] flex flex-col">
                <div ref={logsRef} className="flex-1 overflow-auto overscroll-contain px-4 py-3 bg-black text-green-200 font-mono text-xs leading-relaxed select-text cursor-text">
                  {deployLogs.length === 0 ? (
                    <div className="text-gray-400">No logs yet…
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words">
{deployLogs.map((line, idx) => `${idx + 1}`.padStart(3, ' ') + ` | ${line}\n`).join("")}
                    </pre>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// Pack Manager Modal Component
function PackManagerModal({
  open,
  onClose,
  selectedPacks,
  onRemovePack,
  onClearAll
}: {
  open: boolean;
  onClose: () => void;
  selectedPacks: string[];
  onRemovePack: (packId: string) => void | Promise<void>;
  onClearAll: () => void | Promise<void>;
}) {
  const [packDetails, setPackDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const packsKey = useMemo(() => {
    // Stable signature to avoid effect re-running due to array identity changes
    return selectedPacks && selectedPacks.length
      ? [...selectedPacks].join(',')
      : '';
  }, [selectedPacks]);

  // Fetch pack details when modal opens
  useEffect(() => {
    let cancelled = false;
    if (!open || packsKey === '') {
      // Avoid infinite re-render by only updating when state actually changes
      setPackDetails((prev) => (prev.length ? [] : prev));
      return;
    }
    
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const details = await Promise.all(
          selectedPacks.map(async (packId) => {
            try {
              const pack = await apiJson(`/api/packs/${packId}`, { method: 'GET' });
              return pack;
            } catch (error) {
              console.warn(`Failed to fetch pack ${packId}:`, error);
              return {
                id: packId,
                display_name: `Pack ${packId}`,
                category: 'Unknown',
                created_by_name: 'Unknown',
                description: 'Pack details unavailable',
                logo_url: null
              };
            }
          })
        );
        if (!cancelled) setPackDetails(details);
      } catch (error) {
        console.error('Failed to fetch pack details:', error);
        if (!cancelled) setPackDetails([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetails();
    return () => { cancelled = true; };
  }, [open, packsKey, selectedPacks]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Manage Selected Packs</h2>
          </div>
          <button
            className="p-2 hover:bg-gray-100 rounded-full"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : packDetails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium text-gray-700">No packs selected</p>
              <p className="text-sm mb-4">Add packs to supercharge your experience</p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = '/api-gallery')}
                  className="px-2"
                >
                  Browse API Gallery
                </Button>
                <span className="h-4 w-px bg-slate-200" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = '/kiffs/packs')}
                  className="px-2"
                >
                  Customize Packs
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {packDetails.map((pack) => (
                <div key={pack.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {pack.logo_url && !failedLogos[pack.id] ? (
                      <Image
                        src={pack.logo_url}
                        alt={`${pack.display_name} logo`}
                        width={32}
                        height={32}
                        className="w-8 h-8 object-contain"
                        unoptimized
                        onError={() => setFailedLogos((prev) => ({ ...prev, [pack.id]: true }))}
                      />
                    ) : (
                      <Package className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{pack.display_name}</h3>
                    <p className="text-sm text-gray-600 truncate">{pack.category} • by {pack.created_by_name}</p>
                    {pack.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{pack.description}</p>
                    )}
                  </div>
                  <button
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
                    onClick={() => onRemovePack(pack.id)}
                    aria-label={`Remove ${pack.display_name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-600">
            {packDetails.length} pack{packDetails.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              disabled={packDetails.length === 0}
              className="flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LauncherPage() {
  return (
    <>
      <Suspense fallback={<div className="p-4 text-sm text-slate-600">Loading…</div>}>
        <LauncherPageContent />
      </Suspense>
      <Suspense fallback={null}>
        <IntroModalGate />
      </Suspense>
    </>
  );
}

// A small client component responsible solely for controlling the intro modal.
// It uses useSearchParams and is rendered within a Suspense boundary to satisfy Next.js requirements.
function IntroModalGate() {
  const [open, setOpen] = useState(false);
  const searchParamsTop = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = "seen_intro_modal_v1";
    const introParam = searchParamsTop?.get("intro");
    if (introParam === "reset") {
      try { window.localStorage.removeItem(k); } catch {}
    }
    if (introParam === "welcome") {
      setOpen(true);
    } else if (!window.localStorage.getItem(k)) {
      setOpen(true);
    }
  }, [searchParamsTop]);

  const onClose = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("seen_intro_modal_v1", "1");
      }
    } catch {}
    setOpen(false);
  }, []);

  return <FeatureIntroModal open={open} onClose={onClose} />;
}
