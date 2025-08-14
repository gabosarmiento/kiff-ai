import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/constants';
import { withTenantHeaders } from '@/lib/tenant';

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;
  try {
    const res = await fetch(`${API_BASE_URL}/api/kiffs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: withTenantHeaders(),
      cache: 'no-store',
    });
    const text = await res.text().catch(() => '');
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      // Pass through backend error payload/status
      if (contentType.includes('application/json')) {
        return new NextResponse(text || JSON.stringify({ error: 'Delete failed' }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
      }
      return new NextResponse(text || 'Delete failed', { status: res.status });
    }

    // Success: normalize to JSON
    try {
      const json = text ? JSON.parse(text) : { ok: true, deleted_id: id };
      return NextResponse.json(json);
    } catch {
      return NextResponse.json({ ok: true, deleted_id: id });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reach backend' }, { status: 502 });
  }
}
