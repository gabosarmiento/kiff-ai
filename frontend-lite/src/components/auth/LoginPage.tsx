"use client";
import React, { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
// Icons will be added back once TypeScript compatibility is resolved

// Utility to get tenant id with fallback
function getTenantId(): string {
  const stored = localStorage.getItem('tenant_id') || localStorage.getItem('tenantId')
  return stored && stored.trim().length > 0
    ? stored
    : '4485db48-71b7-47b0-8128-c6dca5be352d'
}

async function fetchWithTenant(input: RequestInfo | URL, init: RequestInit = {}) {
  const tenantId = getTenantId()
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  headers.set('X-Tenant-ID', tenantId)
  return fetch(input, { ...init, headers })
}

export type SocialProvider = 'google' | 'github' | 'apple'

export function LoginPage() {
  const APPLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === 'true'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'none' | 'password' | SocialProvider>('none')
  const { login, isAuthenticated, isLoading } = useAuth()

  // Client-side guard: if already authenticated, redirect out of auth page
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return
    try {
      const sp = new URLSearchParams(window.location.search)
      const next = sp.get('next') || undefined
      if (next && next.startsWith('/')) {
        window.location.replace(next)
        return
      }
      const raw = localStorage.getItem('kiff_user_data')
      const role = raw ? (JSON.parse(raw)?.role as string | undefined) : undefined
      window.location.replace(role === 'admin' ? '/admin/users' : '/kiffs/launcher')
    } catch {
      window.location.replace('/kiffs/launcher')
    }
  }, [isAuthenticated, isLoading])

  const onPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }
    try {
      setLoading('password')
      await login({ email, password })
      // Redirect preference: ?next= if present and safe, else role-based
      try {
        const next = (() => {
          try {
            const sp = new URLSearchParams(window.location.search)
            const n = sp.get('next') || undefined
            return n && n.startsWith('/') ? n : undefined
          } catch { return undefined }
        })()
        if (next) {
          window.location.href = next
          return
        }
        const raw = localStorage.getItem('kiff_user_data')
        const role = raw ? (JSON.parse(raw)?.role as string | undefined) : undefined
        window.location.href = role === 'admin' ? '/admin' : '/kiffs/launcher'
      } catch {
        window.location.href = '/kiffs/launcher'
      }
    } catch (err: any) {
      // Error toast is handled in AuthContext
    } finally {
      setLoading('none')
    }
  }

  const onSocialLogin = async (provider: SocialProvider) => {
    try {
      setLoading(provider)
      const res = await fetchWithTenant(`/api/auth/social/start?provider=${provider}`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to start social login')
      const data = await res.json()
      // Redirect to OAuth provider
      const url = data?.url
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No OAuth URL received')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Social login failed')
    } finally {
      setLoading('none')
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              🔐
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
            <p className="mt-1 text-sm text-slate-600">Sign in to continue</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onSocialLogin('google')}
              disabled={loading !== 'none'}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium',
                'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
              )}
              aria-label="Continue with Google"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="h-4 w-4"
              />
              Continue with Google
            </button>
            <button
              onClick={() => onSocialLogin('github')}
              disabled={loading !== 'none'}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium',
                'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
              )}
              aria-label="Continue with GitHub"
            >
              🐙
              Continue with GitHub
            </button>
            {APPLE_ENABLED && (
              <button
                onClick={() => onSocialLogin('apple')}
                disabled={loading !== 'none'}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium',
                  'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                )}
                aria-label="Continue with Apple"
              >
                <img src="https://cdn.simpleicons.org/apple/000000" alt="Apple" className="h-4 w-4" />
                Continue with Apple
              </button>
            )}
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-500">Or log in with email</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={onPasswordLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">📧</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-slate-900/10 focus:border-slate-400 focus:ring-2"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔒</span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-slate-900/10 focus:border-slate-400 focus:ring-2"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading !== 'none'}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 transition',
                'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
              )}
            >
              {loading === 'password' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                  Logging in...
                </span>
              ) : (
                <>
                  Log In
                </>
              )}
            </button>

            <div className="mt-2 text-center">
              <a
                href="#"
                className="text-xs text-slate-600 underline-offset-2 hover:underline"
                onClick={(e) => { e.preventDefault(); toast('Forgot password feature coming soon') }}
              >
                Forgot password?
              </a>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <a 
              className="font-medium text-slate-900 underline-offset-2 hover:underline" 
              href="/signup"
            >
              Sign up for free
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage