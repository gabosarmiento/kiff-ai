const DEFAULT_TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d";

function getTenantId(): string {
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem("tenant_id");
    if (fromStorage && fromStorage !== "null" && fromStorage !== "undefined") return fromStorage;
  }
  return process.env.NEXT_PUBLIC_TENANT_ID || DEFAULT_TENANT_ID;
}

function getBackendUrl(): string {
  // Prefer unified API base URL; fall back to legacy BACKEND_URL; then localhost
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000"
  );
}

export async function createSandbox(sessionId: string, runtime?: string, port?: number) {
  const res = await fetch(`${getBackendUrl()}/api/preview/sandbox`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": getTenantId(),
    },
    body: JSON.stringify({ session_id: sessionId, runtime, port }),
  });
  if (!res.ok) throw new Error(`createSandbox failed: ${res.status}`);
  return res.json();
}

export type FileSpec = { path: string; content: string; language?: string };

export function applyFilesSSE(sessionId: string, files: FileSpec[], onEvent: (evt: any) => void) {
  const url = `${getBackendUrl()}/api/preview/files`;
  const controller = new AbortController();
  const doPost = async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-ID": getTenantId(),
        },
        body: JSON.stringify({ session_id: sessionId, files }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`applyFiles failed: ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const json = part.slice(6);
            try {
              const data = JSON.parse(json);
              onEvent(data);
            } catch {}
          }
        }
      }
    } catch (err: any) {
      // Ignore intentional aborts
      if (err?.name !== "AbortError") {
        console.warn("applyFilesSSE error", err);
      }
    }
  };
  // Prevent unhandled rejection noise
  doPost().catch((e) => {
    if (e?.name !== "AbortError") console.warn("applyFilesSSE unhandled", e);
  });
  return () => controller.abort();
}

export async function getFileTree(sessionId: string) {
  const res = await fetch(`${getBackendUrl()}/api/preview/tree?session_id=${encodeURIComponent(sessionId)}`, {
    headers: { "X-Tenant-ID": getTenantId() },
  });
  if (!res.ok) throw new Error(`getFileTree failed: ${res.status}`);
  return res.json() as Promise<{ files: string[] }>; 
}

export async function getFile(sessionId: string, path: string) {
  const params = new URLSearchParams({ session_id: sessionId, path });
  const res = await fetch(`${getBackendUrl()}/api/preview/file?${params}`, {
    headers: { "X-Tenant-ID": getTenantId() },
  });
  if (!res.ok) throw new Error(`getFile failed: ${res.status}`);
  return res.json() as Promise<{ content: string }>; 
}

export async function installPackagesSSE(sessionId: string, packages: string[], onEvent: (evt: any) => void) {
  try {
    const res = await fetch(`${getBackendUrl()}/api/preview/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": getTenantId() },
      body: JSON.stringify({ session_id: sessionId, packages }),
    });
    if (!res.ok) throw new Error(`installPackages failed: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          const json = part.slice(6);
          try { onEvent(JSON.parse(json)); } catch {}
        }
      }
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.warn("installPackagesSSE error", err);
    }
  }
}

export async function getPreviewUrl(sessionId: string) {
  // preview URL is returned by createSandbox; we can extend later to store in session
  const info = await createSandbox(sessionId);
  return info.preview_url as string | null;
}

export async function restartDevServer(sessionId: string) {
  const res = await fetch(`${getBackendUrl()}/api/preview/restart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": getTenantId(),
    },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`restartDevServer failed: ${res.status}`);
  return res.json();
}
