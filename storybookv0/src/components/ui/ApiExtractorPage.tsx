import React from 'react'

export type ApiExtractorPageProps = {
  initialUrls?: string[]
  onExtract?: (urls: string[]) => void
}

const normalizeUrls = (raw: string): string[] => {
  const pieces = raw
    .split(/\r?\n|,|\s+/)
    .map(s => s.trim())
    .filter(Boolean)
  // naive URL normalization; allow http(s) only in this mock UI
  return pieces.filter(p => /^(https?:\/\/)/i.test(p))
}

const mockExtractEndpoints = (urls: string[]) => {
  // Very light mock: produce pseudo endpoints from paths
  const results = urls.map(u => {
    try {
      const { pathname, host } = new URL(u)
      const parts = pathname.split('/').filter(Boolean)
      const base = parts[0] || 'root'
      return {
        url: u,
        host,
        discovered: [
          { method: 'GET', path: `/${base}` },
          { method: 'POST', path: `/${base}` },
          { method: 'GET', path: `/${base}/{id}` },
        ],
      }
    } catch {
      return { url: u, host: 'invalid', discovered: [] as {method: string; path: string}[] }
    }
  })
  return results
}

export const ApiExtractorPage: React.FC<ApiExtractorPageProps> = ({ initialUrls = [], onExtract }) => {
  const [input, setInput] = React.useState<string>(initialUrls.join('\n'))
  const [urls, setUrls] = React.useState<string[]>(initialUrls)
  const [errors, setErrors] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [results, setResults] = React.useState<ReturnType<typeof mockExtractEndpoints> | null>(null)

  const handleParse = React.useCallback((raw: string) => {
    const parsed = normalizeUrls(raw)
    const hasInvalid = raw.trim().length > 0 && parsed.length === 0
    setErrors(hasInvalid ? 'Enter valid http(s) URLs. Separate by newline or comma.' : null)
    setUrls(parsed)
  }, [])

  const handleExtract = async () => {
    setRunning(true)
    setResults(null)
    try {
      onExtract?.(urls)
      // simulate async work
      await new Promise(res => setTimeout(res, 400))
      setResults(mockExtractEndpoints(urls))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-40 blur-xl"
          style={{
            background:
              'radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)',
          }}
        />

        <h2 className="text-lg font-semibold text-slate-900">API Extractor</h2>
        <p className="mt-1 text-sm text-slate-600">Paste one or more URLs (newline or comma separated). We will infer a basic API shape.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-600">URLs</label>
            <textarea
              className="mt-1 h-40 w-full resize-y rounded-lg border border-slate-200 bg-white/80 p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="https://api.example.com/v1/users\nhttps://docs.example.com/reference#list-users"
              value={input}
              onChange={(e) => { setInput(e.target.value); handleParse(e.target.value) }}
            />
            {errors && <div className="mt-2 text-xs text-rose-600">{errors}</div>}

            <div className="mt-3 flex items-center gap-2">
              <button
                disabled={running || urls.length === 0}
                onClick={handleExtract}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {running ? 'Extracting…' : 'Extract API'}
              </button>
              <span className="text-xs text-slate-500">{urls.length} URL{urls.length === 1 ? '' : 's'} detected</span>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="font-medium text-slate-900">Tips</div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Supports http(s) only in this demo</li>
                <li>Separate multiple URLs by newline or comma</li>
                <li>We mock endpoint discovery for preview</li>
              </ul>
            </div>
          </div>
        </div>

        {results && (
          <div className="mt-6">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="text-sm font-medium text-slate-900">Discovered Endpoints</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {results.map((r) => (
                  <div key={r.url} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-[12px] text-slate-500">{r.host}</div>
                    <div className="truncate text-sm font-medium text-slate-900" title={r.url}>{r.url}</div>
                    <div className="mt-2 space-y-1 text-sm">
                      {r.discovered.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="inline-flex w-12 justify-center rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-white">{d.method}</span>
                          <code className="rounded-md bg-slate-50 px-2 py-0.5 text-slate-800">{d.path}</code>
                        </div>
                      ))}
                      {r.discovered.length === 0 && (
                        <div className="text-xs text-slate-500">No endpoints inferred</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ApiExtractorPage
