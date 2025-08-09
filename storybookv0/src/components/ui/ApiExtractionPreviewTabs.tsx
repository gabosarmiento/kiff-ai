import React from 'react'

export type PreviewView = 'text' | 'markdown' | 'raw'

export type ExtractedDocument = {
  id: string
  title: string
  text?: string
  markdown?: string
  raw?: string
  language?: string // for raw code highlighting context (storybook only)
}

export type ApiExtractionPreviewTabsProps = {
  docs: ExtractedDocument[]
  initialDocId?: string
  initialView?: PreviewView
  stats?: {
    durationMs: number
    totalTokens: number
    totalChunks: number
    costUSD?: number
  }
  title?: string
  onBack?: () => void
}

export const ApiExtractionPreviewTabs: React.FC<ApiExtractionPreviewTabsProps> = ({ docs, initialDocId, initialView = 'text', stats, title = 'API Extraction Tester', onBack }) => {
  const [activeDoc, setActiveDoc] = React.useState<string>(initialDocId || (docs[0]?.id ?? ''))
  const [view, setView] = React.useState<PreviewView>(initialView)

  const doc = React.useMemo(() => docs.find(d => d.id === activeDoc) || docs[0], [docs, activeDoc])

  // Derive simple stats if not provided (storybook-only heuristic)
  const derived = React.useMemo(() => {
    if (stats) return stats
    const choose = (d: ExtractedDocument) => (view === 'text' && d.text) || (view === 'markdown' && d.markdown) || (view === 'raw' && d.raw) || d.text || d.markdown || d.raw || ''
    const contents = docs.map(choose)
    const totalChars = contents.reduce((acc, s) => acc + s.length, 0)
    const totalTokens = Math.max(1, Math.round(totalChars / 4)) // rough char->token estimate
    const totalChunks = docs.length
    const durationMs = 1200 + totalChunks * 150 // playful heuristic
    return { durationMs, totalTokens, totalChunks } as Required<NonNullable<ApiExtractionPreviewTabsProps['stats']>>
  }, [docs, view, stats])

  // Per-view counts used in tab labels (proxy for chunk counts in SB demo)
  const viewCounts = React.useMemo(() => {
    const has = (k: PreviewView, d: ExtractedDocument) =>
      (k === 'text' && !!d.text) || (k === 'markdown' && !!d.markdown) || (k === 'raw' && !!d.raw)
    return {
      text: docs.filter(d => has('text', d)).length,
      markdown: docs.filter(d => has('markdown', d)).length,
      raw: docs.filter(d => has('raw', d)).length,
    }
  }, [docs])

  const renderContent = () => {
    if (!doc) return null
    const content = view === 'text' ? doc.text : view === 'markdown' ? doc.markdown : doc.raw
    if (!content) {
      return (
        <div className="text-sm text-slate-500">No {view} available for this document.</div>
      )
    }
    if (view === 'markdown') {
      // Minimal markdown rendering for Storybook-only (no external deps)
      // naive replacements for headings and code blocks
      const html = content
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/`{3}([\s\S]*?)`{3}/gim, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        .replace(/\n$/gim, '<br />')
      return (
        <div className="prose prose-slate max-w-none prose-pre:rounded-xl prose-pre:bg-slate-950 prose-pre:text-slate-100" dangerouslySetInnerHTML={{ __html: html }} />
      )
    }
    if (view === 'raw') {
      return (
        <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-slate-100"><code>{content}</code></pre>
      )
    }
    return (
      <div className="whitespace-pre-wrap text-sm text-slate-800">{content}</div>
    )
  }

  return (
    <div className="h-screen w-full p-4 md:p-6">
      <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              aria-label="Go back"
            >
              ← Back
            </button>
          )}
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </div>
        {/* Top: document tabs (scrollable) */}
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {docs.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveDoc(d.id)}
              className={
                [
                  'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition',
                  activeDoc === d.id
                    ? 'border-slate-300 bg-slate-100 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                ].join(' ')}
              title={d.title}
            >
              {d.title}
            </button>
          ))}
        </div>

        {/* View switcher */}
        <div className="mb-4 flex items-center gap-2">
          {(['text','markdown','raw'] as PreviewView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                [
                  'rounded-full px-3 py-1.5 text-xs font-medium transition',
                  view === v ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                ].join(' ')}
            >
              {v.toUpperCase()} {viewCounts[v] ? `(${viewCounts[v]} Chunks)` : ''}
            </button>
          ))}
        </div>

        {/* Content + Stats */}
        <div className="min-h-0 flex-1">
          <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="min-h-0 overflow-auto rounded-lg border border-slate-200 bg-white p-4">
              {renderContent()}
            </div>
            <aside className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">Run stats</div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-slate-500">Duration</span><span className="font-medium text-slate-900" aria-label="duration">{Math.round(derived.durationMs)} ms</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Total tokens</span><span className="font-medium text-slate-900" aria-label="tokens">{derived.totalTokens.toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Chunks</span><span className="font-medium text-slate-900" aria-label="chunks">{derived.totalChunks}</span></div>
                {stats?.costUSD !== undefined && (
                  <div className="flex items-center justify-between"><span className="text-slate-500">Est. cost</span><span className="font-medium text-slate-900" aria-label="cost">${stats.costUSD.toFixed(4)}</span></div>
                )}
              </div>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div className="mb-1 font-medium text-slate-700">Context</div>
                <div>View: <span className="font-semibold">{view.toUpperCase()}</span></div>
                <div className="truncate" title={doc?.title}>Doc: <span className="font-semibold">{doc?.title}</span></div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiExtractionPreviewTabs
