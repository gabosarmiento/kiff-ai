import { tenantFetch, getTenantHeaders } from '../contexts/TenantContext'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export class ApiService {
  private tenantId: string | null

  constructor(tenantId?: string | null) {
    this.tenantId = tenantId || null
  }

  // Update tenant ID for all subsequent calls
  setTenantId(tenantId: string | null) {
    this.tenantId = tenantId
  }

  // Generic API call method
  private async apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
    try {
      const response = await tenantFetch(url, options, this.tenantId)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error ${response.status}: ${errorText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error)
      throw error
    }
  }

  // API Gallery endpoints
  async getAPIs(): Promise<Record<string, any>> {
    return this.apiCall('/api/gallery/')
  }

  async getAPI(apiName: string): Promise<any> {
    return this.apiCall(`/api/gallery/${apiName}`)
  }

  async getAPIStats(): Promise<any> {
    return this.apiCall('/api/gallery/stats')
  }

  async searchAPIs(query: string): Promise<Record<string, any>> {
    return this.apiCall(`/api/gallery/search/?q=${encodeURIComponent(query)}`)
  }

  async getAPIsByCategory(category: string): Promise<Record<string, any>> {
    return this.apiCall(`/api/gallery/category/${category}`)
  }

  async getHighPriorityAPIs(): Promise<Record<string, any>> {
    return this.apiCall('/api/gallery/high-priority')
  }

  async getIndexingQueue(): Promise<any[]> {
    return this.apiCall('/api/gallery/indexing/queue')
  }

  async startIndexing(apiNames: string[], forceReindex: boolean = false): Promise<any> {
    return this.apiCall('/api/gallery/index', {
      method: 'POST',
      body: JSON.stringify({
        api_names: apiNames,
        force_reindex: forceReindex
      })
    })
  }

  async updateIndexingStatus(apiName: string, status: string): Promise<any> {
    return this.apiCall(`/api/gallery/${apiName}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  }

  // Kiff/Agent generation endpoints
  async generateApp(prompt: string): Promise<any> {
    return this.apiCall('/api/kiff/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    })
  }

  // Knowledge Management endpoints
  async getDomains(): Promise<any[]> {
    return this.apiCall('/api/knowledge/domains')
  }

  async createDomain(domainConfig: any): Promise<any> {
    return this.apiCall('/api/knowledge/domains', {
      method: 'POST',
      body: JSON.stringify(domainConfig)
    })
  }

  async extractKnowledge(domainName: string, urls: string[]): Promise<any> {
    return this.apiCall('/api/knowledge/extract', {
      method: 'POST',
      body: JSON.stringify({
        domain_name: domainName,
        urls
      })
    })
  }

  async searchKnowledge(query: string, domains?: string[]): Promise<any> {
    const params = new URLSearchParams({ query })
    if (domains && domains.length > 0) {
      domains.forEach(domain => params.append('domains', domain))
    }
    return this.apiCall(`/api/knowledge/search?${params.toString()}`)
  }

  async getExtractionStatus(taskId: string): Promise<any> {
    return this.apiCall(`/api/knowledge/extraction/${taskId}/status`)
  }

  async getProcessingMetrics(): Promise<any> {
    return this.apiCall('/api/knowledge/metrics')
  }

  // Settings endpoints
  async getSettings(): Promise<any> {
    return this.apiCall('/api/settings')
  }

  async updateSettings(settings: any): Promise<any> {
    return this.apiCall('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
  }

  // Health check
  async healthCheck(): Promise<any> {
    return this.apiCall('/api/health')
  }
}

// Create a default instance
export const apiService = new ApiService()

// Hook to get tenant-aware API service
export const useApiService = (tenantId?: string | null): ApiService => {
  const service = new ApiService(tenantId)
  return service
}
