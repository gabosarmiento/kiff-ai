import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import NavBar, { NavBarProps, NavLink } from './NavBar'
import { Home, Compass, Search, Bell, User } from 'lucide-react'

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

export const Default: Story = {
  render: (args) => {
    return (
      <div className="h-screen w-full bg-slate-50">
        <NavBar
          logo={<div className="text-sm font-semibold text-slate-900">Kiff</div>}
          items={[]}
          rightActions={(
            <div className="flex items-center gap-2">
              <button className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                <Bell className="h-4 w-4" />
              </button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                <User className="h-4 w-4" />
              </button>
            </div>
          )}
          cta={{ label: 'Say Hello', onClick: () => console.log('CTA clicked') }}
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
          rightActions={(
            <div className="flex items-center gap-2">
              <button className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                <Bell className="h-4 w-4" />
              </button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                <User className="h-4 w-4" />
              </button>
            </div>
          )}
          cta={{ label: 'Say Hello', onClick: () => console.log('CTA clicked') }}
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
