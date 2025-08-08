import React, { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import AdminUserManagementPage from '../../pages/AdminUserManagementPage'

// Simple fetch mock util used in this story file only
function useMockApi() {
  useEffect(() => {
    // Ensure tenant is set so X-Tenant-ID is present
    localStorage.setItem('tenant_id', '4485db48-71b7-47b0-8128-c6dca5be352d')

    const originalFetch = window.fetch

    // Sample data
    const sampleUsers = Array.from({ length: 12 }).map((_, i) => ({
      id: i + 1,
      email: `user${i + 1}@example.com`,
      full_name: `User ${i + 1}`,
      status: (['active', 'suspended', 'banned', 'pending'] as const)[i % 4],
      subscription_plan: (['free', 'starter', 'pro', 'enterprise'] as const)[i % 4],
      monthly_tokens_used: (i + 1) * 1234,
      monthly_token_limit: 20000,
      sandbox_count: i % 3,
      last_activity: new Date(Date.now() - i * 86400000).toISOString(),
      last_login: new Date(Date.now() - i * 43200000).toISOString(),
      created_at: new Date(Date.now() - i * 172800000).toISOString(),
    }))

    const userDetail = (id: number) => ({
      ...sampleUsers.find(u => u.id === id)!,
      billing_history: [
        { id: 1, amount: 1200, currency: 'USD', billing_period_start: new Date().toISOString(), billing_period_end: new Date().toISOString(), payment_status: 'paid', created_at: new Date().toISOString() },
        { id: 2, amount: 900, currency: 'USD', billing_period_start: new Date().toISOString(), billing_period_end: new Date().toISOString(), payment_status: 'failed', created_at: new Date().toISOString() },
      ],
      sandboxes: [
        { id: 'sbx-1', status: 'running', strategy_type: 'preview', uptime: 99.9, tokens_used: 5000, created_at: new Date().toISOString() },
        { id: 'sbx-2', status: 'stopped', strategy_type: 'preview', uptime: 95.2, tokens_used: 2300, created_at: new Date().toISOString() },
      ],
    })

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString()

      // List users
      if (url.includes('/api/admin/users') && !/\/api\/admin\/users\/(\d+)/.test(url) && (!init || (init.method ?? 'GET') === 'GET')) {
        const params = new URL(url).searchParams
        const skip = Number(params.get('skip') || '0')
        const limit = Number(params.get('limit') || '10')
        const paged = sampleUsers.slice(skip, skip + limit)
        const body = JSON.stringify({ total: sampleUsers.length, pages: Math.ceil(sampleUsers.length / limit), users: paged })
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      // User detail
      const matchDetail = url.match(/\/api\/admin\/users\/(\d+)/)
      if (matchDetail && (!init || (init.method ?? 'GET') === 'GET')) {
        const id = Number(matchDetail[1])
        const body = JSON.stringify(userDetail(id))
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      // Status update
      if (matchDetail && init && (init.method === 'PUT')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      // Fallback to original
      return originalFetch(input as any, init)
    }) as typeof window.fetch

    return () => {
      window.fetch = originalFetch
    }
  }, [])
}

const MockedPage: React.FC = () => {
  useMockApi()
  return (
    <div className="min-h-screen">
      <AdminUserManagementPage />
    </div>
  )
}

const meta: Meta<typeof MockedPage> = {
  title: 'Admin/AdminUserManagementPage',
  component: MockedPage,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof MockedPage>

export const Default: Story = {
  render: () => <MockedPage />,
}

export const EmptyState: Story = {
  render: () => {
    // Override mock to return empty list for this story
    const EmptyMock: React.FC = () => {
      useEffect(() => {
        localStorage.setItem('tenant_id', '4485db48-71b7-47b0-8128-c6dca5be352d')
        const originalFetch = window.fetch
        window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const url = typeof input === 'string' ? input : input.toString()
          if (url.includes('/api/admin/users') && (!init || (init.method ?? 'GET') === 'GET')) {
            const body = JSON.stringify({ total: 0, pages: 0, users: [] })
            return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
          }
          return originalFetch(input as any, init)
        }) as typeof window.fetch
        return () => { window.fetch = originalFetch }
      }, [])
      return <AdminUserManagementPage />
    }
    return <EmptyMock />
  },
}
