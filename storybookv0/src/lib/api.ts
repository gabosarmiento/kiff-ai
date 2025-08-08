// Centralized API helper for Storybook (Vite)
// Uses VITE_* env vars and always sends X-Tenant-ID

const DEFAULT_BASE = 'http://localhost:8000';
const DEFAULT_TENANT = '4485db48-71b7-47b0-8128-c6dca5be352d';

const BASE = (import.meta as any).env?.VITE_API_BASE_URL?.trim() || DEFAULT_BASE;
const TENANT = (import.meta as any).env?.VITE_TENANT_ID?.trim() || DEFAULT_TENANT;
const USE_MOCKS = String((import.meta as any).env?.VITE_USE_MOCKS || 'false').toLowerCase() === 'true';

export type ApiInit = RequestInit & { asJson?: boolean };

function normalizeInit(init: ApiInit = {}): RequestInit {
  const { asJson = true, ...rest } = init;
  const headers = new Headers(rest.headers || {});
  headers.set('X-Tenant-ID', TENANT);
  if (asJson) headers.set('Content-Type', 'application/json');

  let body = rest.body;
  if (asJson && body && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
  }
  return { ...rest, headers, body };
}

async function maybeMock(path: string): Promise<Response | null> {
  if (!USE_MOCKS) return null;
  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'healthy', mocked: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

export async function apiFetch(path: string, init: ApiInit = {}): Promise<Response> {
  const mock = await maybeMock(path);
  if (mock) return mock;
  return fetch(`${BASE}${path}`, normalizeInit(init));
}

export async function apiJson<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const apiConfig = { BASE, TENANT, USE_MOCKS };
