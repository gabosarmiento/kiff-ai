"use client"

import { useSession } from 'next-auth/react'

export function useAuth() {
  const { data: session, status } = useSession()

  const user = session?.user ? {
    id: session.user.id || 'unknown',
    email: session.user.email || '',
    name: session.user.name || '',
    role: session.user.role as 'user' | 'admin' | 'superadmin',
    tenant_id: session.user.tenant_id || '',
    image: session.user.image
  } : null

  return {
    user,
    isAuthenticated: !!session && !!user,
    isLoading: status === 'loading',
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    session,
    token: (session as any)?.accessToken || null
  }
}

export default useAuth