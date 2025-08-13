import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/packs/categories`, {
      method: 'GET',
      headers: withTenantHeaders(),
      cache: 'force-cache',
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to fetch pack categories' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Pack categories API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}