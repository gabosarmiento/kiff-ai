import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { toast } from 'react-hot-toast'

interface Tenant {
  id: string
  name: string
  slug: string
  schema_name: string
  created_at: string
  is_active: boolean
}

interface TenantContextType {
  currentTenant: Tenant | null
  setCurrentTenant: (tenant: Tenant | null) => void
  tenantId: string | null
  isLoading: boolean
  error: string | null
  refreshTenant: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

interface TenantProviderProps {
  children: ReactNode
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // For demo/development, we'll use the real demo tenant from database
  const DEFAULT_TENANT: Tenant = {
    id: '4485db48-71b7-47b0-8128-c6dca5be352d',  // Real demo tenant ID from database
    name: 'Demo Tenant',
    slug: 'demo',
    schema_name: 'tenant_demo',
    created_at: new Date().toISOString(),
    is_active: true
  }

  useEffect(() => {
    initializeTenant()
  }, [])

  const initializeTenant = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Check if tenant is stored in localStorage
      const storedTenant = localStorage.getItem('currentTenant')
      if (storedTenant) {
        const tenant = JSON.parse(storedTenant)
        setCurrentTenant(tenant)
        setIsLoading(false)
        return
      }

      // For development, use default tenant
      // In production, this would fetch from backend or handle tenant selection
      setCurrentTenant(DEFAULT_TENANT)
      localStorage.setItem('currentTenant', JSON.stringify(DEFAULT_TENANT))
      
    } catch (err) {
      console.error('Failed to initialize tenant:', err)
      setError('Failed to initialize tenant')
      toast.error('Failed to initialize tenant')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshTenant = async () => {
    await initializeTenant()
  }

  const tenantId = currentTenant?.id || null

  const value: TenantContextType = {
    currentTenant,
    setCurrentTenant,
    tenantId,
    isLoading,
    error,
    refreshTenant
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

// Helper function to get tenant headers for API calls
export const getTenantHeaders = (tenantId?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId
  }

  return headers
}

// Helper function to make tenant-aware API calls
export const tenantFetch = async (
  url: string, 
  options: RequestInit = {}, 
  tenantId?: string | null
): Promise<Response> => {
  const tenantHeaders = getTenantHeaders(tenantId)
  
  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...tenantHeaders,
      ...options.headers,
    },
  }

  return fetch(url, mergedOptions)
}
