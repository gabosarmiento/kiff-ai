import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Public routes that do not require authentication
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/signup',
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

  // Skip middleware for public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Check both NextAuth JWT token AND custom session cookie
  const nextAuthToken = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  })

  // Also check for custom session cookie
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session'
  const customSessionCookie = req.cookies.get(sessionCookieName)?.value

  const isAuthenticated = !!(nextAuthToken || customSessionCookie)
  let userRole = null

  if (nextAuthToken) {
    userRole = (nextAuthToken.role as string)?.toLowerCase()
    console.log(`Middleware: ${pathname}, NextAuth token found (${nextAuthToken.email}, role: ${userRole})`)
  } else if (customSessionCookie) {
    // For custom session, we'd need to decode it to get role, but for now assume regular user
    userRole = 'user' // Default assumption for custom sessions
    console.log(`Middleware: ${pathname}, custom session found`)
  } else {
    console.log(`Middleware: ${pathname}, no authentication found`)
  }

  // Root: redirect based on authentication status
  if (pathname === '/') {
    if (isAuthenticated) {
      const url = req.nextUrl.clone()
      if (userRole === 'admin' || userRole === 'superadmin') {
        url.pathname = '/admin/users'
      } else {
        url.pathname = '/kiffs/launcher'
      }
      return NextResponse.redirect(url)
    } else {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
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
