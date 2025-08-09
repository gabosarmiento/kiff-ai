import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import NavBar, { NavBarProps, NavLink } from './NavBar'
import { Home, Compass, Search, User } from 'lucide-react'

const meta: Meta<typeof NavBar> = {
  title: 'Navigation/NavBar',
  component: NavBar,
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta

type Story = StoryObj<typeof NavBar>

const links: NavLink[] = [
  { id: 'home', label: 'Home', icon: <Home className="h-4 w-4" />, active: true },
  { id: 'explore', label: 'Explore', icon: <Compass className="h-4 w-4" /> },
  { id: 'search', label: 'Search', icon: <Search className="h-4 w-4" /> },
]

// Inline profile menu that expands horizontally like iOS navbar
const ProfileInlineMenu: React.FC<{ onAccount?: () => void; onLogout?: () => void }> = ({ onAccount, onLogout }) => {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      const el = ref.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer as any)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="relative flex items-center" ref={ref} onBlur={(e) => {
      const el = ref.current
      const next = e.relatedTarget as Node | null
      if (el && (!next || !el.contains(next))) setOpen(false)
    }}>
      <div className="relative">
        {/* The expanding pill sits to the LEFT of the icon, absolutely positioned so the icon never moves */}
        <div
          className={[
            'absolute right-full mr-2 top-0 flex h-8 items-center overflow-hidden rounded-full border border-slate-200 bg-white pl-2 pr-2 text-sm text-slate-700 shadow-sm transition-[width,opacity] duration-200',
            open ? 'w-[220px] opacity-100' : 'w-0 opacity-0'
          ].join(' ')}
          style={{ willChange: 'width, opacity' }}
        >
          <button
            onClick={onAccount}
            className="inline-flex items-center rounded-full px-2 py-1 hover:bg-slate-50"
          >
            Account
          </button>
          <span className="mx-2 h-4 w-px bg-slate-200" />
          <button
            onClick={onLogout}
            className="inline-flex items-center rounded-full px-2 py-1 hover:bg-slate-50 text-rose-600"
          >
            Logout
          </button>
        </div>

        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={() => setOpen((v) => !v)}
          aria-label="Profile"
        >
          <User className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export const Default: Story = {
  render: (args) => {
    return (
      <div className="h-screen w-full bg-slate-50">
        <NavBar
          logo={<div className="text-sm font-semibold text-slate-900">Kiff</div>}
          items={[]}
          rightActions={<ProfileInlineMenu onAccount={() => console.log('Account')} onLogout={() => console.log('Logout')} />}
          cta={undefined}
          sticky
          mode="minimal"
          {...args as NavBarProps}
        />
        <main className="p-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-lg font-semibold text-slate-900">Minimal bar</h1>
            <p className="mt-2 text-sm text-slate-600">No left buttons; includes gradient-outline CTA on the right.</p>
          </div>
        </main>
      </div>
    )
  }
}

export const Icons: Story = {
  render: (args) => {
    const items: NavLink[] = [
      { id: 'home', label: 'Home', icon: <Home className="h-4 w-4" />, active: true },
      { id: 'explore', label: 'Explore', icon: <Compass className="h-4 w-4" /> },
      { id: 'search', label: 'Search', icon: <Search className="h-4 w-4" /> },
    ]
    return (
      <div className="h-screen w-full bg-slate-50">
        <NavBar
          logo={<div className="text-sm font-semibold text-slate-900">Kiff</div>}
          items={items}
          rightActions={<ProfileInlineMenu onAccount={() => console.log('Account')} onLogout={() => console.log('Logout')} />}
          cta={undefined}
          sticky
          mode="icons"
          {...args as NavBarProps}
        />
        <main className="p-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-lg font-semibold text-slate-900">Icons bar</h1>
            <p className="mt-2 text-sm text-slate-600">Rounded icon buttons in the center and gradient-outline CTA on the right.</p>
          </div>
        </main>
      </div>
    )
  }
}
