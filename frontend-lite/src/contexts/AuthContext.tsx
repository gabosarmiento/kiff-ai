"use client"

import React, { createContext, useContext } from 'react'
import { useSession } from 'next-auth/react'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin' | 'superadmin'
  tenant_id: string
  image?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  session: any
  token: string | null
  login?: (credentials: { email: string; password: string }) => Promise<void>
  signup?: (credentials: { email: string; password: string; role?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  const user = session?.user ? {
    id: session.user.id || 'unknown',
    email: session.user.email || '',
    name: session.user.name || '',
    role: session.user.role as 'user' | 'admin' | 'superadmin',
    tenant_id: session.user.tenant_id || '',
    image: session.user.image
  } : null

  const login = async (credentials: { email: string; password: string }) => {
    // This is a placeholder - actual login should use NextAuth signIn
    throw new Error('Login function not implemented - use NextAuth signIn instead')
  }

  const signup = async (credentials: { email: string; password: string; role?: string }) => {
    // This is a placeholder - actual signup should be implemented
    throw new Error('Signup function not implemented')
  }

  const value = {
    user,
    isAuthenticated: !!session && !!user,
    isLoading: status === 'loading',
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    session,
    token: (session as any)?.accessToken || null,
    login,
    signup
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext