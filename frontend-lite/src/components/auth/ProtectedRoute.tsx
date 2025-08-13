"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (status === 'unauthenticated') {
      // Not logged in, redirect to login with return URL
      const currentPath = window.location.pathname + window.location.search
      router.push(`/login?next=${encodeURIComponent(currentPath)}`)
      return
    }

    if (requireAdmin && session?.user) {
      const userRole = session.user.role?.toLowerCase()
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        // Not an admin, redirect to user area
        router.push('/kiffs/launcher')
        return
      }
    }
  }, [session, status, router, requireAdmin])

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // Show nothing while redirecting
  if (status === 'unauthenticated') {
    return null
  }

  // Check admin requirement
  if (requireAdmin && session?.user) {
    const userRole = session.user.role?.toLowerCase()
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return null // Will redirect in useEffect
    }
  }

  // All checks passed, show the protected content
  return <>{children}</>
}

export default ProtectedRoute