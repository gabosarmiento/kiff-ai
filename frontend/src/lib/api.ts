import axios from 'axios'
import type { GeneratedApp, APIGalleryItem, GeneratedFile } from '@/store/useStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add tenant header to requests if available
api.interceptors.request.use((config) => {
  const tenantId = localStorage.getItem('tenant_id')
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ============================================================================
// kiff System APIs - Adaptive Agentic API Documentation Extraction
// ============================================================================

// App Generation API
export const appGenerationApi = {
  generateApp: async (prompt: string): Promise<{ 
    appId: string
    status: string
    message: string 
  }> => {
    const response = await api.post('/api/generate-app', { prompt })
    return response.data
  },

  getGenerationStatus: async (appId: string): Promise<{
    status: 'generating' | 'completed' | 'error'
    progress: number
    logs: string[]
    app?: GeneratedApp
  }> => {
    const response = await api.get(`/api/generate-app/${appId}/status`)
    return response.data
  }
}

// Generated Apps API
export const generatedAppsApi = {
  getApps: async (): Promise<GeneratedApp[]> => {
    const response = await api.get('/api/generated-apps')
    return response.data
  },

  getApp: async (id: string): Promise<GeneratedApp> => {
    const response = await api.get(`/api/generated-apps/${id}`)
    return response.data
  },

  getAppFiles: async (id: string): Promise<GeneratedFile[]> => {
    const response = await api.get(`/api/generated-apps/${id}/files`)
    return response.data
  },

  getFileContent: async (appId: string, filePath: string): Promise<string> => {
    const response = await api.get(`/api/generated-apps/${appId}/files/${encodeURIComponent(filePath)}`)
    return response.data.content
  },

  deleteApp: async (id: string): Promise<void> => {
    await api.delete(`/api/generated-apps/${id}`)
  }
}

// API Gallery API
export const apiGalleryApi = {
  getAPIs: async (): Promise<APIGalleryItem[]> => {
    const response = await api.get('/api/gallery')
    return response.data
  },

  getAPI: async (id: string): Promise<APIGalleryItem> => {
    const response = await api.get(`/api/gallery/${id}`)
    return response.data
  },

  indexAPI: async (apiData: {
    name: string
    description: string
    baseUrl: string
    documentationUrl: string
    categories: string[]
  }): Promise<APIGalleryItem> => {
    const response = await api.post('/api/gallery/index', apiData)
    return response.data
  },

  reindexAPI: async (id: string): Promise<void> => {
    await api.post(`/api/gallery/${id}/reindex`)
  },

  deleteAPI: async (id: string): Promise<void> => {
    await api.delete(`/api/gallery/${id}`)
  }
}

// Knowledge Management API
export const knowledgeApi = {
  searchDocumentation: async (query: string, apiIds?: string[]): Promise<{
    results: Array<{
      content: string
      source: string
      score: number
      apiId: string
    }>
  }> => {
    const response = await api.post('/api/knowledge/search', {
      query,
      api_ids: apiIds
    })
    return response.data
  },

  getIndexingStatus: async (): Promise<{
    totalAPIs: number
    indexedAPIs: number
    indexingAPIs: number
    errorAPIs: number
  }> => {
    const response = await api.get('/api/knowledge/status')
    return response.data
  }
}

// Authentication API
export const authApi = {
  login: async (email: string, password: string): Promise<{
    access_token: string
    user: {
      id: string
      email: string
      name: string
    }
  }> => {
    const response = await api.post('/api/auth/login', { email, password })
    return response.data
  },

  register: async (email: string, password: string, name: string): Promise<{
    access_token: string
    user: {
      id: string
      email: string
      name: string
    }
  }> => {
    const response = await api.post('/api/auth/register', { email, password, name })
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout')
  },

  getProfile: async (): Promise<{
    id: string
    email: string
    name: string
  }> => {
    const response = await api.get('/api/auth/profile')
    return response.data
  }
}

export default api
