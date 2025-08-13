import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const headers = {
      'Content-Type': 'application/json',
      ...withTenantHeaders()
    }
    const url = `${API_BASE_URL}/api/packs/create`
    console.log('Pack creation API called with:', { body, API_BASE_URL, url, headers })
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    console.log('Backend response:', { status: response.status, ok: response.ok })
    const data = await response.json()
    console.log('Backend data:', data)
    
    if (!response.ok) {
      console.log('Backend error:', data)
      return NextResponse.json(
        data,
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Pack creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}