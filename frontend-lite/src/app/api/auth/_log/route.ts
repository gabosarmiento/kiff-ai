import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // NextAuth internal logging endpoint - just return OK
  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  // NextAuth internal logging endpoint - just return OK
  return NextResponse.json({ ok: true })
}