"use client";

import React from "react";
import Image from "next/image";
import { Rocket } from "lucide-react";
import { API_BASE_URL, DEFAULT_TENANT_ID } from "@/lib/constants";

function getTenantId(): string {
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem("tenant_id");
    if (fromStorage && fromStorage !== "null" && fromStorage !== "undefined") return fromStorage;
  }
  return process.env.NEXT_PUBLIC_TENANT_ID || DEFAULT_TENANT_ID;
}

export type ProviderIcon = {
  provider_id: string;
  name: string;
  logo_url?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function FeatureIntroModal({ open, onClose }: Props) {
  const [icons, setIcons] = React.useState<ProviderIcon[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [exampleIndex, setExampleIndex] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(true);
  const [shown, setShown] = React.useState<{ providers: string[]; text: string }[]>([]);
  const typeIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (open) {
      const prev = body.style.overflow;
      body.setAttribute("data-prev-overflow", prev || "");
      body.style.overflow = "hidden";
    } else {
      const prev = body.getAttribute("data-prev-overflow");
      if (prev !== null) body.style.overflow = prev;
      else body.style.overflow = "";
      body.removeAttribute("data-prev-overflow");
    }
    return () => {
      const prev = body.getAttribute("data-prev-overflow");
      if (prev !== null) body.style.overflow = prev;
      else body.style.overflow = "";
      body.removeAttribute("data-prev-overflow");
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const tenantId = getTenantId();
        const res = await fetch(`${API_BASE_URL}/api-gallery/providers`, {
          headers: { "X-Tenant-ID": tenantId },
          cache: "no-store",
        });
        if (!aborted && res.ok) {
          const data = (await res.json()) as any[];
          // Prefer popular providers if available
          const preferred = ["OpenAI", "Anthropic", "Google Gemini AI", "Groq", "ElevenLabs", "Hugging Face"];
          const sorted = data
            .slice()
            .sort((a, b) => {
              const ai = preferred.indexOf(a.name);
              const bi = preferred.indexOf(b.name);
              const as = ai === -1 ? 999 : ai;
              const bs = bi === -1 ? 999 : bi;
              return as - bs;
            })
            .slice(0, 8)
            .map((p) => ({ provider_id: p.provider_id, name: p.name, logo_url: p.logo_url } as ProviderIcon));
          setIcons(sorted);
        }
      } catch {
        // ignore
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [open]);

  // Clearbit domain fallback for common providers
  const CLEARBIT_MAP: Record<string, string> = React.useMemo(() => ({
    groq: "groq.com",
    leonardo: "leonardo.ai",
    "leonardo ai": "leonardo.ai",
    elevenlabs: "elevenlabs.io",
    stripe: "stripe.com",
    anthropic: "anthropic.com",
    openai: "openai.com",
    twilio: "twilio.com",
    "google gemini": "google.com",
    google: "google.com",
    gemini: "ai.google.dev",
    supabase: "supabase.com",
    "hugging face": "huggingface.co",
  }), []);

  // Build a lookup to resolve provider logo by fuzzy name with Clearbit fallback
  const logoFor = React.useCallback(
    (name: string): string | undefined => {
      const norm = name.toLowerCase();
      const found = icons.find((p) => p.name?.toLowerCase().includes(norm));
      const url = found?.logo_url || undefined;
      if (url) return url;
      const domain = CLEARBIT_MAP[norm];
      if (domain) return `https://logo.clearbit.com/${domain}`;
      return undefined;
    },
    [icons, CLEARBIT_MAP]
  );

  // Animated examples: provider combos + prompt lines
  const examples = React.useMemo(
    () => [
      {
        providers: ["Groq", "Leonardo", "ElevenLabs"],
        prompt: " build an animated storybook with an AI agent",
      },
      {
        providers: ["ElevenLabs", "Groq", "Stripe"],
        prompt: " build a talking agent that automates checkout",
      },
    
      {
        providers: ["Groq", "Twilio"],
        prompt: " set up an AI SMS concierge that sets appointments",
      },
   
    ],
    []
  );

  // Typing animation for prompt lines
  React.useEffect(() => {
    // When modal opens, reset stacked examples and typing state
    if (open) {
      setShown([]);
      setExampleIndex(0);
      setTyped("");
      setIsTyping(true);
    } else {
      // On close, clear any timers
      if (startDelayRef.current) clearTimeout(startDelayRef.current);
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || examples.length === 0) return;
    if (exampleIndex >= examples.length) return; // stop after last
    const current = examples[exampleIndex];
    const promptStr = (current?.prompt ?? "").replace(/^\s+/, "");
    // Reset typing state
    setTyped("");
    setIsTyping(true);

    // Clear any previous timers
    if (startDelayRef.current) clearTimeout(startDelayRef.current);
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    let i = 0;
    startDelayRef.current = setTimeout(() => {
      typeIntervalRef.current = setInterval(() => {
        const ch = promptStr.charAt(i);
        if (i < promptStr.length && ch) {
          setTyped((t) => t + ch);
          i += 1;
        } else {
          setIsTyping(false);
          if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
          // Push completed example into shown list
          setShown((prev) => [...prev, { providers: current.providers, text: promptStr }]);
          // Hold then advance to next (if any)
          holdTimeoutRef.current = setTimeout(() => {
            setExampleIndex((idx) => idx + 1);
          }, 2600);
        }
      }, 42);
    }, 220);

    return () => {
      if (startDelayRef.current) clearTimeout(startDelayRef.current);
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    };
  }, [open, exampleIndex, examples]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["Groq","Leonardo","ElevenLabs","Hugging Face","Stripe","Supabase"].map((name) => {
                  const src = logoFor(name);
                  return (
                    <img key={name} src={src || ""} alt={name} className="h-7 w-7 rounded-full ring-2 ring-white dark:ring-gray-900 object-contain bg-white" />
                  );
                })}
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Welcome to Kiff</h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] items-stretch">
            {/* Left: copy */}
            <div className="p-5 md:p-6 space-y-3">
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">From idea to running app, in minutes.</h3>

              <div className="space-y-2">
                <FeatureItem title="API Gallery">
                  Curated provider APIs with indexed docs ready for you.
                </FeatureItem>
                <FeatureItem title="Packs">
                  Reusable, processed API knowledge (docs + patterns) you attach to your Agents.
                </FeatureItem>
                <FeatureItem title="Launcher">
                  Chat-driven builder with live preview: generate, edit files, and iterate quickly.
                </FeatureItem>
              </div>

              <div className="pt-1">
                <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 px-3.5 py-2 text-white shadow-md hover:brightness-105 text-sm">
                  Get Started
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>

            {/* Right: hero image with stacked examples */}
            <div className="relative p-5 md:p-6 bg-gradient-to-b from-gray-50 to-white dark:from-white/5 dark:to-white/0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800">
              <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-[#0f172a] h-[80%] md:h-[80%] flex flex-col">
                {/* Image backdrop */}
                <div className="relative flex-1">
                  <Image src="/intro-hero.svg" alt="Kiff hero" fill priority className="object-cover" />
                  {/* Stacked example bubbles container */}
                  <div className="absolute inset-0 flex flex-col justify-end gap-2 p-3 md:p-4">
                    {/* Render already shown examples */}
                    {shown.map((ex, i) => (
                      <div key={i} className="mx-2 md:mx-3 w-[96%] md:w-[96%] rounded-lg bg-white/90 dark:bg-black/60 backdrop-blur border border-gray-200 dark:border-gray-700 px-3 py-2 shadow-sm">
                        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-800 dark:text-gray-100">
                          {ex.providers.map((p, idx, arr) => (
                            <React.Fragment key={p + idx}>
                              <div className="flex items-center gap-1">
                                {logoFor(p) ? (
                                  <img src={logoFor(p)} alt={p} className="h-5 w-5 object-contain rounded bg-white" />
                                ) : (
                                  <div className="h-5 w-5 rounded bg-gray-200" />
                                )}
                                <span className="hidden sm:inline text-[11px] text-gray-600 dark:text-gray-300">{p}</span>
                              </div>
                              {idx < arr.length - 1 ? (
                                <span className="opacity-70">+</span>
                              ) : (
                                <span className="opacity-70">=</span>
                              )}
                            </React.Fragment>
                          ))}
                          <Rocket className="ml-1 h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="mt-1 font-mono text-[12px] md:text-[13px] text-gray-900 dark:text-gray-100">
                          <span className="opacity-70">&quot;</span>{ex.text}<span className="opacity-70">&quot;</span>
                        </div>
                      </div>
                    ))}
                    {/* Current typing bubble (only if more examples pending) */}
                    {exampleIndex < examples.length && isTyping && (
                      <div className="mx-2 md:mx-3 w-[96%] md:w-[96%] rounded-lg bg-white/90 dark:bg-black/60 backdrop-blur border border-gray-200 dark:border-gray-700 px-3 py-2 shadow-sm">
                        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-800 dark:text-gray-100">
                          {(examples[exampleIndex]?.providers || []).map((p, idx, arr) => (
                            <React.Fragment key={p + idx}>
                              <div className="flex items-center gap-1">
                                {logoFor(p) ? (
                                  <img src={logoFor(p)} alt={p} className="h-5 w-5 object-contain rounded bg-white" />
                                ) : (
                                  <div className="h-5 w-5 rounded bg-gray-200" />
                                )}
                                <span className="hidden sm:inline text-[11px] text-gray-600 dark:text-gray-300">{p}</span>
                              </div>
                              {idx < arr.length - 1 ? (
                                <span className="opacity-70">+</span>
                              ) : (
                                <span className="opacity-70">=</span>
                              )}
                            </React.Fragment>
                          ))}
                          <Rocket className="ml-1 h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="mt-1 font-mono text-[12px] md:text-[13px] text-gray-900 dark:text-gray-100">
                          <span className="opacity-70">&quot;</span>{typed}<span className="opacity-70">&quot;</span>
                          <span className={`inline-block ml-1 h-4 w-2 align-middle bg-gray-900 dark:bg-gray-100 ${isTyping ? 'animate-pulse' : 'opacity-0'}`} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Caption below animation */}
              <div className="mt-3 text-sm md:text-base leading-5 md:leading-6 text-gray-900 dark:text-gray-100">
                Pick APIs you already use (or wish you could use), describe what you want, and KIFF ships your idea grounded in real docs.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{title}</div>
      {subtitle ? <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{subtitle}</div> : null}
      <div className="text-[13px] leading-5 text-gray-600 dark:text-gray-300">{children}</div>
    </div>
  );
}
