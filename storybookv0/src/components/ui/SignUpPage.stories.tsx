import type { Meta, StoryObj } from '@storybook/react'
import React, { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { SignUpPage } from './SignUpPage'

const meta: Meta<typeof SignUpPage> = {
  title: 'Auth/SignUpPage',
  component: SignUpPage,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => {
      useEffect(() => {
        localStorage.setItem('tenant_id', '4485db48-71b7-47b0-8128-c6dca5be352d')
        const originalFetch = window.fetch
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const url = typeof input === 'string' ? input : input.toString()
          const method = (init?.method || 'GET').toUpperCase()

          if (url.endsWith('/api/auth/register') && method === 'POST') {
            return new Response(JSON.stringify({ status: 'success' }), {
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
        return () => { window.fetch = originalFetch }
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

type Story = StoryObj<typeof SignUpPage>

export const Default: Story = {
  render: () => <SignUpPage />
}
