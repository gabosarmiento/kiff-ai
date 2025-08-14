// Centralized API helper for Next.js (frontend-lite)
// Uses API_BASE_URL, USE_MOCKS from constants and dynamic tenant from getTenantId().

import { API_BASE_URL, USE_MOCKS } from './constants';
import { getTenantId, withTenantHeaders } from './tenant';

export type ApiInit = Omit<RequestInit, 'body'> & {
  asJson?: boolean; // default true: auto set Content-Type and stringify body if object
  body?: any; // Allow any object for JSON bodies
};

function normalizeInit(init: ApiInit = {}): RequestInit {
  const { asJson = true, ...rest } = init;
  const headers = new Headers(rest.headers || {});
  // Ensure exact-case tenant header with fallback, per recurring issue
  const tenantHeaderEntries = Object.entries(withTenantHeaders());
  for (const [k, v] of tenantHeaderEntries) {
    if (typeof v === 'string') headers.set(k, v);
  }
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
  if (path === '/api/models') {
    const mockModels = [
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'OpenAI',
        modality: 'text',
        status: 'active',
        pricing: { input: 0.0015, output: 0.002 },
        max_tokens: 4096
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'OpenAI', 
        modality: 'text',
        status: 'active',
        pricing: { input: 0.03, output: 0.06 },
        max_tokens: 8192
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        provider: 'Anthropic',
        modality: 'text',
        status: 'active',
        pricing: { input: 0.003, output: 0.015 },
        max_tokens: 200000
      }
    ];
    return new Response(JSON.stringify(mockModels), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Intentionally no mocks for /api/kiffs to avoid showing non-existent projects
  if (path === '/api/apis') {
    const mockApis = [
      {
        id: 'stripe-api',
        name: 'Stripe Payment API',
        icon: '💳',
        base_url: 'https://api.stripe.com',
        status: 'active'
      },
      {
        id: 'github-api',
        name: 'GitHub API',
        icon: '🐙',
        base_url: 'https://api.github.com',
        status: 'active'
      },
      {
        id: 'openai-api',
        name: 'OpenAI API',
        icon: '🤖',
        base_url: 'https://api.openai.com',
        status: 'active'
      }
    ];
    return new Response(JSON.stringify(mockApis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (path.startsWith('/api/apis/') && path.includes('/sitemap')) {
    const apiId = path.split('/')[3];
    const mockSitemap = {
      api_id: apiId,
      sitemap_url: `https://api.${apiId}.com/sitemap.xml`,
      total_urls: 15,
      selected_urls: [
        `https://docs.${apiId}.com/getting-started`,
        `https://docs.${apiId}.com/authentication`,  
        `https://docs.${apiId}.com/api-reference`,
        `https://docs.${apiId}.com/webhooks`,
        `https://docs.${apiId}.com/examples`
      ]
    };
    return new Response(JSON.stringify(mockSitemap), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (path === '/api/packs') {
    const mockPacks = [
      {
        id: 'stripe-pack',
        name: 'stripe-payment-api',
        display_name: 'Stripe Payment API',
        description: 'Complete Stripe payment processing with webhooks and subscriptions',
        category: 'payments',
        api_url: 'https://api.stripe.com',
        avg_rating: 4.8,
        usage_count: 156,
        total_users_used: 45,
        is_verified: true,
        created_at: '2024-01-15T10:30:00Z'
      },
      {
        id: 'openai-pack',
        name: 'openai-api',
        display_name: 'OpenAI API',
        description: 'ChatGPT, GPT-4, and other OpenAI models integration',
        category: 'ai',
        api_url: 'https://api.openai.com',
        avg_rating: 4.9,
        usage_count: 234,
        total_users_used: 67,
        is_verified: true,
        created_at: '2024-01-20T14:15:00Z'
      }
    ];
    return new Response(JSON.stringify({ packs: mockPacks, total: mockPacks.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

export async function apiFetch(path: string, init: ApiInit = {}): Promise<Response> {
  const mock = await maybeMock(path);
  if (mock) return mock;
  // If calling a Next.js local API route (proxy), don't prefix with API_BASE_URL
  if (path.startsWith('/api/') || path.startsWith('/backend/')) {
    return fetch(path, normalizeInit(init));
  }
  return fetch(`${API_BASE_URL}${path}`, normalizeInit(init));
}

export async function apiJson<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Attach status code to error for consistent 409 handling by callers
    const err = new Error(`API ${res.status} ${res.statusText}: ${text}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const apiConfig = { BASE: API_BASE_URL, USE_MOCKS };

// Recommendation API: suggest extraction settings
export async function recommendExtract(body: Record<string, any>): Promise<{
  suggested: any;
  alternates: any[];
  estimates: any;
  diagnostics: any;
}> {
  const res = await fetch(`${API_BASE_URL}/api/extract/recommend`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{
    suggested: any;
    alternates: any[];
    estimates: any;
    diagnostics: any;
  }>;
}

// Minimal Extraction Preview client
export async function extractPreview(body: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/extract/preview`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Knowledge Base APIs ---
export async function createKB(body: {
  name: string;
  vector_store?: 'lancedb';
  retrieval_mode?: 'agentic-search' | 'agentic-rag';
  embedder?: string;
}): Promise<{ id: string; name: string }>{
  const res = await fetch(`${API_BASE_URL}/api/kb/create`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vector_store: 'lancedb',
      retrieval_mode: 'agentic-search',
      embedder: 'sentence-transformers',
      ...body,
    }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string; name: string }>;
}

export async function listKBs(): Promise<Array<{ id: string; name: string; created_at?: number; vectors?: number }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/kb`, {
      method: 'GET',
      headers: withTenantHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      console.warn('KB API not available, returning empty list');
      return [];
    }
    return res.json() as Promise<Array<{ id: string; name: string; created_at?: number; vectors?: number }>>;
  } catch (error) {
    console.warn('KB API error, returning empty list:', error);
    return [];
  }
}

export async function kbIndex(body: {
  kb_id: string;
  api_id?: string;
  urls?: string[];
  mode: 'fast' | 'agentic';
  strategy: 'fixed' | 'semantic' | 'agentic' | 'recursive' | 'document';
  embedder?: string;
  chunk_size: number;
  chunk_overlap: number;
  semantic_params?: { threshold?: number };
  budget_cap_usd?: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/kb/index`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Ingest raw items (text/url/metadata) into a KB table
export async function kbIngest(params: {
  kb_id: string;
  items: Array<{ text: string; url?: string | null; metadata?: Record<string, any> | null }>;
}): Promise<{ ok: boolean; ingested: number }> {
  const { kb_id, items } = params;
  const res = await fetch(`${API_BASE_URL}/api/kb/${encodeURIComponent(kb_id)}/ingest`, {
    method: 'POST',
    headers: { ...withTenantHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; ingested: number }>;
}
