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

export const apiClient = {
  async updateSessionPacks(session_id: string, selected_packs: string[]): Promise<{ status: number }> {
    const res = await fetch(`${getBackendUrl()}/api/launcher/session/${encodeURIComponent(session_id)}/packs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": getTenantId(),
      },
      body: JSON.stringify({ selected_packs }),
    });
    return { status: res.status };
  },
  async approveProposal(payload: { session_id: string; proposal_id: string }): Promise<{ status: string }> {
    const res = await fetch(`${getBackendUrl()}/api/chat/proposals/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": getTenantId(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`approveProposal failed: ${res.status}`);
    return res.json();
  },

  async rejectProposal(payload: { session_id: string; proposal_id: string }): Promise<{ status: string }> {
    const res = await fetch(`${getBackendUrl()}/api/chat/proposals/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": getTenantId(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`rejectProposal failed: ${res.status}`);
    return res.json();
  },

  async setHitlMode(payload: { session_id: string; require_approval: boolean }): Promise<{ status: string; require_approval: boolean }> {
    const res = await fetch(`${getBackendUrl()}/api/chat/hitl/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": getTenantId(),
      },
      body: JSON.stringify(payload),
    });
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
    const urlCandidates = [
      `${getBackendUrl()}/api/chat/stream-message`,
      `${getBackendUrl()}/api/chat/send-message/stream`,
    ];
    let lastErr: any = null;
    for (const url of urlCandidates) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-ID": getTenantId(),
          },
          body: JSON.stringify(payload),
          signal: handlers.signal,
        });
        if (!res.ok) {
          lastErr = new Error(`stream failed: ${res.status}`);
          continue;
        }
        // Expect text/event-stream or chunked text
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no reader");
        const decoder = new TextDecoder();
        let buffer = "";
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
                  if (typeof parsed?.token === "string") handlers.onToken(parsed.token);
                  if (parsed?.content) handlers.onToken(String(parsed.content));
                  // forward structured events when present
                  if (parsed?.type && handlers.onEvent) handlers.onEvent(parsed);
                } catch {
                  handlers.onToken(data);
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
  async sendMessage(payload: Omit<SendMessageRequest, "chat_history"> & { chat_history: ChatMessage[] }): Promise<SendMessageResponse> {
    const res = await fetch(`${getBackendUrl()}/api/chat/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": getTenantId(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`send-message failed: ${res.status} ${text}`);
    }
    return res.json();
  },

  async generateProject(payload: { idea: string; session_id?: string; selected_packs?: string[]; user_id?: string; kiff_id?: string; model_id?: string }): Promise<{ session_id: string; files: { path: string; content: string; language?: string }[]; kiff_id: string }>{
    const res = await fetch(`${getBackendUrl()}/api/launcher/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": getTenantId(),
      },
      body: JSON.stringify({
        idea: payload.idea,
        session_id: payload.session_id,
        selected_packs: payload.selected_packs,
        user_id: payload.user_id,
        kiff_id: payload.kiff_id,
        model_id: payload.model_id,
      }),
    });
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
        "X-Tenant-ID": getTenantId(),
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
