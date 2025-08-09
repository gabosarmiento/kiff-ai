import type { Meta, StoryObj } from '@storybook/react'
import { TenancyAdmin, TenantSettings } from './TenancyAdmin'

const meta: Meta<typeof TenancyAdmin> = {
  title: 'Admin/TenancyAdmin',
  component: TenancyAdmin,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

const demoSettings: TenantSettings = {
  id: 'tenant-acme',
  name: 'Acme Inc',
  slug: 'acme',
  logo: '🚀',
  primary_color: '#2563eb',
  billing_email: 'billing@acme.com',
  domains: ['acme.com', 'apps.acme.com'],
  api_keys: [
    { id: 'k1', label: 'server-prod', created_at: new Date().toISOString() },
    { id: 'k2', label: 'server-staging', created_at: new Date().toISOString() },
  ],
  rag: { vector_db_uri: 'tmp/lancedb', table_name: 'tenant_docs', ttl_minutes: 15 },
  defaults: { model_provider: 'Groq', model_name: 'llama-3.1-8b-instant', embedder: 'text-embedding-3-large' },
  quotas: { monthly_tokens: 5_000_000, monthly_credits_usd: 250 },
  stats: { users: 18, docs_indexed: 142, chunks: 8421, tokens_month: 1_240_000 },
}

export const Default: Story = {
  render: () => <TenancyAdmin settings={demoSettings} />,
}

export const EmptyState: Story = {
  render: () => (
    <TenancyAdmin
      settings={{
        id: 'tenant-demo',
        name: 'New Tenant',
        slug: 'new-tenant',
        logo: '',
        primary_color: '#2563eb',
        billing_email: '',
        domains: [],
        api_keys: [],
        rag: {},
        defaults: {},
        quotas: {},
        stats: { users: 0, docs_indexed: 0, chunks: 0, tokens_month: 0 },
      }}
    />
  ),
}
