import React from 'react'

export type ExtractionStep = {
  id: string
  label: string
  done: boolean
}

export type ApiExtractionLoadingProps = {
  progress: number // 0..100
  steps?: ExtractionStep[]
  estSecondsRemaining?: number
}

export const ApiExtractionLoading: React.FC<ApiExtractionLoadingProps> = ({ progress, steps = [], estSecondsRemaining }) => {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-50 blur-xl"
          style={{
            background:
              'radial-gradient(40% 120% at 10% 20%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 40%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 60%, rgba(244,114,182,0.16), transparent 60%)',
          }}
        />

        <h2 className="text-lg font-semibold text-slate-900">Extracting API Documentation…</h2>
        <p className="mt-1 text-sm text-slate-600">We’re processing your sources and building structured endpoints.</p>

        <div className="mt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 via-emerald-400 to-pink-400 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>{progress}%</span>
            {typeof estSecondsRemaining === 'number' && (
              <span>~{Math.max(0, Math.ceil(estSecondsRemaining))}s remaining</span>
            )}
          </div>
        </div>

        {steps.length > 0 && (
          <ul className="mt-6 space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span
                  className={[
                    'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                    s.done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500',
                  ].join(' ')}
                >
                  {s.done ? '✓' : '…'}
                </span>
                <span className={s.done ? 'text-slate-700' : 'text-slate-500'}>{s.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ApiExtractionLoading
