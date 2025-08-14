import { ChatMessage, SendMessageRequest, SendMessageResponse } from "../types";

const DEFAULT_TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d";

export function getTenantId(): string {
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem("tenant_id");
    if (fromStorage && fromStorage !== "null" && fromStorage !== "undefined") return fromStorage;
  }
  return process.env.NEXT_PUBLIC_TENANT_ID || DEFAULT_TENANT_ID;
}

export function getBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000"
  );
}

function debugLog(...args: any[]) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[api]', ...args);
  }
}

// Validate tenant before sending requests (recurring issue guard)
function validateTenant(): string {
  const t = getTenantId();
  if (!t || t === 'null' || t === 'undefined') {
    const msg = 'Tenant ID missing. Ensure X-Tenant-ID is configured.';
    debugLog(msg);
    throw new Error(msg);
  }
  return t;
}

// Simple retry with exponential backoff for 429s and transient network errors
async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; baseDelayMs?: number }): Promise<T> {
  const retries = opts?.retries ?? 2;
  const baseDelay = opts?.baseDelayMs ?? 250;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      const is429 = typeof e?.message === 'string' && /\b429\b/.test(e.message);
      if (attempt >= retries || !is429) throw e;
      const delay = baseDelay * Math.pow(1.5, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
}

// Fetch with timeout and optional external AbortSignal
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number; signal?: AbortSignal } = {}) {
  const { timeoutMs, signal, ...rest } = init;
  if (!timeoutMs && !signal) return fetch(input, rest);
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const onAbort = () => controller.abort();
  try {
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    const res = await fetch(input, { ...rest, signal: controller.signal });
    return res;
  } finally {
    if (timer) clearTimeout(timer as any);
    if (signal) signal.removeEventListener('abort', onAbort as any);
  }
}

export const apiClient = {
  async updateSessionPacks(session_id: string, selected_packs: string[]): Promise<{ status: number }> {
    const tenant = validateTenant();
    const url = `${getBackendUrl()}/api/launcher/session/${encodeURIComponent(session_id)}/packs`;
    const res = await withRetry(() => fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenant,
      },
      body: JSON.stringify({ selected_packs }),
      timeoutMs: 30000,
    }));
    return { status: res.status };
  },
  async approveProposal(payload: { session_id: string; proposal_id: string }): Promise<{ status: string }> {
    const tenant = validateTenant();
    const res = await withRetry(() => fetchWithTimeout(`${getBackendUrl()}/api/chat/proposals/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenant,
      },
      body: JSON.stringify(payload),
      timeoutMs: 30000,
    }));
    if (!res.ok) throw new Error(`approveProposal failed: ${res.status}`);
    return res.json();
  },

  async rejectProposal(payload: { session_id: string; proposal_id: string }): Promise<{ status: string }> {
    const tenant = validateTenant();
    const res = await withRetry(() => fetchWithTimeout(`${getBackendUrl()}/api/chat/proposals/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenant,
      },
      body: JSON.stringify(payload),
      timeoutMs: 30000,
    }));
    if (!res.ok) throw new Error(`rejectProposal failed: ${res.status}`);
    return res.json();
  },

  async setHitlMode(payload: { session_id: string; require_approval: boolean }): Promise<{ status: string; require_approval: boolean }> {
    const tenant = validateTenant();
    const res = await withRetry(() => fetchWithTimeout(`${getBackendUrl()}/api/chat/hitl/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenant,
      },
      body: JSON.stringify(payload),
      timeoutMs: 30000,
    }));
    if (!res.ok) throw new Error(`toggle HITL failed: ${res.status}`);
    return res.json();
  },
  // Streaming helper: tries stream endpoint; falls back to non-streaming
  async sendMessageStream(
    payload: Omit<SendMessageRequest, "chat_history"> & { chat_history: ChatMessage[] },
    handlers: {
      onToken: (text: string) => void;
      onDone: (final: SendMessageResponse | null) => void;
      onError: (err: any) => void;
      onEvent?: (evt: any) => void; // receives structured SSE events like ProposedFileChanges
      signal?: AbortSignal;
    }
  ) {
    const base = getBackendUrl();
    const urlCandidates = [
      `${base}/api/chat/stream-message`,
    ];
    debugLog('sendMessageStream candidate', urlCandidates[0]);
    let lastErr: any = null;
    for (const url of urlCandidates) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": validateTenant(),
          },
          body: JSON.stringify(payload),
          signal: handlers.signal,
        });
        if (!res.ok) {
          lastErr = new Error(`stream failed: ${res.status} @ ${url}`);
          debugLog('stream failed', res.status, url);
          continue;
        }
        const ctype = res.headers.get('content-type') || '';
        debugLog('stream content-type', ctype);
        // Expect text/event-stream or chunked text
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no reader");
        const decoder = new TextDecoder();
        let buffer = "";
        let emittedSession = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Parse SSE-style lines: data: {json} or data: token
          const parts = buffer.split(/\n\n|\r\n\r\n/);
          // keep last partial
          buffer = parts.pop() || "";
          for (const chunk of parts) {
            const lines = chunk.split(/\n|\r\n/).filter(Boolean);
            for (const line of lines) {
              const m = line.match(/^data:\s*(.*)$/);
              if (m) {
                const data = m[1];
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  // If backend surfaces session_id early, notify page exactly once
                  if (!emittedSession && parsed && typeof parsed.session_id === 'string') {
                    emittedSession = true;
                    try { handlers.onEvent && handlers.onEvent({ type: 'SessionStarted', session_id: parsed.session_id }); } catch {}
                  }
                  if (typeof parsed?.token === "string") handlers.onToken(parsed.token);
                  if (parsed?.content) handlers.onToken(String(parsed.content));
                  // forward structured events when present
                  if (parsed?.type && handlers.onEvent) handlers.onEvent(parsed);
                } catch {
                  // Fallback handling:
                  // 1) Ignore noisy debug/metrics lines from backend streams
                  const trimmed = data.trim();
                  if (
                    trimmed.startsWith("DEBUG") ||
                    trimmed.startsWith("*** METRICS") ||
                    /Tokens per second/i.test(trimmed) ||
                    /Groq Async Response Stream End/i.test(trimmed)
                  ) {
                    continue;
                  }
                  // 2) Extract token from non-JSON payloads like: {"token": ' word' } or {token: ' word'}
                  const tokenMatch = trimmed.match(/(?:^|[,{\s])\"?token\"?\s*:\s*(['\"])(.*?)\1/);
                  if (tokenMatch && tokenMatch[2] != null) {
                    handlers.onToken(tokenMatch[2]);
                    continue;
                  }
                  // 3) Some providers stream plain text tokens without JSON
                  // If the payload looks like plain text (no braces), pass it through
                  if (!/[{}\[\]]/.test(trimmed)) {
                    handlers.onToken(trimmed);
                    continue;
                  }
                  // 4) As a last resort, ignore raw JSON-like blobs to avoid polluting UI
                  // You may log them for diagnostics, but do not surface to user
                  // console.debug('Unparsed SSE data', trimmed);
                }
              }
            }
          }
        }
        // try to parse final body if available via trailer endpoint
        try {
          const text = buffer.trim();
          if (text) {
            const maybe = JSON.parse(text);
            handlers.onDone(maybe);
            return;
          }
        } catch {}
        handlers.onDone(null);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    // Fallback to non-streaming request
    try {
      const non = await apiClient.sendMessage(payload);
      handlers.onToken(non.content);
      handlers.onDone(non);
    } catch (e) {
      handlers.onError(lastErr || e);
    }
  },
  async sendMessage(payload: Omit<SendMessageRequest, "chat_history"> & { chat_history: ChatMessage[] }, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<SendMessageResponse> {
    const base = getBackendUrl();
    const url = `${base}/api/chat/send-message`;
    debugLog('sendMessage endpoint', url);
    const res = await withRetry(() => fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": validateTenant(),
      },
      body: JSON.stringify(payload),
      signal: opts?.signal,
      timeoutMs: opts?.timeoutMs ?? 60000,
    }));
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`send-message failed: ${res.status} @ ${url} ${text}`);
    }
    return res.json();
  },

  async generateProject(payload: { idea: string; session_id?: string; selected_packs?: string[]; user_id?: string; kiff_id?: string; model_id?: string }, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<{ session_id: string; files: { path: string; content: string; language?: string }[]; kiff_id: string }>{
    const res = await withRetry(() => fetchWithTimeout(`${getBackendUrl()}/api/launcher/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": validateTenant(),
      },
      body: JSON.stringify({
        idea: payload.idea,
        session_id: payload.session_id,
        selected_packs: payload.selected_packs,
        user_id: payload.user_id,
        kiff_id: payload.kiff_id,
        model_id: payload.model_id,
      }),
      signal: opts?.signal,
      timeoutMs: opts?.timeoutMs ?? 120000,
    }));
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`generateProject failed: ${res.status} ${text}`);
    }
    return res.json();
  },

  async fetchModels(): Promise<string[]> {
    const res = await fetch(`${getBackendUrl()}/api/models`, {
      method: "GET",
      headers: {
        "X-Tenant-ID": validateTenant(),
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (Array.isArray((data as any).models) ? (data as any).models : []);
    return arr
      .map((m: any) => (typeof m === "string" ? m : (m && (m.id || (m as any).name)) || null))
      .filter(Boolean);
  },
};
