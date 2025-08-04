import React from 'react'
import { FileText, Brain, Settings, Home } from 'lucide-react'

export type MobileNavTab = 'home' | 'templates' | 'knowledge' | 'settings'

interface MobileBottomNavProps {
  activeTab: MobileNavTab
  onTabChange: (tab: MobileNavTab) => void
  knowledgeCount?: number
  className?: string
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  knowledgeCount = 0,
  className = ''
}) => {
  const tabs = [
    {
      id: 'home' as MobileNavTab,
      label: 'Generate',
      icon: Home,
      badge: null
    },
    {
      id: 'templates' as MobileNavTab,
      label: 'Templates',
      icon: FileText,
      badge: null
    },
    {
      id: 'knowledge' as MobileNavTab,
      label: 'Knowledge',
      icon: Brain,
      badge: knowledgeCount > 0 ? knowledgeCount : null
    },
    {
      id: 'settings' as MobileNavTab,
      label: 'Settings',
      icon: Settings,
      badge: null
    }
  ]

  return (
    <div className={`bg-slate-900 border-t border-slate-700/50 ${className}`}>
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors min-w-0 flex-1 ${
                isActive
                  ? 'text-cyan-400 bg-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {tab.badge && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-cyan-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs mt-1 font-medium ${
                isActive ? 'text-cyan-400' : 'text-slate-500'
              }`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MobileBottomNav