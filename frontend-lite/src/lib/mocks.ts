import { PREVIEW_URL } from "./constants";
import type { GenerateRequest, GenerateResponse, StatusResponse, PreviewResponse, JobState } from "./types";

// Simple in-memory mock state
const jobs = new Map<string, { state: JobState; logs: string[]; createdAt: number }>();

function id(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function generateMock(req: GenerateRequest): Promise<GenerateResponse> {
  const jobId = id();
  const now = Date.now();
  jobs.set(jobId, {
    state: "generating",
    logs: [
      `> Model: ${req.model}`,
      "> Starting generation…",
      "> Analyzing prompt…",
    ],
    createdAt: now,
  });

  // Simulate progress to running
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) return;
    job.logs.push("> Scaffolding project…", "> Installing deps…", "> Build complete.");
    job.state = "running";
    jobs.set(jobId, job);
  }, 1200);

  return { jobId };
}

export async function getStatusMock(jobId: string): Promise<StatusResponse> {
  const job = jobs.get(jobId);
  if (!job) return { state: "error", error: "Job not found" };
  return { state: job.state, logs: job.logs };
}

export async function getPreviewMock(jobId: string): Promise<PreviewResponse> {
  // Always return a static preview URL for demo
  return { url: PREVIEW_URL };
}

export async function deleteAccountMock(): Promise<{ ok: true }> {
  // simulate brief delay
  await new Promise((r) => setTimeout(r, 400));
  return { ok: true };
}
