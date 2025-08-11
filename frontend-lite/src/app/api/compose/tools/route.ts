import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

// Fallback tools if backend is unavailable
const FALLBACK_TOOLS = {
  tools: [
    "web_search",
    "code_interpreter", 
    "file_manager"
  ],
  mcps: [
    "filesystem",
    "browser",
    "terminal"
  ]
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/compose/tools`, {
      method: 'GET',
      headers: withTenantHeaders(),
      cache: 'no-store'
    })

    if (!response.ok) {
      console.warn('Backend tools API unavailable, using fallback tools')
      return NextResponse.json(FALLBACK_TOOLS)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Tools API error, using fallback:', error)
    return NextResponse.json(FALLBACK_TOOLS)
  }
}