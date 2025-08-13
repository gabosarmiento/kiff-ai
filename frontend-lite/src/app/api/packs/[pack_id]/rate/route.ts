import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

export async function POST(
  request: NextRequest,
  { params }: { params: { pack_id: string } }
) {
  try {
    const { pack_id } = params
    const body = await request.json()
    
    const response = await fetch(`${API_BASE_URL}/api/packs/${pack_id}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...withTenantHeaders()
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json(
        data,
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Pack rating error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}