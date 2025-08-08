import React from 'react'

export type KiffComposePanelProps = {
  selectedKB?: string
  availableKBs?: string[]
  availableTools?: string[]
  availableMCPs?: string[]
  models?: string[]
  onSubmit?: (payload: {
    kb: string | null
    prompt: string
    tools: string[]
    mcps: string[]
    model: string
  }) => void
}

export const KiffComposePanel: React.FC<KiffComposePanelProps> = ({
  selectedKB,
  availableKBs = ['Marketing Docs', 'OpenAI API', 'Stripe API'],
  availableTools = ['GitHub', 'Browser', 'Scraper', 'DB'],
  availableMCPs = ['filesystem', 'fetch', 'secrets'],
  models = ['kimi-k2', 'gpt-oss-120b', 'gpt-oss-20b'],
  onSubmit,
}) => {
  const [kb, setKb] = React.useState<string | null>(selectedKB || availableKBs[0] || null)
  const [prompt, setPrompt] = React.useState('Build a landing page with a pricing section and contact form')
  const [tools, setTools] = React.useState<string[]>(['GitHub'])
  const [mcps, setMcps] = React.useState<string[]>([])
  const [model, setModel] = React.useState<string>(models[0] || 'kimi-k2')
  const [ragOpen, setRagOpen] = React.useState<boolean>(true)
  const [hoverDoc, setHoverDoc] = React.useState<string | null>(null)

  const toggle = (arr: string[], setArr: (s: string[]) => void, v: string) => {
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Local styles for animated border */}
      <style>
        {`
        @keyframes kiff-dash { 
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -600; }
        }
        .kiff-rag-stroke {
          stroke-linecap: round;
          stroke-linejoin: round;
          animation: kiff-dash 1.4s linear infinite;
          stroke-dasharray: 40 560;
          stroke-dashoffset: 0;
        }
        .kiff-rag-stroke--trail { opacity: .45; filter: url(#kiffGlow); stroke-width: 3; }
        .kiff-rag-stroke--main { opacity: 1; stroke-width: 2; }
        .kiff-rag-capsule { position: relative; z-index: 0; }
        @media (prefers-reduced-motion: reduce) {
          .kiff-rag-stroke { animation: none; }
        }
        `}
      </style>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-50 blur-xl"
          style={{
            background:
              'radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)',
          }}
        />

        <h2 className="text-lg font-semibold text-slate-900">Compose your Kiff</h2>
        <p className="mt-1 text-sm text-slate-600">Pick knowledge, model, and tools. Then provide your instruction.</p>

        <div className="mt-4">
          <label className="block text-xs text-slate-600">Knowledge Base</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {availableKBs.map((name) => (
              <button
                key={name}
                onClick={() => setKb(name)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs',
                  kb === name ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                {name}
              </button>
            ))}
            <button className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600">+ New</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-600">Tools</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {availableTools.map((t) => (
                <button
                  key={t}
                  onClick={() => toggle(tools, setTools, t)}
                  className={[
                    'rounded-full px-3 py-1.5 text-xs',
                    tools.includes(t) ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600">MCPs</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {availableMCPs.map((t) => (
                <button
                  key={t}
                  onClick={() => toggle(mcps, setMcps, t)}
                  className={[
                    'rounded-full px-3 py-1.5 text-xs',
                    mcps.includes(t) ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-slate-600">Prompt</label>
          <div className="mt-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {/* RAG Capsule attached to input */}
            <div className="kiff-rag-capsule relative mb-3 overflow-hidden rounded-xl border border-transparent bg-amber-50/70 px-3 py-2 text-[13px] text-amber-900">
              {/* Animated SVG stroke around border */}
              <svg aria-hidden className="pointer-events-none absolute inset-0 z-10" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <filter id="kiffGlow" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur stdDeviation="1.2" result="blur" />
                  </filter>
                </defs>
                {/* Soft glow trail */}
                <rect x="1.25" y="1.25" width="97.5" height="97.5" rx="12" ry="12" pathLength="600"
                  fill="none"
                  stroke="#38bdf8"
                  className="kiff-rag-stroke kiff-rag-stroke--trail"
                  strokeDasharray="40 560"
                  strokeDashoffset="0"
                  filter="url(#kiffGlow)"
                />
                {/* Main moving segment */}
                <rect x="1.25" y="1.25" width="97.5" height="97.5" rx="12" ry="12" pathLength="600"
                  fill="none"
                  stroke="#38bdf8"
                  className="kiff-rag-stroke kiff-rag-stroke--main"
                  strokeDasharray="40 560"
                  strokeDashoffset="0"
                />
              </svg>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-900">R</span>
                  <span className="font-medium">Supercharged by Knowledge</span>
                  <span className="text-amber-800/80">{kb ? kb : 'No KB selected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-full border border-amber-200 bg-white px-2 py-1 text-xs text-amber-900"
                    value={kb ?? ''}
                    onChange={(e) => setKb(e.target.value)}
                  >
                    <option value="" disabled>Select KB…</option>
                    {availableKBs.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  <button onClick={() => setRagOpen(v => !v)} className="rounded-full px-2 py-1 text-xs text-amber-900 hover:bg-amber-100">
                    {ragOpen ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              {ragOpen && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-amber-800/90">Context:</span>
                  {['docs/overview.md','api/usage.md','pricing/tiers.md'].map(tag => (
                    <span
                      key={tag}
                      onMouseEnter={() => setHoverDoc(tag)}
                      onMouseLeave={() => setHoverDoc(null)}
                      className="relative cursor-default rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[12px] text-amber-900"
                    >
                      {tag}
                      {hoverDoc === tag && (
                        <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg border border-amber-200 bg-white p-2 text-[12px] text-amber-900 shadow-md">
                          <div className="font-medium">Preview</div>
                          <div className="mt-1 text-amber-800/90">"This KB covers setup and key API patterns. Use endpoints X, Y when building the pricing page."</div>
                        </div>
                      )}
                    </span>
                  ))}
                  <span className="ml-auto text-[12px] text-amber-800/80">RAG expands your prompt with relevant knowledge.</span>
                </div>
              )}
            </div>
            <textarea
              className="h-28 w-full resize-none rounded-lg border border-slate-100 bg-white/80 p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what to build…"
            />
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">/attach</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">/plan</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">/refactor</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Model selector on the right like Claude */}
                <select
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={() => onSubmit?.({ kb, prompt, tools, mcps, model })}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-sm hover:bg-slate-800"
                >
                  Send
                  <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KiffComposePanel
