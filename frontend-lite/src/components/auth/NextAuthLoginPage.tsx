"use client"

import React, { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { cn } from '../../lib/utils'

export function NextAuthLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'none' | 'credentials' | 'google' | 'github'>('none')
  const { data: session, status } = useSession()

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'authenticated' && session?.user) {
      const urlParams = new URLSearchParams(window.location.search)
      const next = urlParams.get('next') || urlParams.get('callbackUrl')
      const userRole = session.user.role?.toLowerCase()
      
      console.log('NextAuth Login Redirect Debug:', {
        userRole,
        userEmail: session.user?.email,
        next,
        sessionUser: session.user
      })

      // Handle next parameter with admin route protection
      if (next && next.startsWith('/')) {
        if (next.startsWith('/admin')) {
          if (userRole === 'admin' || userRole === 'superadmin') {
            console.log('Admin user accessing admin route:', next)
            window.location.href = next
            return
          } else {
            console.log('Non-admin trying to access admin route, redirecting to user area')
            // Non-admin trying to access admin route, redirect to user area
            window.location.href = '/kiffs/create'
            return
          }
        } else {
          console.log('Redirecting to requested page:', next)
          window.location.href = next
          return
        }
      }
      
      // Default role-based redirect
      if (userRole === 'admin' || userRole === 'superadmin') {
        console.log('Admin user, redirecting to admin area')
        window.location.href = '/admin/users'
      } else {
        console.log('Regular user, redirecting to kiffs/create')
        window.location.href = '/kiffs/create'
      }
    }
  }, [status, session])

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }

    try {
      setLoading('credentials')
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('Invalid credentials')
        return
      }

      if (result?.ok) {
        toast.success(`Welcome back, ${email}!`)
        // Let the useEffect handle redirect after session is established
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
    } finally {
      setLoading('none')
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      setLoading(provider)
      const urlParams = new URLSearchParams(window.location.search)
      const next = urlParams.get('next') || urlParams.get('callbackUrl')
      const callbackUrl = next || '/kiffs/create'
      
      await signIn(provider, { 
        callbackUrl,
        redirect: true 
      })
    } catch (error: any) {
      toast.error(`${provider} login failed`)
      setLoading('none')
    }
  }

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

          {/* Social Login Buttons */}
          <div className="space-y-2">
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={loading !== 'none'}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium',
                'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
              )}
              aria-label="Continue with Google"
            >
              {loading === 'google' ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
              ) : (
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  className="h-4 w-4"
                />
              )}
              Continue with Google
            </button>
            
            <button
              onClick={() => handleSocialLogin('github')}
              disabled={loading !== 'none'}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium',
                'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
              )}
              aria-label="Continue with GitHub"
            >
              {loading === 'github' ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
              ) : (
                '🐙'
              )}
              Continue with GitHub
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-500">Or log in with email</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
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
              {loading === 'credentials' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                  Logging in...
                </span>
              ) : (
                'Log In'
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

export default NextAuthLoginPage