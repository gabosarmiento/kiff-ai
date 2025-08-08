"use client";
import { useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { MODELS, type ModelId } from "@/lib/constants";

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

  return (
    <div className="pane chat">
      <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
        <span className="label">Model</span>
        <select className="select" value={model} onChange={(e) => onModelChange(e.target.value as ModelId)}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
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
