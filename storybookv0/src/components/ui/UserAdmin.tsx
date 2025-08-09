import React, { useMemo, useState } from 'react'
import { PageContainer } from './PageContainer'
import { Card, CardContent, CardHeader } from './Card'
import { Input } from './Input'
import { Button } from './Button'
import { Badge } from './Badge'
import { cn } from '../../lib/utils'
import { Search, Plus, Edit, Trash2, RefreshCw, Coins, BarChart2, X, Save } from 'lucide-react'

export type UserItem = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  plan?: 'free' | 'pro' | 'enterprise'
  tokens_used?: number // lifetime tokens consumed
  tokens_month?: number // current month tokens
  credits_usd?: number // prepaid credits balance in USD
  tokens_purchased?: number // lifetime tokens purchased (if token-based)
  last_active?: string // ISO date
}

export interface UserAdminProps {
  users?: UserItem[]
  onCreateUser?: (user: Omit<UserItem, 'id'>) => void
  onUpdateUser?: (id: string, patch: Partial<UserItem>) => void
  onDeleteUser?: (id: string) => void
  className?: string
}

const defaultForm: Omit<UserItem, 'id'> = {
  name: '',
  email: '',
  role: 'member',
  plan: 'free',
  tokens_used: 0,
  tokens_month: 0,
  credits_usd: 0,
  tokens_purchased: 0,
  last_active: new Date().toISOString(),
}

export function UserAdmin({ users = [], onCreateUser, onUpdateUser, onDeleteUser, className }: UserAdminProps) {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list'|'create'|'edit'>('list')
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [form, setForm] = useState<Omit<UserItem,'id'>>(defaultForm)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return users.filter(u =>
      u.name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      (u.role||'').toLowerCase().includes(s) ||
      (u.plan||'').toLowerCase().includes(s)
    )
  }, [users, search])

  const resetForm = () => setForm(defaultForm)

  const openCreate = () => { resetForm(); setSelected(null); setView('create') }
  const openEdit = (u: UserItem) => {
    setSelected(u)
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      plan: u.plan,
      tokens_used: u.tokens_used,
      tokens_month: u.tokens_month,
      credits_usd: u.credits_usd,
      tokens_purchased: u.tokens_purchased,
      last_active: u.last_active,
    })
    setView('edit')
  }

  const cancel = () => { setView('list'); setSelected(null); resetForm() }

  const save = () => {
    if (view === 'create') {
      onCreateUser?.(form)
    } else if (view === 'edit' && selected) {
      onUpdateUser?.(selected.id, form)
    }
    cancel()
  }

  const UsageRow = ({ label, value, suffix }: { label: string; value?: number; suffix?: string }) => (
    <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
      <span>{label}</span>
      <span className="font-medium">{typeof value === 'number' ? value.toLocaleString() : '-'}{suffix ? ` ${suffix}` : ''}</span>
    </div>
  )

  if (view === 'create' || view === 'edit') {
    return (
      <PageContainer fullscreen>
        <div className={cn('h-full overflow-auto p-6', className)}>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{view==='create'?'Create User':`Edit User: ${selected?.name}`}</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Aligned with Pages/Account visuals</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={cancel}><X className="h-4 w-4 mr-2"/>Cancel</Button>
                <Button onClick={save}><Save className="h-4 w-4 mr-2"/>Save</Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">Profile</h2>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-xs text-gray-600 dark:text-gray-300">Name</label>
                  <Input value={form.name} onChange={(e)=>setForm(prev=>({...prev, name:e.target.value}))} placeholder="User name"/>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-gray-600 dark:text-gray-300">Email</label>
                  <Input type="email" value={form.email} onChange={(e)=>setForm(prev=>({...prev, email:e.target.value}))} placeholder="user@example.com"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-300 mb-2">Role</label>
                    <select value={form.role} onChange={(e)=>setForm(prev=>({...prev, role:e.target.value as any}))} className="w-full h-11 px-3 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-300 mb-2">Plan</label>
                    <select value={form.plan} onChange={(e)=>setForm(prev=>({...prev, plan:e.target.value as any}))} className="w-full h-11 px-3 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white">
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">Usage & Credits</h2>
              </CardHeader>
              <CardContent className="grid gap-3">
                <UsageRow label="Tokens (this month)" value={form.tokens_month} />
                <UsageRow label="Tokens (lifetime)" value={form.tokens_used} />
                <UsageRow label="Credits balance" value={form.credits_usd} suffix="USD" />
                <UsageRow label="Tokens purchased (lifetime)" value={form.tokens_purchased} />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    )
  }

  // List view
  return (
    <PageContainer fullscreen>
      <div className={cn('h-full overflow-auto p-6', className)}>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Users</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage users, tokens consumption, and credits.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={()=>setSearch('')}><RefreshCw className="h-4 w-4"/></Button>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2"/>New User</Button>
            </div>
          </div>

          {/* Search */}
          <Card>
            <CardHeader className="mb-3">
              <div className="flex items-center gap-2">
                <Input className="flex-1" placeholder="Search by name, email, role, or plan" leftIcon={<Search className='h-4 w-4'/>} value={search} onChange={(e)=>setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">No users found.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filtered.map(u => {
                    const monthPct = Math.min(100, Math.round(((u.tokens_month||0) / Math.max(1,(u.tokens_used||1))) * 100))
                    return (
                      <div key={u.id} className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 dark:text-white">{u.name}</h3>
                              <Badge variant={u.role==='admin'?'warning':'info'} size="sm">{u.role}</Badge>
                              {u.plan && <Badge variant="success" size="sm">{u.plan}</Badge>}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{u.email}</div>
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                <span className="flex items-center gap-1"><BarChart2 className="h-3 w-3"/> Tokens (month)</span>
                                <span className="font-medium">{(u.tokens_month||0).toLocaleString()}</span>
                              </div>
                              <div className="h-2 bg-gray-100 dark:bg-white/10 rounded mt-1 overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${monthPct}%` }} />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3 text-sm text-gray-700 dark:text-gray-300">
                              <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Tokens (lifetime)</div>
                                <div className="font-medium">{(u.tokens_used||0).toLocaleString()}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Credits</div>
                                <div className="font-medium flex items-center gap-1"><Coins className="h-4 w-4"/>${(u.credits_usd||0).toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Tokens bought</div>
                                <div className="font-medium">{(u.tokens_purchased||0).toLocaleString()}</div>
                              </div>
                            </div>
                            {u.last_active && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Last active: {new Date(u.last_active).toLocaleString()}</div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={()=>openEdit(u)}><Edit className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={()=>onDeleteUser?.(u.id)}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
