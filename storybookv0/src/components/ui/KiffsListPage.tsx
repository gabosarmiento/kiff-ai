import React from 'react'
import { PageContainer } from './PageContainer'
import { Button } from './Button'

type Kiff = {
  id: string
  name: string
  createdAt: string
  status: 'draft' | 'active' | 'archived'
}

const sampleKiffs: Kiff[] = [
  { id: '1', name: 'Demo E‑commerce Assistant', createdAt: '2025-08-01', status: 'active' },
  { id: '2', name: 'Docs RAG for AGNO', createdAt: '2025-08-03', status: 'draft' },
  { id: '3', name: 'Stripe Billing Helper', createdAt: '2025-08-05', status: 'active' },
]

function StatusBadge({ status }: { status: Kiff['status'] }) {
  const map = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    archived: 'bg-gray-200 text-gray-700 dark:bg-white/5 dark:text-gray-400',
  }
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return <span className={`text-xs px-2 py-0.5 rounded ${map[status]}`}>{label}</span>
}

export function KiffsListPage() {
  const [kiffs, setKiffs] = React.useState<Kiff[]>(sampleKiffs)

  const onCreateNew = () => {
    // Placeholder: navigate to sandbox/new or open modal
    // eslint-disable-next-line no-alert
    alert('Create New Kiff – wire to your route (e.g., /sandbox or /kiff/new)')
  }
  const onOpen = (kiff: Kiff) => {
    // Placeholder: navigate to /sandbox/:id or /kiff/:id
    // eslint-disable-next-line no-alert
    alert(`Open Kiff: ${kiff.name}`)
  }

  return (
    <PageContainer fullscreen>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-5xl mx-auto grid gap-6">
          <header className="flex items-center justify-between">
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kiffs</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your created kiffs. Start a new one anytime.</p>
            </div>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={onCreateNew}>
              Create New Kiff
            </Button>
          </header>

          <section className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.06]">
            <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">All Kiffs</h2>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{kiffs.length} total</span>
            </div>
            <div className="divide-y divide-gray-200/70 dark:divide-white/10">
              {kiffs.map((kiff) => (
                <div key={kiff.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{kiff.name}</h3>
                      <StatusBadge status={kiff.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Created {kiff.createdAt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => onOpen(kiff)}>Open</Button>
                    <Button disabled variant="outline" className="opacity-60 cursor-not-allowed">Delete</Button>
                  </div>
                </div>
              ))}
              {kiffs.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No kiffs yet. Create your first one.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </PageContainer>
  )
}
