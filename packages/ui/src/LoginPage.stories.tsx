import React, { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { LoginPage } from '@/pages/LoginPage'
import { AuthProvider } from '@/contexts/AuthContext'
import { MemoryRouter } from 'react-router-dom'
import { PageContainer } from './PageContainer'

function useAuthApiMocks(kind: 'user' | 'admin' = 'user') {
  useEffect(() => {
    localStorage.setItem('tenant_id', '4485db48-71b7-47b0-8128-c6dca5be352d')

    const originalFetch = window.fetch

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = (init?.method || 'GET').toUpperCase()

      // Login
      if (url.endsWith('/api/auth/login') && method === 'POST') {
        const body = JSON.stringify({ access_token: 'demo-token' })
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      // Register
      if (url.endsWith('/api/auth/register') && method === 'POST') {
        const body = JSON.stringify({ status: 'success', message: 'registered' })
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      // Me
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

const WithAuth: React.FC<{ kind?: 'user' | 'admin'; forceRegister?: boolean }> = ({ kind = 'user', forceRegister = false }) => {
  useAuthApiMocks(kind)
  // Force dark mode in this story by adding the html.dark class
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => document.documentElement.classList.remove('dark')
  }, [])
  // Optionally switch to Register mode by programmatically clicking the toggle button
  useEffect(() => {
    if (forceRegister) {
      setTimeout(() => {
        const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
        const toggle = btns.find(b => /Sign up|Sign in/i.test(b.textContent || ''))
        toggle?.click()
      }, 50)
    }
  }, [forceRegister])

  return (
    <AuthProvider>
      <PageContainer fullscreen>
        <div className="h-full overflow-auto p-6">
          <LoginPage />
        </div>
      </PageContainer>
    </AuthProvider>
  )
}

const meta: Meta<typeof WithAuth> = {
  title: 'Auth/LoginPage',
  component: WithAuth,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/login"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof WithAuth>

export const LoginView: Story = {
  args: { kind: 'user' },
  render: (args) => <WithAuth {...args} />,
}

export const SignupView: Story = {
  args: { kind: 'user', forceRegister: true },
  render: (args) => <WithAuth {...args} />,
}

export const AdminBackofficeLogin: Story = {
  args: { kind: 'admin' },
  render: (args) => <WithAuth {...args} />,
}
