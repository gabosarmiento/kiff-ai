import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { LeftSidebarNav, NavItem } from './LeftSidebarNav'
import { Home, Folder, Archive, LayoutTemplate, BookOpen, Puzzle, Image, Coins, Settings } from 'lucide-react'

const meta: Meta<typeof LeftSidebarNav> = {
  title: 'Navigation/LeftSidebarNav',
  component: LeftSidebarNav,
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    collapsed: { control: 'boolean' }
  }
}

export default meta

type Story = StoryObj<typeof LeftSidebarNav>

const sampleItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: <Home className="h-4 w-4" />, active: true },
  {
    id: 'projects',
    label: 'Projects',
    children: [
      { id: 'active', label: 'Active', icon: <Folder className="h-4 w-4" /> },
      { id: 'archived', label: 'Archived', icon: <Archive className="h-4 w-4" /> },
      { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> }
    ]
  },
  {
    id: 'library',
    label: 'Library',
    children: [
      { id: 'components', label: 'Components', icon: <Puzzle className="h-4 w-4" /> },
      { id: 'assets', label: 'Assets', icon: <Image className="h-4 w-4" /> },
      { id: 'tokens', label: 'Design Tokens', icon: <Coins className="h-4 w-4" /> }
    ]
  },
  { id: 'docs', label: 'Docs', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
]

export const Default: Story = {
  render: (args) => {
    const [active, setActive] = React.useState<string>('home')
    const [collapsed, setCollapsed] = React.useState<boolean>(!!args.collapsed)

    const items = sampleItems.map((s) =>
      s.children
        ? { ...s, children: s.children.map((c) => ({ ...c, active: c.id === active })) }
        : { ...s, active: s.id === active }
    )

    return (
      <div className="h-screen w-full bg-slate-50">
        <div className="flex h-full">
          <LeftSidebarNav
            items={items}
            logo={<div className="text-sm font-semibold text-slate-900">Kiff</div>}
            onSelect={(id) => setActive(id)}
            collapsed={collapsed}
            onToggleCollapsed={setCollapsed}
          />
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-3xl">
              <h1 className="text-lg font-semibold text-slate-900">Content Area</h1>
              <p className="mt-2 text-sm text-slate-600">
                Use the controls to toggle the collapsed state. Click items to set active.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }
}
