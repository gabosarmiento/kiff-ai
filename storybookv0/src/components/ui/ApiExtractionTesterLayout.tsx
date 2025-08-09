import React from 'react'
import { LeftSidebarNav, type NavItem } from './LeftSidebarNav'
import { ApiExtractorPage } from './ApiExtractorPage'

export type ApiExtractionTesterLayoutProps = {
  initialUrls?: string[]
}

export const ApiExtractionTesterLayout: React.FC<ApiExtractionTesterLayoutProps> = ({ initialUrls = [] }) => {
  const [collapsed, setCollapsed] = React.useState(false)
  const [active, setActive] = React.useState<string>('extractor')

  const items: NavItem[] = [
    {
      id: 'section-extraction',
      label: 'Extraction',
      children: [
        { id: 'extractor', label: 'API Extractor', active: active === 'extractor' },
      ],
    },
    {
      id: 'section-tools',
      label: 'Tools',
      children: [
        { id: 'history', label: 'Runs History', active: active === 'history' },
        { id: 'settings', label: 'Settings', active: active === 'settings' },
      ],
    },
  ]

  const leftWidth = collapsed ? 72 : 280

  return (
    <div className="relative min-h-screen bg-slate-50">
      <LeftSidebarNav
        items={items}
        collapsed={collapsed}
        onToggleCollapsed={setCollapsed}
        onSelect={(id) => setActive(id)}
        logo={<span className="text-sm font-semibold text-slate-900">API Extraction Tester</span>}
      />

      <main
        className="transition-[margin] duration-150 ease-out"
        style={{ marginLeft: leftWidth + 24 /* sidebar  left:4 -> 16px + border radius spacing */, padding: '24px' }}
      >
        <div className="mx-auto max-w-6xl">
          {active === 'extractor' && <ApiExtractorPage initialUrls={initialUrls} />}
          {active === 'history' && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-slate-700">
              <div className="text-lg font-semibold text-slate-900">Runs History</div>
              <div className="mt-2 text-sm">Coming soon</div>
            </div>
          )}
          {active === 'settings' && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-slate-700">
              <div className="text-lg font-semibold text-slate-900">Settings</div>
              <div className="mt-2 text-sm">Coming soon</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ApiExtractionTesterLayout
