import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { 
  Home, 
  Code,
  Database, 
  Library,
  Settings, 
  Cpu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Brain
} from 'lucide-react'
import { useStore } from '../../store/useStore.ts'
import { SubscriptionModal } from '../subscription/SubscriptionModal.tsx'
import { SidebarBalance } from '../billing/SidebarBalance.tsx'
import { TokenConsumptionBalance } from '../billing/TokenConsumptionBalance.tsx'
import { useFeatureFlag } from '../../hooks/useFeatureFlags.ts'
import { useAuth } from '../../contexts/AuthContext.tsx'

export function Sidebar() {
  const location = useLocation()
  const { sidebarOpen, setSidebarOpen } = useStore()
  const { user } = useAuth()
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [currentPlan] = useState<'free' | 'pay_per_token' | 'pro'>('free')
  
  // Get feature flags for different generation pages
  const apiGalleryEnabled = useFeatureFlag('api_gallery_enabled', false)
  const generateV01Enabled = useFeatureFlag('generate_v01_enabled', false)
  const unifiedGenerationEnabled = useFeatureFlag('unified_generation_enabled', false)
  const userSettingsEnabled = useFeatureFlag('user_settings_enabled', false)
  
  // Dynamic navigation based on feature flags
  const navigation = [
    { name: 'Generate V0', href: '/generate-v0', icon: Zap, description: 'Create apps' },
    ...(generateV01Enabled ? [{ name: 'Generate V0.1', href: '/generate-v01', icon: Brain, description: 'Advanced AGNO apps' }] : []),
    ...(unifiedGenerationEnabled ? [{ name: 'Generate', href: '/unified-generation', icon: Home, description: 'Create applications' }] : []),
    ...(apiGalleryEnabled ? [{ name: 'API Gallery', href: '/gallery', icon: Library, description: 'Curated API docs' }] : []),
    { name: 'Knowledge', href: '/knowledge', icon: Database, description: 'Knowledge base' },
    { name: 'Applications', href: '/applications', icon: Code, description: 'Generated apps' },
    ...(userSettingsEnabled ? [{ name: 'Settings', href: '/settings', icon: Settings, description: 'Configuration' }] : []),
  ]

  const handleSubscriptionUpgrade = async (planType: string) => {
    console.log('Upgrading to plan:', planType)
    // Handle subscription upgrade logic here
    setSubscriptionModalOpen(false)
  }

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
      <div 
        className={`fixed inset-y-0 left-0 z-50 bg-slate-900 transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-12 translate-x-0'}
          lg:relative lg:flex lg:flex-shrink-0
          ${!sidebarOpen ? 'lg:translate-x-0' : ''}
        `}
      >
        <div className="flex flex-col h-full w-full">
        {/* Header */}
        <div className={`flex items-center h-16 bg-slate-800 transition-all duration-300 ${
          sidebarOpen ? 'justify-between px-6' : 'justify-center px-2'
        }`}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-slate-600/50">
                  <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">kiff</h1>
                  <p className="text-xs text-slate-400">adaptive.ai</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto min-h-0 transition-all duration-300 ${
          sidebarOpen ? 'px-4' : 'px-2'
        }`}>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center rounded-lg text-sm font-medium transition-colors group relative
                  ${sidebarOpen ? 'px-3 py-2' : 'px-2 py-2 justify-center'}
                  ${isActive
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }
                `}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false)
                }}
                title={!sidebarOpen ? item.name : undefined}
              >
                <item.icon className={`
                  w-5 h-5 flex-shrink-0
                  ${sidebarOpen ? 'mr-3' : ''}
                  ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                `} />
                {sidebarOpen && (
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      {item.description}
                    </div>
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Token Consumption Display */}
        {sidebarOpen && user && (
          <TokenConsumptionBalance 
            tenantId={user.tenant_id || "4485db48-71b7-47b0-8128-c6dca5be352d"} 
            userId={user.id.toString()} 
          />
        )}
        
        {/* Footer */}
        <div className={`border-t border-slate-700/50 transition-all duration-300 ${
          sidebarOpen ? 'p-4' : 'p-2'
        }`}>
          <div className={`flex items-center ${
            sidebarOpen ? 'space-x-3' : 'justify-center'
          }`}>
            <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center border border-slate-600/50">
              <span className="text-sm font-bold text-slate-200 font-mono">U</span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Plan</p>
                <button 
                  onClick={() => setSubscriptionModalOpen(true)}
                  className="text-xs text-slate-300 truncate hover:text-white transition-colors cursor-pointer text-left"
                >
                  Free Plan
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
      
      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onSubscribe={handleSubscriptionUpgrade}
        currentPlan={currentPlan}
      />
    </>
  )
}
