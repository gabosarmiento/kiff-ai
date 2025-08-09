import React from 'react'
import { PageContainer } from './PageContainer'
import { Card, CardContent, CardHeader } from './Card'
import { Input } from './Input'
import { Button } from './Button'
import { Badge } from './Badge'
import { cn } from '../../lib/utils'
import { Plus, Trash2, RefreshCw, Save, X, Shield, Globe, KeyRound, Layers } from 'lucide-react'

export type TenantSettings = {
  id: string
  name: string
  slug: string
  logo?: string // emoji or URL
  primary_color?: string
  billing_email?: string
  domains: string[]
  api_keys: { id: string; label: string; created_at: string }[]
  rag: {
    vector_db_uri?: string
    table_name?: string
    ttl_minutes?: number
  }
  defaults: {
    model_provider?: string
    model_name?: string
    embedder?: string
  }
  quotas?: {
    monthly_tokens?: number
    monthly_credits_usd?: number
  }
  stats?: {
    users: number
    docs_indexed: number
    chunks: number
    tokens_month: number
  }
}

export interface TenancyAdminProps {
  settings: TenantSettings
  onSave?: (settings: TenantSettings) => void
  onRotateKey?: (keyId: string) => void
  onCreateKey?: (label: string) => void
  onDeleteKey?: (keyId: string) => void
  onAddDomain?: (domain: string) => void
  onRemoveDomain?: (domain: string) => void
  className?: string
}

export function TenancyAdmin({ settings: initial, onSave, onRotateKey, onCreateKey, onDeleteKey, onAddDomain, onRemoveDomain, className }: TenancyAdminProps) {
  const [settings, setSettings] = React.useState<TenantSettings>(initial)
  const [newDomain, setNewDomain] = React.useState('')
  const [newKeyLabel, setNewKeyLabel] = React.useState('')

  const save = () => onSave?.(settings)

  return (
    <PageContainer fullscreen>
      <div className={cn('h-full overflow-auto p-6', className)}>
        <div className="max-w-6xl mx-auto grid gap-8">
          <header className="grid gap-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tenancy Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure multi-tenant branding, RAG infrastructure, defaults, usage quotas, and API access.</p>
          </header>

          {/* Overview */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Overview</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=>setSettings(initial)}><X className="h-4 w-4 mr-2"/>Reset</Button>
                <Button onClick={save}><Save className="h-4 w-4 mr-2"/>Save Changes</Button>
              </div>
            </div>
            <div className="p-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Tenant Name</label>
                <Input value={settings.name} onChange={(e)=>setSettings(prev=>({...prev, name: e.target.value}))} placeholder="Acme Inc" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Slug</label>
                <Input value={settings.slug} onChange={(e)=>setSettings(prev=>({...prev, slug: e.target.value}))} placeholder="acme" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Logo (emoji or URL)</label>
                <Input value={settings.logo||''} onChange={(e)=>setSettings(prev=>({...prev, logo: e.target.value}))} placeholder="🚀 or https://..." />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Primary Color</label>
                <Input type="color" value={settings.primary_color||'#2563eb'} onChange={(e)=>setSettings(prev=>({...prev, primary_color: e.target.value}))} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Billing Email</label>
                <Input type="email" value={settings.billing_email||''} onChange={(e)=>setSettings(prev=>({...prev, billing_email: e.target.value}))} placeholder="billing@acme.com" />
              </div>
            </div>
          </section>

          {/* Domains & API Keys */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Access Control</h2>
              <Badge variant="info" size="sm">Use X-Tenant-ID header</Badge>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Allowed Domains</h3>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Input className="flex-1" placeholder="example.com" value={newDomain} onChange={(e)=>setNewDomain(e.target.value)} />
                  <Button onClick={()=>{ if(!newDomain) return; onAddDomain?.(newDomain); setNewDomain('') }}><Plus className="h-4 w-4"/></Button>
                </div>
                <ul className="space-y-2">
                  {settings.domains.map(d => (
                    <li key={d} className="flex items-center justify-between rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{d}</span>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={()=>onRemoveDomain?.(d)}><Trash2 className="h-4 w-4"/></Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="h-4 w-4" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">API Keys</h3>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Input className="flex-1" placeholder="Key label (e.g., server-prod)" value={newKeyLabel} onChange={(e)=>setNewKeyLabel(e.target.value)} />
                  <Button onClick={()=>{ if(!newKeyLabel) return; onCreateKey?.(newKeyLabel); setNewKeyLabel('') }}><Plus className="h-4 w-4"/></Button>
                </div>
                <ul className="space-y-2">
                  {settings.api_keys.map(k => (
                    <li key={k.id} className="flex items-center justify-between rounded-lg border border-gray-200/70 dark:border-white/10 px-3 py-2">
                      <div className="text-sm">
                        <div className="text-gray-900 dark:text-white font-medium">{k.label}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">Created {new Date(k.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={()=>onRotateKey?.(k.id)}><RefreshCw className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={()=>onDeleteKey?.(k.id)}><Trash2 className="h-4 w-4"/></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* RAG & Defaults */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"><Layers className="h-4 w-4"/> RAG & Defaults</h2>
            </div>
            <div className="p-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Vector DB URI</label>
                <Input value={settings.rag.vector_db_uri||''} onChange={(e)=>setSettings(prev=>({...prev, rag: { ...prev.rag, vector_db_uri: e.target.value }}))} placeholder="tmp/lancedb" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Table Name</label>
                <Input value={settings.rag.table_name||''} onChange={(e)=>setSettings(prev=>({...prev, rag: { ...prev.rag, table_name: e.target.value }}))} placeholder="tenant_docs" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Session TTL (minutes)</label>
                <Input type="number" value={String(settings.rag.ttl_minutes||15)} onChange={(e)=>setSettings(prev=>({...prev, rag: { ...prev.rag, ttl_minutes: parseInt(e.target.value||'0', 10) }}))} />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Default Model Provider</label>
                <Input value={settings.defaults.model_provider||''} onChange={(e)=>setSettings(prev=>({...prev, defaults: { ...prev.defaults, model_provider: e.target.value }}))} placeholder="Groq" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Default Model Name</label>
                <Input value={settings.defaults.model_name||''} onChange={(e)=>setSettings(prev=>({...prev, defaults: { ...prev.defaults, model_name: e.target.value }}))} placeholder="llama-3.1-8b-instant" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Default Embedder</label>
                <Input value={settings.defaults.embedder||''} onChange={(e)=>setSettings(prev=>({...prev, defaults: { ...prev.defaults, embedder: e.target.value }}))} placeholder="text-embedding-3-large" />
              </div>
            </div>
          </section>

          {/* Quotas & Stats */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Quotas & Stats</h2>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Monthly Tokens Quota</label>
                <Input type="number" value={String(settings.quotas?.monthly_tokens ?? '')} onChange={(e)=>setSettings(prev=>({...prev, quotas: { ...(prev.quotas||{}), monthly_tokens: parseInt(e.target.value||'0', 10) }}))} />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Monthly Credits (USD)</label>
                <Input type="number" value={String(settings.quotas?.monthly_credits_usd ?? '')} onChange={(e)=>setSettings(prev=>({...prev, quotas: { ...(prev.quotas||{}), monthly_credits_usd: parseFloat(e.target.value||'0') }}))} />
              </div>
              <div className="grid gap-4 md:col-span-2">
                <div className="grid grid-cols-4 gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Users</div>
                    <div className="font-semibold">{settings.stats?.users ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Docs Indexed</div>
                    <div className="font-semibold">{settings.stats?.docs_indexed ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Chunks</div>
                    <div className="font-semibold">{settings.stats?.chunks ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Tokens (month)</div>
                    <div className="font-semibold">{settings.stats?.tokens_month?.toLocaleString?.() ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security note */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white"><Shield className="h-4 w-4"/> Security</h2>
            </div>
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
              Ensure all admin API calls include <code className="px-1 rounded bg-gray-100 dark:bg-white/10">X-Tenant-ID</code> and scope RAG queries by tenant metadata (tenant_id, user_id, session_id) following AGNO best practices.
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  )
}
