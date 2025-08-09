import { NextResponse, type NextRequest } from 'next/server'

// Public routes that do not require authentication
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/signup',
  '/auth/login',
  '/auth/signup',
  '/auth/logout',
])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  // Allow Next internals and static assets
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/images')) return true
  if (pathname.startsWith('/assets')) return true
  // Do not intercept API routes
  if (pathname.startsWith('/api')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl
  // Prefer explicit BACKEND_ORIGIN, fallback to public API base or localhost
  const backendOrigin = process.env.BACKEND_ORIGIN
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || 'http://localhost:8000'

  const session = req.cookies.get(process.env.SESSION_COOKIE_NAME || 'session')?.value
  const isAuthPage = (pathname === '/login' || pathname === '/signup' || pathname === '/auth/login' || pathname === '/auth/signup')

  // Normalize /admin landing to /admin/users
  if (pathname === '/admin') {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/users'
    return NextResponse.redirect(url)
  }

  // If route is public, allow
  if (isPublicPath(pathname)) {
    // If already authenticated and on auth pages, redirect away.
    if (isAuthPage && session) {
      const url = req.nextUrl.clone()
      // Attempt to resolve role to route; if backend fails, still redirect (avoid showing login when logged in)
      try {
        const res = await fetch(`${backendOrigin}/api/auth/me`, {
          method: 'GET',
          headers: { cookie: req.headers.get('cookie') || '' },
        })
        if (res.ok) {
          const me = await res.json().catch(() => null) as { role?: string } | null
          url.pathname = me?.role === 'admin' ? '/admin/users' : '/kiffs/create'
          return NextResponse.redirect(url)
        }
      } catch {
        // Backend not reachable — still redirect to app default
      }
      url.pathname = '/kiffs/create'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Protected route: must validate session via backend
  try {
    const res = await fetch(`${backendOrigin}/api/auth/me`, {
      method: 'GET',
      headers: { cookie: req.headers.get('cookie') || '' },
    })
    if (res.ok) {
      // Session valid; allow
      return NextResponse.next()
    }
  } catch {
    // Treat backend errors as unauthenticated for safety
  }

  // Not authenticated: redirect to login with safe next param
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  const next = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
  if (next.startsWith('/')) {
    url.searchParams.set('next', next)
  }
  return NextResponse.redirect(url)
}

export const config = {
  // Match all paths except api and static handled above; letting middleware run broadly is fine
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
