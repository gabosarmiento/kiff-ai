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
