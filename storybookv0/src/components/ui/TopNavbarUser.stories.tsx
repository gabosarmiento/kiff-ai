import React, { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import TopNavbar from '@/components/ui/TopNavbar'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

function useMockAuth(kind: 'user' | 'admin' = 'user') {
  useEffect(() => {
    localStorage.setItem('tenant_id', '4485db48-71b7-47b0-8128-c6dca5be352d')
    localStorage.setItem('authToken', 'demo-token')

    const originalFetch = window.fetch

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = (init?.method || 'GET').toUpperCase()

      if (url.endsWith('/api/auth/me') && method === 'GET') {
        const body = JSON.stringify({
          status: 'success',
          data: {
            id: 1,
            email: kind === 'admin' ? 'admin@kiff.ai' : 'demo@kiff.ai',
            username: kind === 'admin' ? 'admin' : 'demo_user',
            full_name: kind === 'admin' ? 'Admin User' : 'Demo User',
            role: kind === 'admin' ? 'admin' : 'user',
            is_active: true,
            created_at: new Date().toISOString(),
            avatar_url: undefined,
            tenant_id: '4485db48-71b7-47b0-8128-c6dca5be352d'
          }
        })
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return originalFetch(input as any, init)
    }) as typeof window.fetch

    return () => { window.fetch = originalFetch }
  }, [kind])
}

const NavbarWithUser: React.FC<{ kind?: 'user' | 'admin' }> = ({ kind = 'user' }) => {
  useMockAuth(kind)
  const Right = () => {
    const { user, logout } = useAuth()
    const label = user?.full_name || user?.username || 'Account'
    return (
      <TopNavbar
        brand={<span>KIFF</span>}
        links={[{ id: 'home', label: 'Home', href: '#' }, { id: 'docs', label: 'Docs', href: '#' }]}
        rightMenus={[{
          id: 'account',
          label: label,
          items: [
            { id: 'email', label: user?.email || '', onClick: () => {} },
            { id: 'role', label: `Role: ${user?.role || 'user'}`, onClick: () => {} },
            { id: 'logout', label: 'Logout', onClick: () => logout() },
          ]
        }]}
      />
    )
  }
  return (
    <AuthProvider>
      <Right />
    </AuthProvider>
  )
}

const meta: Meta<typeof NavbarWithUser> = {
  title: 'Auth/TopNavbar (Logged In)',
  component: NavbarWithUser,
}
export default meta

type Story = StoryObj<typeof NavbarWithUser>

export const LoggedInUser: Story = {
  args: { kind: 'user' },
  render: (args) => <NavbarWithUser {...args} />,
}

export const LoggedInAdmin: Story = {
  args: { kind: 'admin' },
  render: (args) => <NavbarWithUser {...args} />,
}
