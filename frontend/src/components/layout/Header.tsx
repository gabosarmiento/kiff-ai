import { Bell, User, Menu, LogOut, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { UpgradeButton } from '../subscription/UpgradeButton'
import { SubscriptionModal } from '../subscription/SubscriptionModal'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'
import toast from 'react-hot-toast'

export function Header() {
  const { sidebarOpen, setSidebarOpen } = useStore()
  const { user, logout } = useAuth()
  const userSettingsEnabled = useFeatureFlag('user_settings_enabled', false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pay_per_token' | 'pro'>('free')
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  // Handle subscription upgrade
  const handleSubscriptionUpgrade = async (planType: string) => {
    setSubscriptionLoading(true)
    
    try {
      if (planType === 'pro') {
        // Create Stripe checkout session for Pro plan
        const response = await fetch('http://localhost:8000/api/stripe-subscription/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_type: 'pro_monthly',
            success_url: `${window.location.origin}/subscription/success`,
            cancel_url: `${window.location.origin}/subscription/cancel`,
            email: user?.email
          })
        })
        
        if (response.ok) {
          const { checkout_url } = await response.json()
          window.location.href = checkout_url // Redirect to Stripe Checkout
        } else {
          throw new Error('Failed to create checkout session')
        }
      } else if (planType === 'pay_per_token') {
        // Create Stripe setup session for pay-per-token (requires payment method for charging)
        const response = await fetch('http://localhost:8000/api/stripe-subscription/setup-payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_type: 'pay_per_token',
            success_url: `${window.location.origin}/subscription/success?plan=pay_per_token`,
            cancel_url: `${window.location.origin}/subscription/cancel`,
            email: user?.email
          })
        })
        
        if (response.ok) {
          const { setup_url } = await response.json()
          window.location.href = setup_url // Redirect to Stripe payment method setup
        } else {
          throw new Error('Failed to create payment method setup session')
        }
      } else if (planType === 'free') {
        // Downgrade to free
        setCurrentPlan('free')
        setSubscriptionModalOpen(false)
        toast.success('Plan changed to Free tier')
      }
    } catch (error) {
      console.error('Subscription upgrade failed:', error)
      toast.error('Failed to update subscription. Please try again.')
    } finally {
      setSubscriptionLoading(false)
    }
  }

  return (
    <header className="bg-slate-800/95 backdrop-blur-xl shadow-sm border-b border-slate-700/50 px-4 sm:px-6 h-16 relative z-40 flex items-center">
      <div className="flex items-center justify-between w-full">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all duration-200 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Spacer to push actions to the right */}
        <div className="flex-1"></div>

        {/* Actions */}
        <div className="flex items-center space-x-4">
          {/* Upgrade Button */}
          <UpgradeButton
            currentPlan={currentPlan}
            onClick={() => setSubscriptionModalOpen(true)}
            compact
          />



          {/* Notifications */}
          <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg relative transition-all duration-200">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="relative z-50" ref={userMenuRef}>
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-slate-200">{user?.full_name || user?.username}</div>
                <div className="text-xs text-slate-400">{user?.email}</div>
              </div>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200 relative"
              >
                <User className="w-5 h-5" />
              </button>
            </div>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full w-64 bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl z-[99999] mt-2 overflow-visible">
                <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-800 border-l border-t border-slate-700/50 transform rotate-45"></div>
                <div className="p-4 border-b border-slate-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{user?.full_name || user?.username}</div>
                      <div className="text-xs text-slate-400">{user?.email}</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-2">
                  <button 
                    onClick={() => {
                      setShowUserMenu(false)
                      // Check if user is admin and handle accordingly
                      if (user?.role === 'admin' || user?.role === 'superadmin') {
                        navigate('/admin/settings')
                      } else {
                        navigate('/account')
                      }
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
                  >
                    <User className="w-4 h-4" />
                    <span>My Account</span>
                  </button>
                  
                  {userSettingsEnabled && (
                    <button 
                      onClick={() => {
                        setShowUserMenu(false)
                        // Check if user is admin and handle accordingly
                        if (user?.role === 'admin' || user?.role === 'superadmin') {
                          navigate('/admin/settings')
                        } else {
                          navigate('/settings')
                        }
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                  )}


                  <button 
                    onClick={() => {
                      setShowUserMenu(false)
                      logout()
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onSubscribe={handleSubscriptionUpgrade}
        currentPlan={currentPlan}
        isLoading={subscriptionLoading}
      />
    </header>
  )
}
