import React from 'react'
import { PageContainer } from './PageContainer'
import { Button } from './Button'

export function UpgradeAccountPage() {
  return (
    <PageContainer fullscreen>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-5xl mx-auto grid gap-8">
          <header className="text-center grid gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Upgrade Account</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Choose the plan that fits your workflow. You can switch anytime.</p>
          </header>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Forever */}
            <section className="relative rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/[0.06] p-5">
              <div className="mb-3">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Free Forever</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get started with core features.</p>
              </div>
              <div className="flex items-end gap-1 mb-4">
                <div className="text-3xl font-semibold text-gray-900 dark:text-white">$0</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">/ month</div>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mb-5">
                <li>• Chat and canvas sandbox</li>
                <li>• Knowledge base creation (local)</li>
                <li>• Limited API calls</li>
                <li>• Community support</li>
              </ul>
              <Button variant="outline" className="w-full">Current Plan</Button>
            </section>

            {/* Pay As You Go */}
            <section className="relative rounded-2xl border border-blue-500/50 dark:border-blue-500/40 bg-white/90 dark:bg-white/[0.08] p-5 ring-1 ring-blue-500/20">
              <div className="absolute -top-3 right-4">
                <span className="text-[10px] uppercase tracking-wide bg-blue-600 text-white px-2 py-0.5 rounded">Recommended</span>
              </div>
              <div className="mb-3">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Pay As You Go</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Only pay for what you use.</p>
              </div>
              <div className="flex items-end gap-1 mb-4">
                <div className="text-3xl font-semibold text-gray-900 dark:text-white">$0</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">/ month + usage</div>
              </div>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mb-5">
                <li>• All Free features</li>
                <li>• Vector indexing and RAG</li>
                <li>• Priority generation queue</li>
                <li>• Cost-effective fractional billing</li>
              </ul>
              <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">Upgrade</Button>
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Billed per API usage. See pricing docs for details.</p>
            </section>
          </div>

          {/* FAQ / Notes */}
          <section className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-5">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Notes</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• You can downgrade or upgrade anytime.</li>
              <li>• For API requests, include the <code className="px-1 rounded bg-gray-100 dark:bg-white/10">X-Tenant-ID</code> header.</li>
              <li>• Enterprise plans available upon request.</li>
            </ul>
          </section>
        </div>
      </div>
    </PageContainer>
  )
}
