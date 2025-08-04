import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  Code,
  Database, 
  Library,
  Settings, 
  Cpu,
  X
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Generate', href: '/', icon: Home, description: 'Create applications' },
  { name: 'API Gallery', href: '/gallery', icon: Library, description: 'Curated API docs' },
  { name: 'Knowledge', href: '/knowledge', icon: Database, description: 'Knowledge base' },
  { name: 'Applications', href: '/applications', icon: Code, description: 'Generated apps' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'Configuration' },
]

export function Sidebar() {
  const location = useLocation()
  const { sidebarOpen, setSidebarOpen } = useStore()

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "bg-slate-800/95 backdrop-blur-xl border-r border-slate-700/50 transition-all duration-300 ease-in-out",
        // Mobile: fixed positioning, overlay behavior
        "fixed left-0 top-0 h-full z-50",
        sidebarOpen ? "w-64" : "-translate-x-full",
        // Desktop: relative positioning, always visible
        "lg:relative lg:translate-x-0 lg:z-auto",
        sidebarOpen ? "lg:w-64" : "lg:w-16"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-slate-600/50">
              <Cpu className="w-6 h-6 text-cyan-400" />
            </div>
            {sidebarOpen && (
              <div>
                <span className="text-xl font-bold text-slate-100 font-mono tracking-wider">kiff</span>
                <p className="text-xs text-slate-400 font-mono">adaptive.ai</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all duration-200 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 sm:px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 touch-manipulation",
                  isActive
                    ? "bg-slate-700/50 text-slate-100 border border-slate-600/50"
                    : "text-slate-300 hover:bg-slate-700/30 hover:text-slate-100 hover:border-slate-600/30 border border-transparent"
                )}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false)
                }}
              >
                <item.icon
                  className={cn(
                    "flex-shrink-0 w-5 h-5 transition-all duration-200",
                    sidebarOpen ? "mr-3" : "mx-auto lg:mr-3",
                    isActive ? "text-slate-100" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                <div className={cn(
                  "flex-1 min-w-0 transition-all duration-200",
                  sidebarOpen ? "block" : "hidden lg:block"
                )}>
                  <span className="truncate font-mono tracking-wide">{item.name}</span>
                  {sidebarOpen && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-700/50">
          {(sidebarOpen || window.innerWidth >= 1024) && (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center border border-slate-600/50">
                <span className="text-sm font-bold text-slate-200 font-mono">U</span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate font-mono">Plan</p>
                  <p className="text-xs text-slate-400 truncate">Free Plan</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
