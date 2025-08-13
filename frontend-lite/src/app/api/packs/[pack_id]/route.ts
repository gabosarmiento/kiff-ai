import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL, DEFAULT_TENANT_ID, readEnv } from '@/lib/constants'

export async function GET(
  request: NextRequest,
  { params }: { params: { pack_id: string } }
) {
  try {
    const { pack_id } = params

    // Forward exact-case X-Tenant-ID from client, fallback to env/default
    const incomingTenant = request.headers.get('x-tenant-id')
    const incomingAuth = request.headers.get('authorization')
    const tenant = incomingTenant || readEnv('DEFAULT_TENANT_ID', DEFAULT_TENANT_ID) || DEFAULT_TENANT_ID

    const response = await fetch(`${API_BASE_URL}/api/packs/${pack_id}`, {
      method: 'GET',
      headers: {
        'X-Tenant-ID': tenant,
        ...(incomingAuth ? { 'Authorization': incomingAuth } : {})
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to fetch pack details' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Pack details API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { pack_id: string } }
) {
  try {
    const { pack_id } = params

    // Forward exact-case X-Tenant-ID from client, fallback to env/default
    const incomingTenant = request.headers.get('x-tenant-id')
    const tenant = incomingTenant || readEnv('DEFAULT_TENANT_ID', DEFAULT_TENANT_ID) || DEFAULT_TENANT_ID

    const response = await fetch(`${API_BASE_URL}/api/packs/${pack_id}`, {
      method: 'DELETE',
      headers: { 'X-Tenant-ID': tenant }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to delete pack' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Pack deletion API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}