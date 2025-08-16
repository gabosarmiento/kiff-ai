import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'https://nkbdpyszym.eu-west-3.awsapprunner.com'
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || ''

function sign(email: string, role: string): string {
  if (!BRIDGE_SECRET) return ''
  const crypto = require('crypto') as typeof import('crypto')
  return crypto.createHmac('sha256', BRIDGE_SECRET).update(`${email}:${role}`).digest('hex')
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const email = String(token.email).toLowerCase()
  const role = String((token as any).role || 'user')

  // Forward to backend sync endpoint and preserve Set-Cookie back to the browser
  const body = JSON.stringify({ email, role })
  const sig = sign(email, role)
  const tenant = req.headers.get('x-tenant-id') || process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'

  const res = await fetch(`${BACKEND_ORIGIN}/api/auth/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-Signature': sig,
      'X-Tenant-ID': tenant,
    },
    body,
  })

  const text = await res.text()
  const out = new NextResponse(text, { status: res.status })

  // Copy Set-Cookie headers to the NextResponse so cookie gets stored on app origin
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) out.headers.set('set-cookie', setCookie)
  out.headers.set('content-type', res.headers.get('content-type') || 'application/json')
  return out
}
