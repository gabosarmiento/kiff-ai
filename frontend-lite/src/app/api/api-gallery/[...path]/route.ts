import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')
    const url = new URL(`${API_BASE_URL}/api-gallery/${path}`)
    
    // Forward query parameters
    const searchParams = request.nextUrl.searchParams
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: withTenantHeaders(),
      cache: 'no-store'
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Gallery proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')
    const body = await request.json()

    const response = await fetch(`${API_BASE_URL}/api-gallery/${path}`, {
      method: 'POST',
      headers: {
        ...withTenantHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Gallery proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')

    const response = await fetch(`${API_BASE_URL}/api-gallery/${path}`, {
      method: 'DELETE',
      headers: withTenantHeaders(),
      cache: 'no-store'
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Gallery proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}