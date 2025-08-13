import { API_BASE_URL } from './constants';
import { withTenantHeaders } from './tenant';

export type PreviewSandbox = {
  tenant_id: string;
  session_id: string;
  sandbox_id: string | null;
  preview_url: string | null;
  status: 'unavailable' | 'ready' | 'error';
  message?: string;
};

export async function createPreviewSandbox(session_id?: string): Promise<PreviewSandbox> {
  const res = await fetch(`${API_BASE_URL}/api/preview/sandbox`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PreviewSandbox>;
}

export async function createPreviewSandboxRuntime(args: {
  session_id?: string;
  runtime?: 'python' | 'vite' | 'node';
  port?: number;
  python_entry?: string;
}): Promise<PreviewSandbox> {
  const res = await fetch(`${API_BASE_URL}/api/preview/sandbox`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type ApplyFile = { path: string; content: string; language?: string };
export type PreviewEvent = { type: string; [k: string]: any };

export async function streamApplyFiles(
  session_id: string,
  files: ApplyFile[],
  onEvent: (e: PreviewEvent) => void,
  abort?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/preview/files`, {
    method: 'POST',
    headers: withTenantHeaders(),
    body: JSON.stringify({ session_id, files }),
    credentials: 'include',
    signal: abort,
  });
  if (!res.ok || !res.body) throw new Error(await res.text());

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const frames = chunk.split('\n\n');
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      try {
        const obj = JSON.parse(payload);
        onEvent(obj);
      } catch (_) {
        // ignore non-JSON frames
      }
    }
  }
}

export async function streamInstallPackages(
  session_id: string,
  packages: string[],
  onEvent: (e: PreviewEvent) => void,
  abort?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/preview/install`, {
    method: 'POST',
    headers: withTenantHeaders(),
    body: JSON.stringify({ session_id, packages }),
    credentials: 'include',
    signal: abort,
  });
  if (!res.ok || !res.body) throw new Error(await res.text());

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const frames = chunk.split('\n\n');
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      try {
        const obj = JSON.parse(payload);
        onEvent(obj);
      } catch (_) {}
    }
  }
}

export async function restartDevServer(session_id: string): Promise<{ status: string; message: string; tenant_id: string }>{
  const res = await fetch(`${API_BASE_URL}/api/preview/restart`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ status: string; message: string; tenant_id: string }>;
}

export async function fetchPreviewLogs(session_id: string): Promise<{
  tenant_id: string;
  session_id: string;
  has_errors: boolean;
  missing_packages: string[];
  logs: any[];
}> {
  const url = new URL(`${API_BASE_URL}/api/preview/logs`);
  url.searchParams.set('session_id', session_id);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: withTenantHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setSecrets(session_id: string, secrets: Record<string, string>): Promise<{ status: string }>{
  const res = await fetch(`${API_BASE_URL}/api/preview/secrets`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, secrets }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function applyUnifiedDiff(session_id: string, unified_diff: string): Promise<{ status: string }>{
  const res = await fetch(`${API_BASE_URL}/api/preview/patch`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, unified_diff }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchFileTree(session_id: string): Promise<{ files: Array<{ path: string; size: number }> }>{
  const url = new URL(`${API_BASE_URL}/api/preview/tree`);
  url.searchParams.set('session_id', session_id);
  const res = await fetch(url.toString(), { headers: withTenantHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchFileContent(session_id: string, path: string): Promise<{ path: string; content: string }> {
  const url = new URL(`${API_BASE_URL}/api/preview/file`);
  url.searchParams.set('session_id', session_id);
  url.searchParams.set('path', path);
  const res = await fetch(url.toString(), { headers: withTenantHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type ExecEvent = { type: string; [k: string]: any };

export async function streamExecCommand(
  session_id: string,
  cmd: string,
  onEvent: (e: ExecEvent) => void,
  abort?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/preview/exec`, {
    method: 'POST',
    headers: withTenantHeaders(),
    body: JSON.stringify({ session_id, cmd }),
    credentials: 'include',
    signal: abort,
  });
  if (!res.ok || !res.body) throw new Error(await res.text());

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const frames = chunk.split('\n\n');
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      try {
        const obj = JSON.parse(payload);
        onEvent(obj);
      } catch (_) {}
    }
  }
}
