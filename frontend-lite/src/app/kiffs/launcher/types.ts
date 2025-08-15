export type ToolCall = {
  function: Record<string, any>;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  tool_calls?: ToolCall[];
  metadata?: Record<string, any>;
};

export type SendMessageRequest = {
  message: string;
  chat_history: ChatMessage[];
  user_id?: string;
  kiff_id?: string;
  session_id?: string;
  selected_packs?: string[];
  model_id?: string;
  images?: { name: string; mime: string; content_base64: string }[];
  files?: { name: string; mime: string; content_base64: string }[];
  // Optional: full project file context for the agent (not uploaded files)
  project_files?: { path: string; content: string; language?: string }[];
};

export type SendMessageResponse = {
  content: string;
  tool_calls?: ToolCall[];
  kiff_update?: any;
  relevant_context?: string[];
  session_id: string;
};

export type Attachment = {
  name: string;
  mime: string;
  size: number;
  content_base64: string; // Ephemeral: only kept in memory during this session
};
