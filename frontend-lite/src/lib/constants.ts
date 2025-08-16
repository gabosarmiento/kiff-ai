export const DEFAULT_TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d";

// Safe env reader without relying on Node types
export function readEnv(key: string, fallback?: string): string | undefined {
  const env = (globalThis as any)?.process?.env as Record<string, string> | undefined;
  const value = env?.[key];
  return value ?? fallback;
}

// Auto-detect environment: use localhost in development, AWS in production
function getDefaultApiUrl(): string {
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    // In browser: use localhost if hostname is localhost, otherwise use production
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return "http://localhost:8000";
    }
  }
  // Server-side or production: use AWS App Runner (VM integration with full ML service)
  return "https://afhnhvjrgg.eu-west-3.awsapprunner.com";
}

export const API_BASE_URL = readEnv("NEXT_PUBLIC_API_BASE_URL", getDefaultApiUrl())!;
export const USE_MOCKS = (readEnv("NEXT_PUBLIC_USE_MOCKS", "false") || "false").toLowerCase() === "true";
export const PREVIEW_URL = readEnv("NEXT_PUBLIC_PREVIEW_URL", "https://example.org")!;

// Model identifiers are dynamic; use a flexible string type
export type ModelId = string;
