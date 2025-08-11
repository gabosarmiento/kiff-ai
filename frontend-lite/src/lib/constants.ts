export const DEFAULT_TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d";

// Safe env reader without relying on Node types
export function readEnv(key: string, fallback?: string): string | undefined {
  const env = (globalThis as any)?.process?.env as Record<string, string> | undefined;
  const value = env?.[key];
  return value ?? fallback;
}

export const API_BASE_URL = readEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000")!;
export const USE_MOCKS = (readEnv("NEXT_PUBLIC_USE_MOCKS", "false") || "false").toLowerCase() === "true";
export const PREVIEW_URL = readEnv("NEXT_PUBLIC_PREVIEW_URL", "https://example.org")!;

// Model identifiers are dynamic; use a flexible string type
export type ModelId = string;
