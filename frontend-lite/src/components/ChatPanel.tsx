"use client";
import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import type { ModelId } from "@/lib/constants";
import { apiJson } from "@/lib/api";

function normalizeModelIds(input: any): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : (Array.isArray((input as any).models) ? (input as any).models : []);
  return arr
    .map((m: any) => (typeof m === "string" ? m : (m && (m.id || (m as any).name)) || null))
    .filter(Boolean);
}

export function ChatPanel({
  messages,
  model,
  onModelChange,
  onSend,
}: {
  messages: ChatMessage[];
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<any>("/api/models", { method: "GET" });
        if (cancelled) return;
        const ids = normalizeModelIds(res);
        if (ids.length) {
          setModels(ids);
          if (!ids.includes(model)) onModelChange(ids[0] as ModelId);
        }
      } catch {
        // ignore; leave empty
      }
    })();
    return () => { cancelled = true; };
  }, [model, onModelChange]);

  return (
    <div className="pane chat">
      <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
        <span className="label">Model</span>
        <select className="select" value={model} onChange={(e) => onModelChange(e.target.value as ModelId)}>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="chat-history">
        {messages.map(m => (
          <div key={m.id} className="message">
            <strong>{m.role === "user" ? "You" : "Assistant"}:</strong> {m.content}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input className="input" placeholder="Describe what to build…" value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ if(text.trim()){ onSend(text.trim()); setText(""); } } }} />
        <button className="button" onClick={()=>{ if(text.trim()){ onSend(text.trim()); setText(""); } }}>Send</button>
      </div>
    </div>
  );
}
