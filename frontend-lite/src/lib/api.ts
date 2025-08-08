// Centralized API helper for Next.js (frontend-lite)
// Uses API_BASE_URL, USE_MOCKS from constants and dynamic tenant from getTenantId().

import { API_BASE_URL, USE_MOCKS } from './constants';
import { getTenantId } from './tenant';

export type ApiInit = RequestInit & {
  asJson?: boolean; // default true: auto set Content-Type and stringify body if object
};

function normalizeInit(init: ApiInit = {}): RequestInit {
  const { asJson = true, ...rest } = init;
  const headers = new Headers(rest.headers || {});
  headers.set('X-Tenant-ID', getTenantId());
  if (asJson) headers.set('Content-Type', 'application/json');

  let body = rest.body;
  if (asJson && body && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
  }

  const credentials = (rest as any).credentials ?? 'include';
  return { ...rest, headers, body, credentials };
}

// Simple mock switch; extend per endpoint as needed
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
  return fetch(`${API_BASE_URL}${path}`, normalizeInit(init));
}

export async function apiJson<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const apiConfig = { BASE: API_BASE_URL, USE_MOCKS };
