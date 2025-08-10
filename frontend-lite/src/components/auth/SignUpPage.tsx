"use client";
import React, { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
// Icons will be added back once TypeScript compatibility is resolved

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

export function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'none' | 'password' | SocialProvider>('none')
  const { signup, isAuthenticated, isLoading } = useAuth()

  // Client-side guard: prevent authenticated users from viewing signup
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return
    try {
      const raw = localStorage.getItem('kiff_user_data')
      const role = raw ? (JSON.parse(raw)?.role as string | undefined) : undefined
      window.location.replace(role === 'admin' ? '/admin/users' : '/kiffs/create')
    } catch {
      window.location.replace('/kiffs/create')
    }
  }, [isAuthenticated, isLoading])

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }
    try {
      setLoading('password')
      await signup({ email, password, role: 'user' })
      // After signup, if auto-logged-in, redirect by role; otherwise go to login
      try {
        const raw = localStorage.getItem('kiff_user_data')
        const role = raw ? (JSON.parse(raw)?.role as string | undefined) : undefined
        if (role) {
          window.location.href = role === 'admin' ? '/admin' : '/kiffs/create'
        } else {
          window.location.href = '/login'
        }
      } catch {
        window.location.href = '/login'
      }
    } catch (err: any) {
      // Error toast surfaced by AuthContext
    } finally {
      setLoading('none')
    }
  }

  const onSocial = async (provider: SocialProvider) => {
    try {
      setLoading(provider)
      const res = await fetchWithTenant(`/api/auth/social/start?provider=${provider}`, { 
        method: 'POST' 
      })
      if (!res.ok) throw new Error('Failed to start social sign up')
      const data = await res.json()
      const url = data?.url
      if (url) {
        window.location.href = url
      } else {
        throw new Error('No OAuth URL received')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Social sign up failed')
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
              👤
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
            <p className="mt-1 text-sm text-slate-600">Start building with Kiff</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => onSocial('google')}
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
              onClick={() => onSocial('github')}
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
            <button
              onClick={() => onSocial('apple')}
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
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-500">Or sign up with email</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={onRegister} className="space-y-4">
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
                  placeholder="Create a password" 
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-slate-900/10 focus:border-slate-400 focus:ring-2" 
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Must be at least 8 characters long
              </p>
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
                  Creating...
                </span>
              ) : (
                <>Sign Up</>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <a 
              className="font-medium text-slate-900 underline-offset-2 hover:underline" 
              href="/login"
            >
              Log In
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignUpPage