import React from 'react'
import { PageContainer } from './PageContainer'

// Standalone page: Knowledge Base Creator
// - Main content: title, subtitle, KB name, API multi-select inside dashed box
// - Right sidebar: retrieval mode cards, vector DB single-select cards
// - Right sidebar has a single toggle button and collapses to a 12px rail

type RetrievalMode = 'agentic_search' | 'agentic_rag'

const API_OPTIONS = [
  { id: 'usage', title: 'Usage API', body: 'Track tokens, costs, and usage analytics.' },
  { id: 'ingest', title: 'Ingest API', body: 'Push content for indexing and updates.' },
  { id: 'search', title: 'Search API', body: 'Query semantic search endpoints.' },
  { id: 'chat', title: 'Chat API', body: 'Conversational interface with memory.' },
  { id: 'evals', title: 'Eval API', body: 'Quality checks and scoring workflows.' },
]

const VECTOR_DB_OPTIONS = [
  { id: 'elasticsearch', label: 'Elasticsearch' },
  { id: 'pinecone', label: 'Pinecone' },
  { id: 'weaviate', label: 'Weaviate' },
  { id: 'qdrant', label: 'Qdrant' },
  { id: 'chroma', label: 'Chroma' },
]

export function KnowledgeBaseCreatorPage() {
  const [rightCollapsed, setRightCollapsed] = React.useState(false)
  const [mode, setMode] = React.useState<RetrievalMode>('agentic_search')
  const [db, setDb] = React.useState('elasticsearch')
  const [selectedApis, setSelectedApis] = React.useState<Set<string>>(new Set())
  const [apiMenuOpen, setApiMenuOpen] = React.useState(false)

  return (
    <PageContainer fullscreen>
      <div
        className="h-full grid"
        style={{ gridTemplateColumns: `${rightCollapsed ? '1fr 12px' : '1fr 22rem'}` }}
      >
        {/* Main form */}
        <main className="p-6 overflow-auto">
          <div className="max-w-3xl mx-auto grid gap-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Create Knowledge Base</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select APIs and retrieval options.</p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Knowledge Base Name</label>
              <input
                placeholder="Enter name"
                className="h-10 rounded-md border px-3 text-sm bg-white/80 dark:bg-white/[0.06] border-gray-200/70 dark:border-white/10 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600/40"
              />
            </div>

            <div className="grid gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select APIs</label>
              <div className="relative rounded-xl border-2 border-dashed border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] min-h-[10rem] grid place-items-center px-4">
                <div className="w-full max-w-sm">
                  <button
                    type="button"
                    onClick={() => setApiMenuOpen(v => !v)}
                    className="w-full h-10 rounded-md border bg-white/80 dark:bg-white/[0.06] border-gray-200/70 dark:border-white/10 text-left px-3 text-sm text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    <span>
                      {selectedApis.size === 0 ? 'Choose APIs' : `${selectedApis.size} API${selectedApis.size>1?'s':''} selected`}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-500 dark:text-gray-400"><path fillRule="evenodd" d="M12 14.5 6.75 9.25l.75-.75L12 12.5l4.5-4 .75.75L12 14.5Z" clipRule="evenodd"/></svg>
                  </button>
                  {apiMenuOpen && (
                    <div className="mt-2 rounded-md border bg-white dark:bg-[#0b1324] border-gray-200/70 dark:border-white/10 shadow-sm p-2 text-sm">
                      {API_OPTIONS.map(opt => {
                        const active = selectedApis.has(opt.id)
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedApis(prev => {
                              const next = new Set(prev)
                              if (next.has(opt.id)) next.delete(opt.id); else next.add(opt.id)
                              return next
                            })}
                            className={`w-full text-left rounded-md px-3 py-2 flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-white/5 ${active ? 'ring-1 ring-blue-500/30 border border-blue-500' : 'border border-transparent'}`}
                          >
                            <span className={`mt-1 h-2 w-2 rounded-full ${active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/20'}`}/>
                            <span>
                              <div className="font-medium text-gray-900 dark:text-white">{opt.title}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-300">{opt.body}</div>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <button className="h-9 rounded-md bg-blue-600 text-white text-sm px-4 hover:bg-blue-700">Create Knowledge Base</button>
            </div>
          </div>
        </main>

        {/* Right rail/panel */}
        <div className="relative h-full overflow-hidden bg-white/60 dark:bg-white/[0.06] backdrop-blur-sm border-l border-gray-200/70 dark:border-white/10">
          <button
            aria-label={rightCollapsed ? 'Open parameters' : 'Collapse parameters'}
            title={rightCollapsed ? 'Parameters' : 'Collapse'}
            onClick={() => setRightCollapsed(v => !v)}
            className={`absolute right-0 translate-x-1/2 top-16 z-10 h-8 w-8 rounded-full border flex items-center justify-center transition-colors
              bg-white/70 dark:bg-white/5 backdrop-blur-sm border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400`}
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            {rightCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3 6.75A.75.75 0 0 1 3.75 6h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75ZM16.5 6a1.5 1.5 0 1 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Zm-3 6a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 0 3h-1A1.5 1.5 0 0 1 13.5 12Zm3 3.75a1.5 1.5 0 1 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Z"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M14.53 5.47a.75.75 0 0 1 0 1.06L10.06 11l4.47 4.47a.75.75 0 0 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd"/></svg>
            )}
          </button>
          <div className="h-full">
            <div
              className={`sticky top-0 h-screen overflow-auto transition-transform duration-300 ease-out bg-white dark:bg-[#0b1324]/80`}
              style={{ transform: rightCollapsed ? 'translateX(100%)' : 'translateX(0)' }}
            >
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
                  <h3 className="font-medium text-gray-900 dark:text-white">Vector Databases</h3>
                  <div className="grid gap-2">
                    {VECTOR_DB_OPTIONS.map(opt => {
                      const active = db === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDb(opt.id)}
                          className={`relative flex items-center justify-between rounded-lg border p-3 bg-white/70 dark:bg-white/5 transition-colors text-sm
                            ${active ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-200/70 dark:border-white/10'}`}
                        >
                          <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/20'}`}/>
                          <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-600/10 text-blue-600">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><circle cx="12" cy="12" r="8"/></svg>
                            </span>
                            {opt.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
