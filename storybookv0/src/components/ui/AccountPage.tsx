import React from 'react'
import { PageContainer } from './PageContainer'
import { Button } from './Button'
import { Input } from './Input'

export function AccountPage() {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [apiKey, setApiKey] = React.useState('')
  const [tenantId, setTenantId] = React.useState('')

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text)
  }

  return (
    <PageContainer fullscreen>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-4xl mx-auto grid gap-8">
          <header className="grid gap-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Account</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your profile, security, and API settings.</p>
          </header>

          {/* Profile */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Profile</h2>
            </div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <Button className="bg-blue-600 text-white hover:bg-blue-700">Save Profile</Button>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Security</h2>
            </div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Current Password</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Button className="bg-blue-600 text-white hover:bg-blue-700">Update Password</Button>
              </div>
            </div>
          </section>

          {/* API Settings */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">API Settings</h2>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Use header: <code className="px-1 rounded bg-gray-100 dark:bg-white/10">X-Tenant-ID</code></span>
            </div>
            <div className="p-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">API Key</label>
                <div className="flex items-center gap-2">
                  <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="flex-1" />
                  <Button variant="outline" onClick={() => copy(apiKey)}>Copy</Button>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-300">Tenant ID</label>
                <div className="flex items-center gap-2">
                  <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="4485db48-71b7-47b0-8128-c6dca5be352d" className="flex-1" />
                  <Button variant="outline" onClick={() => copy(tenantId)}>Copy</Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">All API calls must include <code className="px-1 rounded bg-gray-100 dark:bg-white/10">X-Tenant-ID</code> header.</p>
              </div>
            </div>
          </section>

          {/* Billing */}
          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Billing</h2>
            </div>
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
              Billing details and invoices will appear here.
            </div>
          </section>

          {/* Danger Zone */}
          <section className="rounded-xl border border-red-200/70 dark:border-red-500/30 bg-white/70 dark:bg-white/[0.04]">
            <div className="px-4 py-3 border-b border-red-200/70 dark:border-red-500/30">
              <h2 className="text-sm font-medium text-red-700 dark:text-red-300">Danger Zone</h2>
            </div>
            <div className="p-4 grid gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">Deleting your account is irreversible. This is disabled in the demo.</p>
              <Button disabled variant="outline" className="border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50">Delete Account</Button>
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  )
}
