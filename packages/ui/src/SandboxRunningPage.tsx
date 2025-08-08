import React from 'react'
import { PageContainer } from './PageContainer'
import { Loader2 } from 'lucide-react'

interface Message {
  role: 'assistant' | 'system'
  content: string
}

export function SandboxRunningPage() {
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'system', content: 'Run started. The agent is analyzing your request…' },
    { role: 'assistant', content: 'Parsing the problem and planning the steps.' },
  ])

  // Demo: append a couple of assistant updates
  React.useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []
    timeouts.push(setTimeout(() => setMessages(m => [...m, { role: 'assistant', content: 'Generating files and evaluating dependencies…' }]), 1000))
    timeouts.push(setTimeout(() => setMessages(m => [...m, { role: 'assistant', content: 'Validating outputs and preparing preview…' }]), 2000))
    return () => timeouts.forEach(t => clearTimeout(t))
  }, [])

  const StatusBadge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 px-2 py-0.5 text-xs dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Running
    </span>
  )

  return (
    <PageContainer fullscreen padded={false}>
      <div className="h-full grid grid-cols-1">
        {/* Conversation Only */}
        <section className="flex flex-col min-h-0">
          <header className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-medium text-gray-900 dark:text-white">Conversation</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Agent updates will appear here</p>
            </div>
            <div className="flex items-center gap-2">
              {StatusBadge}
              <button
                type="button"
                aria-label="Stop run"
                className="h-8 px-3 inline-flex items-center justify-center rounded-md border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] text-gray-800 dark:text-gray-100 text-xs hover:bg-white/90 dark:hover:bg-white/[0.08] shadow-sm"
                onClick={() => {/* no-op for now */}}
              >
                Stop
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className="text-left">
                <div className={`inline-block rounded-2xl px-3 py-2 text-sm shadow-sm border bg-white/70 dark:bg-white/[0.06] text-gray-900 dark:text-gray-100 border-gray-200/70 dark:border-white/10`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">
            The canvas and actions will appear once the run is finished.
          </div>
        </section>
      </div>
    </PageContainer>
  )
}
