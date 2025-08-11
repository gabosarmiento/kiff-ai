import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/models/sync/groq`, {
      method: 'POST',
      headers: withTenantHeaders(),
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to sync Groq models' }, 
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Groq sync API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}