import React from 'react'

export type NavLink = {
  id: string
  label: string
  href?: string
  icon?: React.ReactNode
  active?: boolean
}

export type NavBarProps = {
  logo?: React.ReactNode
  items?: NavLink[]
  onSelect?: (id: string) => void
  rightActions?: React.ReactNode
  sticky?: boolean
  mode?: 'links' | 'minimal' | 'icons'
  cta?: {
    label: string
    onClick?: () => void
  }
}

// Floating pill navbar with variants
export const NavBar: React.FC<NavBarProps> = ({ logo, items = [], onSelect, rightActions, sticky, mode = 'links', cta }) => {
  // Gradient outline button for CTA
  const CtaButton = cta ? (
    <button
      onClick={cta.onClick}
      className="relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium text-slate-900"
      style={{
        background: 'linear-gradient(#fff,#fff) padding-box, linear-gradient(90deg,#60a5fa,#22c55e,#f472b6) border-box',
        border: '1px solid transparent'
      }}
    >
      {cta.label}
    </button>
  ) : null;

  return (
    <header className={[sticky ? 'fixed top-4 left-1/2 z-40 -translate-x-1/2' : 'fixed top-4 left-1/2 -translate-x-1/2 z-40', 'mx-auto'].join(' ')}>
      <div className="relative flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-lg backdrop-blur">
        {/* subtle glow */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl opacity-60 blur-lg"
          style={{
            background: 'radial-gradient(40% 120% at 10% 50%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(40% 120% at 60% 50%, rgba(34,197,94,0.16), transparent 60%), radial-gradient(40% 120% at 100% 50%, rgba(244,114,182,0.16), transparent 60%)'
          }}
        />

        {/* Left / Logo */}
        <div className="pl-1 pr-2">
          {logo ?? <div className="text-sm font-semibold text-slate-900">Kiff</div>}
        </div>

        {/* Center content by mode */}
        {mode === 'links' && (
          <nav className="hidden md:block">
            <ul className="flex items-center gap-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={[
                      'group relative rounded-full px-3 py-1.5 text-sm text-slate-700 transition',
                      item.active ? 'text-slate-900' : 'hover:text-slate-900'
                    ].join(' ')}
                    onClick={() => onSelect?.(item.id)}
                  >
                    <span className="inline-flex items-center gap-2">
                      {item.icon && <span className="h-4 w-4 text-slate-500 group-hover:text-slate-700">{item.icon}</span>}
                      {item.label}
                    </span>
                    <span className="pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 overflow-hidden rounded-full">
                      <span className={[
                        'block h-full w-full scale-x-0 transform rounded-full transition-transform duration-300 ease-out',
                        item.active ? 'scale-x-100' : 'group-hover:scale-x-100'
                      ].join(' ')}
                      style={{ background: 'linear-gradient(90deg, #60a5fa 0%, #22c55e 50%, #f472b6 100%)' }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {mode === 'icons' && (
          <nav className="hidden md:block">
            <ul className="flex items-center gap-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={[
                      'inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition',
                      item.active ? 'ring-1 ring-blue-500/30' : 'hover:bg-slate-50'
                    ].join(' ')}
                    onClick={() => onSelect?.(item.id)}
                    title={item.label}
                  >
                    {item.icon}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Right actions & CTA */}
        <div className="ml-auto flex items-center gap-2">
          {cta && CtaButton}
          {rightActions}
        </div>
      </div>
    </header>
  )
}

export default NavBar
