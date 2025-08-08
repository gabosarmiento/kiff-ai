import React from 'react'

export type ExtractedEndpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  summary?: string
  tags?: string[]
  confidence?: number // 0..1
}

export type ApiExtractionResultsProps = {
  sourceName?: string
  endpoints: ExtractedEndpoint[]
  onBack?: () => void
  onConfirm?: (selected: ExtractedEndpoint[]) => void
}

export const ApiExtractionResults: React.FC<ApiExtractionResultsProps> = ({ sourceName = 'Uploaded Docs', endpoints, onBack, onConfirm }) => {
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const toggle = (key: string) => setSelected((p) => ({ ...p, [key]: !p[key] }))

  const selectedList = React.useMemo(() =>
    endpoints.filter((e) => selected[`${e.method} ${e.path}`]),
    [selected, endpoints]
  )

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-50 blur-xl"
          style={{
            background:
              'radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)',
          }}
        />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Extraction Results</h2>
            <p className="text-sm text-slate-600">Source: {sourceName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50">Back</button>
            <button
              onClick={() => onConfirm?.(selectedList)}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white shadow-sm hover:bg-slate-800"
            >
              Use Selected ({selectedList.length})
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Select</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Method</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Path</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Summary</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Tags</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white/50">
              {endpoints.map((e) => {
                const key = `${e.method} ${e.path}`
                return (
                  <tr key={key} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={!!selected[key]} onChange={() => toggle(key)} />
                    </td>
                    <td className="px-4 py-2">
                      <span className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        e.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                        e.method === 'POST' ? 'bg-emerald-100 text-emerald-700' :
                        e.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                        e.method === 'DELETE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      ].join(' ')}>{e.method}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-sm text-slate-800">{e.path}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">{e.summary || '-'}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {e.tags?.length ? e.tags.join(', ') : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-gradient-to-r from-blue-400 via-emerald-400 to-pink-400" style={{ width: `${Math.round((e.confidence ?? 0) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ApiExtractionResults
