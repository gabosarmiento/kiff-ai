import { API_BASE_URL } from './constants';
import { withTenantHeaders } from './tenant';

export type ResolveRequest = {
  session_id: string;
  python?: string[];
  node?: string[];
};

export type ResolveResponse = {
  python: Record<string, string>;
  node: Record<string, string>;
};

export async function resolveDeps(req: ResolveRequest): Promise<ResolveResponse> {
  const res = await fetch(`${API_BASE_URL}/api/deps/resolve`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type ValidateRequest = {
  session_id: string;
  python?: Record<string, string>;
  node?: Record<string, string>;
};

export type ValidateResult = {
  ok: boolean;
  python: Array<{ name: string; version: string; exists: boolean; has_version: boolean; deprecated?: boolean }>;
  node: Array<{ name: string; version: string; exists: boolean; has_version: boolean; deprecated?: boolean }>;
};

export async function validateDeps(req: ValidateRequest): Promise<ValidateResult> {
  const res = await fetch(`${API_BASE_URL}/api/deps/validate`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
