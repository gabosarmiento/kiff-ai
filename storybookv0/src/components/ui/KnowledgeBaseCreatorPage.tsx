import React from 'react'
import { PageContainer } from './PageContainer'

// Standalone page: Knowledge Base Creator
// - Main content: title, subtitle, KB name, API multi-select inside dashed box
// - Right sidebar: retrieval mode cards, vector DB single-select cards
// - Right sidebar has a single toggle button and collapses to a 12px rail

type RetrievalMode = 'agentic_search' | 'agentic_rag'

const API_OPTIONS = [
  { id: 'agno', title: 'AGNO Framework' },
  { id: 'openai', title: 'OpenAI' },
  { id: 'stripe', title: 'Stripe' },
  { id: 'stability', title: 'Stability AI' },
  { id: 'elevenlabs', title: 'ElevenLabs' },
  { id: 'leonardo', title: 'Leonardo AI' },
]

// MVP: LanceDB fixed
const VECTOR_DB_OPTIONS = [
  { id: 'lancedb', label: 'LanceDB' },
]

export function KnowledgeBaseCreatorPage() {
  const [mode, setMode] = React.useState<RetrievalMode>('agentic_search')
  const [db] = React.useState('lancedb')
  const [selectedApi, setSelectedApi] = React.useState<string | null>(null)
  const [sources, setSources] = React.useState<Array<{ type: 'api' | 'url'; value: string }>>([])
  const [urlModalOpen, setUrlModalOpen] = React.useState(false)
  const [urlInput, setUrlInput] = React.useState('')

  return (
    <PageContainer fullscreen>
      <div className="h-full grid" style={{ gridTemplateColumns: '1fr 22rem' }}>
        {/* Left column: main form */}
        <main className="p-6 overflow-auto">
          <div className="max-w-3xl mx-auto grid gap-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 ring-1 ring-blue-600/20">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2l1.9 4.1L18 8l-4.1 1.9L12 14l-1.9-4.1L6 8l4.1-1.9L12 2z"/></svg>
              </span>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Create Knowledge Base</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Choose a source and retrieval strategy. You can add more later.</p>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Knowledge Base Name</label>
              <input
                placeholder="Enter name"
                className="h-10 rounded-md border px-3 text-sm bg-white/80 dark:bg-white/[0.06] border-gray-200/70 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600/40"
              />
            </div>

            <div className="grid gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select API</label>
              <div className="rounded-xl border-2 border-dashed border-gray-200/70 dark:border-white/10 bg-gradient-to-b from-white/70 to-white/40 dark:from-white/[0.06] dark:to-white/[0.02] p-4 grid gap-3">
                <div className="grid gap-2">
                  <select
                    className="h-10 rounded-md border px-3 text-sm bg-white/80 dark:bg-white/[0.06] border-gray-200/70 dark:border-white/10 text-gray-900 dark:text-white outline-none"
                    value={selectedApi ?? ''}
                    onChange={e => {
                      const val = e.target.value || null
                      setSelectedApi(val)
                      setSources(prev => {
                        const rest = prev.filter(s => s.type !== 'api')
                        return val ? [{ type: 'api', value: val }, ...rest] : rest
                      })
                    }}
                  >
                    <option value="">Choose API</option>
                    {API_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.title}</option>
                    ))}
                  </select>
                  <div>
                    <button
                      type="button"
                      className="h-9 rounded-md border px-3 text-sm bg-white/80 dark:bg-white/[0.06] border-gray-200/70 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 inline-flex items-center gap-2"
                      onClick={() => setUrlModalOpen(true)}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Add from URL
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Selected sources</div>
                  {sources.length === 0 ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400">No sources yet.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sources.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-2 rounded-full border px-3 h-8 text-xs bg-white/70 dark:bg-white/5 border-gray-200/70 dark:border-white/10">
                          <span className="uppercase tracking-wide text-[10px] text-gray-500">{s.type}</span>
                          <span className="truncate max-w-[16rem] text-gray-800 dark:text-gray-200" title={s.value}>{s.value}</span>
                          <button aria-label="Remove" className="rounded-full hover:bg-red-500/10 text-red-600 px-1" onClick={() => setSources(prev => prev.filter((_, idx) => idx !== i))}>
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <button className="h-9 rounded-md bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm px-4 shadow-sm hover:from-blue-600/90 hover:to-blue-500/90">Create Knowledge Base</button>
            </div>
          </div>
        </main>

        {/* Right column: parameters */}
        <div className="h-full overflow-auto bg-white/60 dark:bg-white/[0.06] backdrop-blur-sm border-l border-gray-200/70 dark:border-white/10">
          <div className="sticky top-0 h-screen overflow-auto">
            <div className="p-4 grid gap-6">
                <div className="grid gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">Retrieval Mode</h3>
                  <div className="grid gap-2">
                    {[{
                      id: 'agentic_search', title: 'Agentic Search', body: 'Autonomous search with tools and reasoning.'
                    }, {
                      id: 'agentic_rag', title: 'Agentic RAG', body: 'Retrieval-augmented generation with orchestration.'
                    }].map(card => {
                      const active = mode === card.id
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setMode(card.id as RetrievalMode)}
                          className={`relative text-left rounded-lg border p-3 bg-white/70 dark:bg-white/5 transition-colors text-sm
                            ${active ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-200/70 dark:border-white/10'}`}
                        >
                          <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/20'}`}/>
                          <div className="font-medium text-gray-900 dark:text-white">{card.title}</div>
                          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{card.body}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid gap-3">
                  <h3 className="font-medium text-gray-900 dark:text-white">Vector Database</h3>
                  <div className="grid gap-2">
                    <div className={`relative flex items-center justify-between rounded-lg border p-3 bg-gradient-to-b from-white/70 to-white/50 dark:from-white/5 dark:to-white/[0.03] text-sm border-blue-500 ring-1 ring-blue-500/30`}>
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-600"/>
                      <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-600/10 text-blue-600">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><circle cx="12" cy="12" r="8"/></svg>
                        </span>
                        LanceDB (fixed)
                      </span>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
      {/* URL Modal */}
      {urlModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setUrlModalOpen(false)} />
          <div className="relative z-30 w-full max-w-md rounded-lg border bg-white dark:bg-[#0b1324] border-gray-200/70 dark:border-white/10 p-4 shadow-xl">
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Add from URL</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-3">Paste or write the URL here</div>
            <input
              className="w-full h-10 rounded-md border px-3 text-sm bg-white/80 dark:bg-white/[0.06] border-gray-200/70 dark:border-white/10 text-gray-900 dark:text-white outline-none"
              placeholder="https://example.com/docs"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button className="h-9 rounded-md px-3 text-sm text-gray-600 dark:text-gray-300 hover:underline" onClick={() => setUrlModalOpen(false)}>Cancel</button>
              <button
                className="h-9 rounded-md bg-blue-600 text-white text-sm px-4 hover:bg-blue-700"
                onClick={() => {
                  const u = urlInput.trim()
                  if (!u) return
                  setSources(prev => [...prev, { type: 'url', value: u }])
                  setUrlInput('')
                  setUrlModalOpen(false)
                }}
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
