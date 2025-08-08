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
}

export const ApiExtractionPreviewTabs: React.FC<ApiExtractionPreviewTabsProps> = ({ docs, initialDocId, initialView = 'text' }) => {
  const [activeDoc, setActiveDoc] = React.useState<string>(initialDocId || (docs[0]?.id ?? ''))
  const [view, setView] = React.useState<PreviewView>(initialView)

  const doc = React.useMemo(() => docs.find(d => d.id === activeDoc) || docs[0], [docs, activeDoc])

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
    <div className="mx-auto max-w-6xl p-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-50 blur-xl"
          style={{
            background:
              'radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)',
          }}
        />

        {/* Top: document floating pill tabs (scrollable) */}
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {docs.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveDoc(d.id)}
              className={[
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm shadow-sm transition',
                activeDoc === d.id
                  ? 'border-blue-200 bg-blue-50 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              ].join(' ')}
              title={d.title}
            >
              {d.title}
            </button>
          ))}
        </div>

        {/* Secondary pill view switcher */}
        <div className="mb-4 flex items-center gap-2">
          {(['text','markdown','raw'] as PreviewView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-medium transition',
                view === v ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              ].join(' ')}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Full-size document area */}
        <div className="min-h-[60vh] rounded-xl border border-slate-200 bg-white/60 p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default ApiExtractionPreviewTabs
