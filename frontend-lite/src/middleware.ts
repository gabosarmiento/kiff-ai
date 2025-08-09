import { NextResponse, type NextRequest } from 'next/server'

// No-op middleware. Root-level middleware.ts contains the real logic.
export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
