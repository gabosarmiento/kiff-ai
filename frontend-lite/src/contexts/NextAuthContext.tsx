"use client"

import { createContext, useContext, ReactNode } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { toast } from 'react-hot-toast'

// Types (keeping your existing User interface)
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
  loginWithGoogle: () => Promise<void>
  loginWithGitHub: () => Promise<void>
  signup: (credentials: SignupCredentials) => Promise<void>
  logout: () => Promise<void>
  
  // Utility methods
  refreshAuth: () => Promise<void>
  clearAuth: () => void
  updateUser: (userData: Partial<User>) => void
}

// Create Context
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// AuthProvider Component
interface AuthProviderProps {
  children: ReactNode
}

export function NextAuthContextProvider({ children }: AuthProviderProps) {
  const { data: session, status, update } = useSession()

  // Convert NextAuth session to your User format
  const user: User | null = session?.user ? {
    id: session.user.id || 'unknown',
    email: session.user.email || '',
    role: (session.user.role as User['role']) || 'user',
    tenant_id: (session.user.tenant_id as string) || '4485db48-71b7-47b0-8128-c6dca5be352d',
    full_name: session.user.name || undefined,
    avatar_url: session.user.image || undefined,
    created_at: undefined
  } : null

  const authState: AuthState = {
    user,
    isAuthenticated: !!session && !!user,
    isLoading: status === 'loading',
    token: (session as any)?.accessToken || null
  }

  // Login with credentials
  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      const result = await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        redirect: false,
      })

      if (result?.error) {
        throw new Error('Invalid credentials')
      }

      if (result?.ok) {
        toast.success(`Welcome back, ${credentials.email}!`)
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
      throw error
    }
  }

  // Social login methods
  const loginWithGoogle = async (): Promise<void> => {
    try {
      const result = await signIn('google', { redirect: false })
      if (result?.error) {
        throw new Error('Google login failed')
      }
    } catch (error: any) {
      toast.error(error.message || 'Google login failed')
      throw error
    }
  }

  const loginWithGitHub = async (): Promise<void> => {
    try {
      const result = await signIn('github', { redirect: false })
      if (result?.error) {
        throw new Error('GitHub login failed')
      }
    } catch (error: any) {
      toast.error(error.message || 'GitHub login failed')
      throw error
    }
  }

  // Signup function (still using your backend)
  const signup = async (credentials: SignupCredentials): Promise<void> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': credentials.tenant_id || '4485db48-71b7-47b0-8128-c6dca5be352d'
        },
        body: JSON.stringify({
          ...credentials,
          role: credentials.role || 'user',
          tenant_id: credentials.tenant_id || '4485db48-71b7-47b0-8128-c6dca5be352d'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Signup failed' }))
        throw new Error(errorData.message || `Signup failed: ${response.status}`)
      }

      // After successful signup, auto-login
      await login({
        email: credentials.email,
        password: credentials.password,
        tenant_id: credentials.tenant_id
      })

      toast.success(`Account created! Welcome, ${credentials.email}!`)
    } catch (error: any) {
      toast.error(error.message || 'Signup failed')
      throw error
    }
  }

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await signOut({ redirect: false })
      toast.success('Logged out successfully')
      window.location.href = '/login'
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error('Logout failed')
    }
  }

  // Refresh auth data
  const refreshAuth = async (): Promise<void> => {
    try {
      await update()
    } catch (error) {
      console.warn('Failed to refresh auth:', error)
    }
  }

  // Clear auth (for errors)
  const clearAuth = (): void => {
    signOut({ redirect: false })
  }

  // Update user data
  const updateUser = async (userData: Partial<User>): Promise<void> => {
    try {
      await update({
        ...session,
        user: {
          ...session?.user,
          ...userData
        }
      })
    } catch (error) {
      console.warn('Failed to update user:', error)
    }
  }

  const contextValue: AuthContextValue = {
    ...authState,
    login,
    loginWithGoogle,
    loginWithGitHub,
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
export function useNextAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useNextAuth must be used within a NextAuthContextProvider')
  }
  return context
}

export default AuthContext