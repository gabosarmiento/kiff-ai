import React from 'react'

export type GeneratedFile = {
  path: string
  language: string
  content: string
}

export type KiffResultConfigPageProps = {
  projectName?: string
  files: GeneratedFile[]
  onRun?: (env: Record<string, string>) => void
  kb?: string | null
  model?: string
  tools?: string[]
  mcps?: string[]
  prompt?: string
}

export const KiffResultConfigPage: React.FC<KiffResultConfigPageProps> = ({ projectName = 'My Kiff App', files, onRun, kb, model, tools = [], mcps = [], prompt }) => {
  const [active, setActive] = React.useState(files[0]?.path || '')
  const [env, setEnv] = React.useState<Record<string, string>>({})

  const file = files.find(f => f.path === active) || files[0]

  const setEnvKey = (k: string, v: string) => setEnv(prev => ({ ...prev, [k]: v }))

  return (
    <div className="h-screen w-full bg-slate-50">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Configure Result</h1>
            <p className="text-sm text-slate-600">Project: {projectName}</p>
            {(kb || model || tools.length || mcps.length || prompt) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {kb && <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">KB: {kb}</span>}
                {model && <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">Model: {model}</span>}
                {tools.length > 0 && <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">Tools: {tools.join(', ')}</span>}
                {mcps.length > 0 && <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">MCPs: {mcps.join(', ')}</span>}
                {prompt && (
                  <span className="group relative rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                    Prompt
                    <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-72 rounded-lg border border-slate-200 bg-white p-2 text-[12px] text-slate-700 shadow-md group-hover:block">
                      {prompt}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => onRun?.(env)}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-sm hover:bg-slate-800"
          >
            Run App
          </button>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Files + preview */}
          <div className="col-span-12 lg:col-span-8">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-lg backdrop-blur">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-50 blur-xl"
                style={{
                  background:
                    'radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)',
                }}
              />

              <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/60 p-2">
                {files.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => setActive(f.path)}
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-medium',
                      active === f.path ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    {f.path}
                  </button>
                ))}
              </div>

              <div className="max-h-[60vh] overflow-auto p-4">
                {file ? (
                  <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100"><code>{file.content}</code></pre>
                ) : (
                  <div className="p-6 text-sm text-slate-500">No files to preview</div>
                )}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="col-span-12 lg:col-span-4">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg backdrop-blur">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-50 blur-xl"
                style={{
                  background:
                    'radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)',
                }}
              />
              <h3 className="text-sm font-semibold text-slate-900">Environment</h3>
              <div className="mt-3 space-y-3">
                {['OPENAI_API_KEY','STRIPE_API_KEY','TENANT_ID'].map((k) => (
                  <div key={k}>
                    <label className="block text-xs text-slate-600">{k}</label>
                    <input
                      type="text"
                      value={env[k] || ''}
                      onChange={(e) => setEnvKey(k, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300"
                      placeholder={`Enter ${k}`}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">Tools</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['GitHub','Browser','Scraper','DB','Tasks'].map((t) => (
                    <span key={t} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KiffResultConfigPage
