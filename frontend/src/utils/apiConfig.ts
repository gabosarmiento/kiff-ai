/**
 * Centralized API configuration for the kiff frontend
 * All API calls should use these utilities to ensure consistent URL handling
 */

// Get the API base URL from environment variable or fallback to localhost
export const getApiBaseUrl = (): string => {
  // In production on Vercel, API routes are served from the same domain
  if (import.meta.env.PROD) {
    return ''  // Use relative URLs in production
  }
  return (import.meta.env as any).VITE_API_BASE_URL || 'http://localhost:8000'
}

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl()
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${baseUrl}${cleanEndpoint}`
}

// Common API headers with auth token
export const getApiHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  // Get tenant ID from authentication (automatic per-user tenant)
  const tenantId = localStorage.getItem('tenant_id')
  if (tenantId && tenantId !== '*') {
    // Regular users get their tenant ID in headers
    headers['X-Tenant-ID'] = tenantId
  } else if (tenantId === '*') {
    // Admin users get global access marker
    headers['X-Tenant-ID'] = '*'
  } else {
    // Fallback to demo tenant for login and public endpoints
    headers['X-Tenant-ID'] = '4485db48-71b7-47b0-8128-c6dca5be352d'
  }
  
  const token = localStorage.getItem('authToken')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

// Helper for authenticated fetch requests with timeout and performance optimizations
export const apiRequest = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = buildApiUrl(endpoint)
  const headers = {
    ...getApiHeaders(),
    ...options.headers,
  }
  
  // Create AbortController for timeout (reduced for faster UX)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout for faster feedback
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      // Performance optimizations
      keepalive: true,
      cache: 'no-cache',
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout: ${endpoint} took longer than 5 seconds`)
    }
    throw error
  }
}
