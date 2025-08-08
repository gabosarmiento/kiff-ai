export type JobState = "idle" | "generating" | "running" | "error";

export interface GenerateRequest {
  prompt: string;
  model: string;
}

export interface GenerateResponse {
  jobId: string;
}

export interface StatusResponse {
  state: JobState;
  logs?: string[];
  error?: string;
}

export interface PreviewResponse {
  url: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}
