import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/constants'
import { withTenantHeaders } from '@/lib/tenant'

// GET /api/packs/stats -> proxies to backend and augments with kiffs_created
export async function GET(_request: NextRequest) {
  try {
    // Fetch packs stats from backend
    const statsRes = await fetch(`${API_BASE_URL}/api/packs/stats`, {
      method: 'GET',
      headers: withTenantHeaders(),
      cache: 'no-store'
    });

    let stats: any = null;
    if (statsRes.ok) {
      stats = await statsRes.json();
    } else {
      // Graceful degrade
      const text = await statsRes.text().catch(() => '');
      console.warn('Backend /api/packs/stats unavailable:', text || statsRes.statusText);
      stats = {};
    }

    // Also fetch kiffs list to compute total kiffs created (usage)
    let kiffs_created = 0;
    try {
      const kiffsRes = await fetch(`${API_BASE_URL}/api/kiffs`, {
        method: 'GET',
        headers: withTenantHeaders(),
        cache: 'no-store'
      });
      if (kiffsRes.ok) {
        const kiffs = await kiffsRes.json();
        // Support array or object with items
        if (Array.isArray(kiffs)) {
          kiffs_created = kiffs.length;
        } else if (kiffs && Array.isArray(kiffs.items)) {
          kiffs_created = kiffs.items.length;
        }
      } else {
        const text = await kiffsRes.text().catch(() => '');
        console.warn('Backend /api/kiffs unavailable for stats:', text || kiffsRes.statusText);
      }
    } catch (e) {
      console.warn('Failed to fetch kiffs for stats:', e);
    }

    const payload = { ...stats, kiffs_created };
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Packs stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
