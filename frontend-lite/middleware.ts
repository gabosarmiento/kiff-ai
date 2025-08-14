import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Public routes that do not require authentication
const PUBLIC_PATHS = new Set<string>([
  '/login',
])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  // Allow Next internals and static assets
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon')) return true
  if (pathname.startsWith('/images')) return true
  if (pathname.startsWith('/assets')) return true
  // Allow NextAuth API routes
  if (pathname.startsWith('/api/auth')) return true
  // Allow other API routes (you can make these protected later if needed)
  if (pathname.startsWith('/api')) return true
  // Allow backend proxy path so requests reach FastAPI without middleware redirecting
  if (pathname.startsWith('/backend')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  console.log(`🔧 MIDDLEWARE RUNNING: ${pathname}`)

  // Skip middleware for public paths
  if (isPublicPath(pathname)) {
    console.log(`🔧 SKIPPING PUBLIC PATH: ${pathname}`)
    return NextResponse.next()
  }

  // Get NextAuth token
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  })

  const isAuthenticated = !!token
  const userRole = token ? (token.role as string)?.toLowerCase() : null

  // Debug only for root path to avoid spam
  if (pathname === '/') {
    console.log(`[MIDDLEWARE] / - token:`, token ? `found (${token.email}, role: ${userRole})` : 'NOT FOUND')
    console.log(`[MIDDLEWARE] / - cookies:`, req.cookies.getAll().map(c => c.name).join(', '))
  }

  // Root: redirect based on authentication status
  if (pathname === '/') {
    console.log(`[MIDDLEWARE] Root path detected, isAuthenticated: ${isAuthenticated}`)
    if (isAuthenticated) {
      const url = req.nextUrl.clone()
      if (userRole === 'admin' || userRole === 'superadmin') {
        url.pathname = '/admin/users'
        console.log(`[MIDDLEWARE] Redirecting admin to: ${url.pathname}`)
      } else {
        url.pathname = '/kiffs/launcher'
        console.log(`[MIDDLEWARE] Redirecting user to: ${url.pathname}`)
      }
      return NextResponse.redirect(url)
    } else {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      console.log(`[MIDDLEWARE] Redirecting unauthenticated to: ${url.pathname}`)
      return NextResponse.redirect(url)
    }
  }

  // Normalize /admin landing to /admin/users
  if (pathname === '/admin') {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/users'
    return NextResponse.redirect(url)
  }

  // Check authentication for all other routes
  if (!isAuthenticated) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Admin route protection
  if (pathname.startsWith('/admin')) {
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      const url = req.nextUrl.clone()
      url.pathname = '/kiffs/launcher'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Protect all routes except those handled in isPublicPath
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
