import { DEFAULT_TENANT_ID, readEnv } from "./constants";

const TENANT_KEY = "tenant_id";

export function getTenantId(): string {
  if (typeof window === "undefined") return readEnv("NEXT_PUBLIC_TENANT_ID", DEFAULT_TENANT_ID) || DEFAULT_TENANT_ID;
  const fromStorage = window.localStorage.getItem(TENANT_KEY);
  return fromStorage || readEnv("NEXT_PUBLIC_TENANT_ID", DEFAULT_TENANT_ID) || DEFAULT_TENANT_ID;
}

export function setTenantId(id: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(TENANT_KEY, id);
}

// Always include exact-case tenant header with safe fallback
export function withTenantHeaders(headers: HeadersInit = {}): HeadersInit {
  const tenant =
    (typeof window !== 'undefined' && localStorage.getItem(TENANT_KEY)) ||
    DEFAULT_TENANT_ID;
  return { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant, ...headers } as HeadersInit;
}
