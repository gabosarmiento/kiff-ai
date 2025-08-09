"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { toast } from 'react-hot-toast'

// Types
export interface User {
  id: string
  email: string
  role: 'user' | 'admin' | 'superadmin'
  tenant_id: string
  full_name?: string
  avatar_url?: string
  created_at?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  token: string | null
}

export interface LoginCredentials {
  email: string
  password: string
  tenant_id?: string
}

export interface SignupCredentials {
  email: string
  password: string
  role?: 'user' | 'admin'
  tenant_id?: string
}

export interface AuthContextValue extends AuthState {
  // Auth actions
  login: (credentials: LoginCredentials) => Promise<void>
  signup: (credentials: SignupCredentials) => Promise<void>
  logout: () => Promise<void>
  
  // Utility methods
  refreshAuth: () => Promise<void>
  clearAuth: () => void
  updateUser: (userData: Partial<User>) => void
}

// Storage utilities
const TOKEN_KEY = 'kiff_access_token'
const USER_KEY = 'kiff_user_data'
const TENANT_KEY = 'tenant_id'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const userData = localStorage.getItem(USER_KEY)
    return userData ? JSON.parse(userData) : null
  } catch (error) {
    console.error('Error parsing stored user data:', error)
    return null
  }
}

function getTenantId(): string {
  if (typeof window === 'undefined') return '4485db48-71b7-47b0-8128-c6dca5be352d'
  const stored = localStorage.getItem(TENANT_KEY) || localStorage.getItem('tenantId')
  return stored && stored.trim().length > 0
    ? stored
    : '4485db48-71b7-47b0-8128-c6dca5be352d'
}

function storeAuthData(token: string, user: User): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  if (user.tenant_id) {
    localStorage.setItem(TENANT_KEY, user.tenant_id)
  }
}

function clearAuthData(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  // Keep tenant_id for future logins
}

// API utility with tenant headers
async function fetchWithAuth(
  endpoint: string, 
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  headers.set('X-Tenant-ID', getTenantId())
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  return fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  })
}

// Create Context
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// AuthProvider Component
interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Start with loading true during initial check
    token: null
  })

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = getStoredToken()
      const storedUser = getStoredUser()

      // Always attempt to hydrate from cookie-based session first
      try {
        const response = await fetchWithAuth('/api/auth/me', { method: 'GET' }, storedToken || undefined)
        if (response.ok) {
          const userData = await response.json()
          // Persist user locally for quick access
          try { localStorage.setItem('kiff_user_data', JSON.stringify(userData)) } catch {}
          setAuthState({
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            token: storedToken || null,
          })
          return
        }
      } catch (err) {
        console.warn('Auth init: backend /auth/me failed:', err)
      }

      // If backend session is not valid, optionally fall back to stored user (soft mode)
      if (storedUser) {
        setAuthState({ user: storedUser, isAuthenticated: true, isLoading: false, token: storedToken })
      } else {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false, token: null })
      }
    }

    initializeAuth()
  }, [])

  // Login function
  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetchWithAuth('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          ...credentials,
          tenant_id: credentials.tenant_id || getTenantId()
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }))
        throw new Error(errorData.message || `Login failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Support both token-based and cookie-based auth responses.
      // Backend (backend-lite-v2) sets a session cookie and returns a Profile {email, role, tenant_id}.
      const user: User = {
        id: data.user?.id || data.id || 'unknown',
        email: data.user?.email || data.email || credentials.email,
        role: (data.user?.role || data.role || 'user') as User['role'],
        tenant_id: data.user?.tenant_id || data.tenant_id || getTenantId(),
        full_name: data.user?.full_name || data.full_name,
        avatar_url: data.user?.avatar_url || data.avatar_url,
        created_at: data.user?.created_at || data.created_at
      }

      if (data.access_token) {
        // Token-based flow
        storeAuthData(data.access_token, user)
        setAuthState({ user, isAuthenticated: true, isLoading: false, token: data.access_token })
      } else {
        // Cookie-based flow: store user only, token stays null
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(user))
          if (user.tenant_id) localStorage.setItem(TENANT_KEY, user.tenant_id)
        } catch {}
        setAuthState({ user, isAuthenticated: true, isLoading: false, token: null })
      }
      
      toast.success(`Welcome back, ${user.email}!`)
      
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.error(error.message || 'Login failed')
      throw error
    }
  }

  // Signup function
  const signup = async (credentials: SignupCredentials): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }))
      
      const response = await fetchWithAuth('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          ...credentials,
          role: credentials.role || 'user',
          tenant_id: credentials.tenant_id || getTenantId()
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Signup failed' }))
        throw new Error(errorData.message || `Signup failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.access_token) {
        // Auto-login after signup (token-based)
        const user: User = {
          id: data.user?.id || data.id || 'unknown',
          email: data.user?.email || data.email || credentials.email,
          role: (data.user?.role || data.role || credentials.role || 'user') as User['role'],
          tenant_id: data.user?.tenant_id || data.tenant_id || getTenantId(),
          full_name: data.user?.full_name || data.full_name,
          avatar_url: data.user?.avatar_url || data.avatar_url,
          created_at: data.user?.created_at || data.created_at
        }
        storeAuthData(data.access_token, user)
        setAuthState({ user, isAuthenticated: true, isLoading: false, token: data.access_token })
        toast.success(`Account created! Welcome, ${user.email}!`)
      } else {
        // Cookie-based flow: backend already set session. Treat as logged-in and store user only.
        const user: User = {
          id: data.user?.id || data.id || 'unknown',
          email: data.user?.email || data.email || credentials.email,
          role: (data.user?.role || data.role || credentials.role || 'user') as User['role'],
          tenant_id: data.user?.tenant_id || data.tenant_id || getTenantId(),
          full_name: data.user?.full_name || data.full_name,
          avatar_url: data.user?.avatar_url || data.avatar_url,
          created_at: data.user?.created_at || data.created_at
        }
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(user))
          if (user.tenant_id) localStorage.setItem(TENANT_KEY, user.tenant_id)
        } catch {}
        setAuthState({ user, isAuthenticated: true, isLoading: false, token: null })
        toast.success(`Account created! Welcome, ${user.email}!`)
      }
      
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }))
      toast.error(error.message || 'Signup failed')
      throw error
    }
  }

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      // Call backend logout endpoint if token exists
      if (authState.token) {
        try {
          await fetchWithAuth('/api/auth/logout', { method: 'POST' }, authState.token)
        } catch (error) {
          console.warn('Logout endpoint failed:', error)
          // Continue with local logout even if backend call fails
        }
      }
      
      // Clear local state and storage
      clearAuthData()
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        token: null
      })
      
      toast.success('Logged out successfully')
      
      // Redirect to login page
      window.location.href = '/login'
      
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error('Logout failed')
    }
  }

  // Refresh auth data
  const refreshAuth = async (): Promise<void> => {
    try {
      const response = await fetchWithAuth('/api/auth/me', { method: 'GET' }, authState.token || undefined)
      if (response.ok) {
        const userData = await response.json()
        setAuthState(prev => ({
          ...prev,
          user: userData,
          isAuthenticated: true,
        }))
        try { localStorage.setItem('kiff_user_data', JSON.stringify(userData)) } catch {}
      }
    } catch (error) {
      console.warn('Failed to refresh auth:', error)
    }
  }

  // Clear auth (for errors)
  const clearAuth = (): void => {
    clearAuthData()
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null
    })
  }

  // Update user data
  const updateUser = (userData: Partial<User>): void => {
    if (!authState.user) return
    
    const updatedUser = { ...authState.user, ...userData }
    setAuthState(prev => ({
      ...prev,
      user: updatedUser
    }))
    
    if (authState.token) {
      storeAuthData(authState.token, updatedUser)
    }
  }

  const contextValue: AuthContextValue = {
    ...authState,
    login,
    signup,
    logout,
    refreshAuth,
    clearAuth,
    updateUser
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// HOC for components that require authentication
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth()
    
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      )
    }
    
    if (!isAuthenticated) {
      window.location.href = '/login'
      return null
    }
    
    return <Component {...props} />
  }
}

export default AuthContext