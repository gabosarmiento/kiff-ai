import React from 'react'
import { Menu, Search, Bell, User } from 'lucide-react'

interface MobileHeaderProps {
  onMenuToggle: () => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  showNotifications?: boolean
  notificationCount?: number
  userEmail?: string
  className?: string
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  onMenuToggle,
  searchValue = '',
  onSearchChange,
  showNotifications = true,
  notificationCount = 0,
  userEmail = 'demo@kiff.ai',
  className = ''
}) => {
  return (
    <header className={`bg-slate-900 border-b border-slate-700/50 px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMenuToggle}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-100 font-semibold text-sm leading-none">kiff</span>
              <span className="text-slate-400 text-xs leading-none">adaptive.ai</span>
            </div>
          </div>
        </div>

        {/* Right: User Actions */}
        <div className="flex items-center space-x-2">
          {/* Notifications */}
          {showNotifications && (
            <button className="relative w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
              <Bell className="w-4 h-4" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          )}

          {/* User Avatar */}
          <button className="flex items-center space-x-2 px-2 py-1 hover:bg-slate-800 rounded-lg transition-colors">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-300 text-sm hidden sm:block">
              {userEmail.split('@')[0]}
            </span>
          </button>
        </div>
      </div>

      {/* Search Bar (Mobile) */}
      <div className="mt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents, strategies, or symbols..."
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent text-sm"
          />
        </div>
      </div>
    </header>
  )
}

export default MobileHeader