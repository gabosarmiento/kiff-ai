import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { LeftSidebarNav, type NavItem } from './LeftSidebarNav'
import { UserAdmin, type UserItem } from './UserAdmin'
import { APIAdmin } from './APIAdmin'
import { ModelAdmin, type ModelItem } from './ModelAdmin'
import { TenancyAdmin, type TenantSettings } from './TenancyAdmin'
import { PageContainer } from './PageContainer'
import { Users, Network, Cpu, Building2, LayoutDashboard, Settings } from 'lucide-react'

const meta: Meta = {
  title: 'Admin/AdminDashboard',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof meta>

// --- Mock data for demo ---
const demoUsers: UserItem[] = [
  { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', plan: 'pro', tokens_used: 2_400_000, tokens_month: 120_000, credits_usd: 32.5, tokens_purchased: 3_000_000, last_active: new Date().toISOString() },
  { id: 'u2', name: 'Bob Smith', email: 'bob@example.com', role: 'member', plan: 'free', tokens_used: 600_000, tokens_month: 80_000, credits_usd: 4.2, tokens_purchased: 800_000, last_active: new Date().toISOString() },
]

const demoModels: ModelItem[] = [
  { id: 'm1', provider: 'Groq', name: 'llama-3.1-8b-instant', family: 'Llama 3.1', modality: 'text', context_window: 128000, pricing: { input_per_1m: 0.2, output_per_1m: 0.2 }, tags: ['fast','coding'], status: 'active' },
  { id: 'm2', provider: 'OpenAI', name: 'gpt-4o-mini', family: 'GPT-4o', modality: 'multimodal', context_window: 128000, pricing: { input_per_1m: 0.6, output_per_1m: 0.6 }, tags: ['general'], status: 'preview' },
]

const demoTenant: TenantSettings = {
  id: 'demo-tenant-123',
  name: 'Kiff AI',
  slug: 'kiff-ai',
  logo: '🚀',
  primary_color: '#2563eb',
  billing_email: 'admin@kiff.ai',
  domains: ['kiff.ai', 'localhost'],
  api_keys: [{ id: 'key_1', label: 'Primary', created_at: new Date().toISOString() }],
  rag: {
    vector_db_uri: 'tmp/lancedb',
    table_name: 'user_docs',
    ttl_minutes: 15,
  },
  defaults: {
    model_provider: 'Groq',
    model_name: 'llama-3.1-8b-instant',
    embedder: 'text-embedding-3-small',
  },
  quotas: {
    monthly_tokens: 50_000_000,
    monthly_credits_usd: 1000,
  },
  stats: {
    users: 2,
    docs_indexed: 0,
    chunks: 0,
    tokens_month: 0,
  },
}

// --- Admin layout story ---
export const Default: Story = {
  render: () => {
    const [active, setActive] = React.useState<string>('dashboard')
    const [collapsed, setCollapsed] = React.useState<boolean>(false)

    const items: NavItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      {
        id: 'admin',
        label: 'Administration',
        children: [
          { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
          { id: 'apis', label: 'API Admin', icon: <Network className="h-4 w-4" /> },
          { id: 'models', label: 'Model Admin', icon: <Cpu className="h-4 w-4" /> },
          { id: 'tenancy', label: 'Tenancy', icon: <Building2 className="h-4 w-4" /> },
        ],
      },
      { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
    ]

    const itemsWithActive: NavItem[] = items.map((s) =>
      s.children
        ? { ...s, children: s.children.map((c) => ({ ...c, active: c.id === active })) }
        : { ...s, active: s.id === active }
    )

    const renderContent = () => {
      switch (active) {
        case 'users':
          return (
            <UserAdmin
              users={demoUsers}
              onCreateUser={() => { /* demo */ }}
              onUpdateUser={() => { /* demo */ }}
              onDeleteUser={() => { /* demo */ }}
            />
          )
        case 'apis':
          return (
            <APIAdmin providers={[]} />
          )
        case 'models':
          return (
            <ModelAdmin
              models={demoModels}
              onCreateModel={() => { /* demo */ }}
              onUpdateModel={() => { /* demo */ }}
              onDeleteModel={() => { /* demo */ }}
            />
          )
        case 'tenancy':
          return <TenancyAdmin settings={demoTenant} />
        default:
          return (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Select a section from the left menu to manage your workspace.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-4">
                  <div className="text-blue-600 dark:text-blue-300 text-sm font-medium">Users</div>
                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">{demoUsers.length}</div>
                </div>
                <div className="rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/20 p-4">
                  <div className="text-purple-600 dark:text-purple-300 text-sm font-medium">Models</div>
                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">{demoModels.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <div className="text-slate-600 dark:text-slate-300 text-sm font-medium">Tenant</div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">1</div>
                </div>
              </div>
            </div>
          )
      }
    }

    return (
      <div className="h-screen w-full bg-slate-50 dark:bg-slate-950">
        <div className="flex h-full">
          <LeftSidebarNav
            items={itemsWithActive}
            logo={<div className="text-sm font-semibold text-slate-900 dark:text-white">Kiff Admin</div>}
            onSelect={(id) => setActive(id)}
            collapsed={collapsed}
            onToggleCollapsed={setCollapsed}
          />
          <main className="flex-1">
            <PageContainer fullscreen padded>
              {renderContent()}
            </PageContainer>
          </main>
        </div>
      </div>
    )
  },
}
