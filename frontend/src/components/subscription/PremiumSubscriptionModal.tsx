import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  Star, 
  CheckCircle, 
  ArrowRight,
  Clock,
  Users,
  Shield,
  X,
  CreditCard,
  Gift,
  TrendingUp,
  Sparkles
} from 'lucide-react'

interface PremiumSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubscribe: (planType: 'early_access' | 'regular') => void
  currentBalance: number
  isLoading?: boolean
}

interface SubscriptionPlan {
  id: 'early_access' | 'regular'
  name: string
  description: string
  originalPrice: string
  currentPrice: string
  discount?: string
  urgency?: string
  features: string[]
  performanceFeatures: string[]
  popular?: boolean
  limited?: boolean
}

export const PremiumSubscriptionModal: React.FC<PremiumSubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  currentBalance,
  isLoading = false
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'early_access' | 'regular'>('early_access')
  const [timeRemaining, setTimeRemaining] = useState(72 * 3600) // 72 hours in seconds

  // Countdown timer for urgency
  useEffect(() => {
    if (!isOpen) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const plans: SubscriptionPlan[] = [
    {
      id: 'early_access',
      name: 'Premium Early Access',
      description: 'Limited time early access pricing with all premium features',
      originalPrice: '$99.00',
      currentPrice: '$15.00',
      discount: '85% OFF',
      urgency: `${formatTime(timeRemaining)} left`,
      features: [
        '5x faster processing speed',
        'Unlimited parallel operations',
        'Skip all processing queues',
        'Priority resource allocation',
        'Advanced algorithm optimization',
        'Dedicated processing resources',
        'Premium customer support',
        'Early access to new features'
      ],
      performanceFeatures: [
        'Process multiple APIs simultaneously',
        'Instant queue bypass for all operations',
        'Maximum system resource allocation',
        'Advanced caching optimization',
        'Real-time performance analytics'
      ],
      popular: true,
      limited: true
    },
    {
      id: 'regular',
      name: 'Premium Access',
      description: 'Full premium features at regular pricing',
      originalPrice: '$99.00',
      currentPrice: '$99.00',
      features: [
        '5x faster processing speed',
        'Unlimited parallel operations',
        'Skip all processing queues',
        'Priority resource allocation',
        'Advanced algorithm optimization',
        'Premium customer support'
      ],
      performanceFeatures: [
        'Process multiple APIs simultaneously',
        'Queue bypass for all operations',
        'High system resource allocation',
        'Standard caching optimization'
      ]
    }
  ]

  if (!isOpen) return null

  const selectedPlanData = plans.find(p => p.id === selectedPlan)!

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-yellow-600/20 to-orange-600/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">
                  Upgrade to Premium Access
                </h3>
                <p className="text-sm text-slate-300">
                  Unlock maximum performance and unlimited operations
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Limited Time Banner */}
        {selectedPlan === 'early_access' && (
          <div className="px-6 py-3 bg-red-600/20 border-b border-red-600/30">
            <div className="flex items-center justify-center space-x-2 text-center">
              <Clock className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-red-300 font-medium">
                ⚡ Early Access Special Ends In: {formatTime(timeRemaining)}
              </span>
              <Clock className="w-4 h-4 text-red-400 animate-pulse" />
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Plan Selection */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative border rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                  selectedPlan === plan.id
                    ? 'border-yellow-500 bg-yellow-500/10 shadow-lg'
                    : 'border-slate-600 hover:border-slate-500'
                } ${
                  plan.limited ? 'ring-2 ring-yellow-500/30' : ''
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs px-3 py-1 rounded-full font-bold flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>MOST POPULAR</span>
                    </div>
                  </div>
                )}

                {/* Limited Badge */}
                {plan.limited && (
                  <div className="absolute -top-2 -right-2">
                    <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                      LIMITED
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <h4 className="text-lg font-bold text-slate-100 mb-2">{plan.name}</h4>
                  <p className="text-sm text-slate-400 mb-4">{plan.description}</p>
                  
                  <div className="mb-4">
                    {plan.discount && (
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <span className="text-lg text-slate-500 line-through">{plan.originalPrice}</span>
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          {plan.discount}
                        </span>
                      </div>
                    )}
                    <div className="text-3xl font-black text-slate-100">
                      {plan.currentPrice}
                      <span className="text-sm text-slate-400 font-normal">/month</span>
                    </div>
                    {plan.urgency && (
                      <div className="text-xs text-red-400 mt-1 font-medium">
                        {plan.urgency}
                      </div>
                    )}
                  </div>

                  {/* Radio Button */}
                  <div className="flex justify-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === plan.id
                        ? 'border-yellow-500 bg-yellow-500'
                        : 'border-slate-500'
                    }`}>
                      {selectedPlan === plan.id && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected Plan Features */}
          <div className="bg-slate-700/30 rounded-lg p-6 mb-6">
            <h4 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-yellow-400" />
              {selectedPlanData.name} Features
            </h4>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium text-slate-300 mb-3">✨ Premium Features</h5>
                <div className="space-y-2">
                  {selectedPlanData.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h5 className="font-medium text-slate-300 mb-3">⚡ Performance Benefits</h5>
                <div className="space-y-2">
                  {selectedPlanData.performanceFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Comparison */}
          <div className="bg-slate-700/20 rounded-lg p-4 mb-6">
            <h5 className="font-medium text-slate-300 mb-3 text-center">🚀 Performance Comparison</h5>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-slate-400 mb-1">Standard</div>
                <div className="text-slate-500">Queue-based • 1x speed</div>
                <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                  <div className="bg-slate-500 h-2 rounded-full w-1/5"></div>
                </div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Priority</div>
                <div className="text-orange-400">Skip queue • 3x speed</div>
                <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                  <div className="bg-orange-500 h-2 rounded-full w-3/5"></div>
                </div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Premium</div>
                <div className="text-yellow-400">Unlimited • 5x speed</div>
                <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                  <div className="bg-yellow-500 h-2 rounded-full w-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-sm font-medium text-blue-300">
                  Join 1,247+ developers using Premium Access
                </div>
                <div className="text-xs text-blue-400">
                  Average 5x productivity increase • 99.9% uptime
                </div>
              </div>
            </div>
          </div>

          {/* Security & Guarantees */}
          <div className="flex items-center justify-center space-x-6 text-xs text-slate-500 mb-6">
            <div className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>Secure billing</span>
            </div>
            <div className="flex items-center space-x-1">
              <Gift className="w-3 h-3" />
              <span>30-day money back</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-700/30 rounded-b-xl flex justify-between items-center">
          <div className="text-sm text-slate-400">
            Current balance: <span className="text-green-400 font-medium">${currentBalance.toFixed(2)}</span>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-slate-400 hover:text-slate-300 disabled:opacity-50"
            >
              Maybe Later
            </button>
            
            <button
              onClick={() => onSubscribe(selectedPlan)}
              disabled={isLoading}
              className={`px-8 py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
                selectedPlan === 'early_access'
                  ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 shadow-lg transform hover:scale-105'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <CreditCard className="w-4 h-4" />
              <span>
                {isLoading ? 'Processing...' : `Subscribe for ${selectedPlanData.currentPrice}/month`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}