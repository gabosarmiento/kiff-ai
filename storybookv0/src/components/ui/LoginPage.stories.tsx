import type { Meta, StoryObj } from '@storybook/react'
import React, { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { LoginPage } from './LoginPage'

const meta: Meta<typeof LoginPage> = {
  title: 'Auth/LoginPage',
  component: LoginPage,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => {
      // Minimal setup for Storybook only: set tenant and mock fetch
      useEffect(() => {
        localStorage.setItem('tenant_id', '4485db48-71b7-47b0-8128-c6dca5be352d')
        const originalFetch = window.fetch
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const url = typeof input === 'string' ? input : input.toString()
          const method = (init?.method || 'GET').toUpperCase()

          if (url.endsWith('/api/auth/login') && method === 'POST') {
            return new Response(JSON.stringify({ access_token: 'demo-token' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          if (url.includes('/api/auth/social/start') && method === 'POST') {
            const provider = new URL(url, 'http://localhost').searchParams.get('provider') || 'google'
            return new Response(JSON.stringify({ url: `https://example.com/oauth/${provider}` }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          return originalFetch(input as any, init)
        }
        return () => {
          window.fetch = originalFetch
        }
      }, [])
      return (
        <>
          <Toaster position="top-right" />
          <Story />
        </>
      )
    }
  ]
}

export default meta

type Story = StoryObj<typeof LoginPage>

export const Default: Story = {
  render: () => <LoginPage />
}

export const WithLongerCopy: Story = {
  render: () => (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <LoginPage />
    </div>
  )
}
