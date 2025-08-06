import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Users,
  Shield,
  DollarSign,
  X,
  ArrowRight
} from 'lucide-react'

interface SpeedTierModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade: (upgradeType: 'priority' | 'subscription') => void
  currentWaitTime: string
  operationType: string
  baseCost: number
  userBalance: number
  isLoading?: boolean
}

interface TierOption {
  id: 'standard' | 'priority' | 'premium'
  name: string
  speed: string
  description: string
  cost: string
  features: string[]
  processingTime: string
  icon: React.ReactNode
  popular?: boolean
  savings?: string
  urgency?: string
}

export const SpeedTierModal: React.FC<SpeedTierModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  currentWaitTime,
  operationType,
  baseCost,
  userBalance,
  isLoading = false
}) => {
  const [selectedTier, setSelectedTier] = useState<'standard' | 'priority' | 'premium'>('standard')
  const [showComparison, setShowComparison] = useState(false)

  const priorityCost = baseCost * 3
  const hasInsufficientFunds = userBalance < priorityCost

  const tiers: TierOption[] = [
    {
      id: 'standard',
      name: 'Standard Processing',
      speed: '1x',
      description: 'Queue-based processing with standard resource allocation',
      cost: 'Free',
      processingTime: currentWaitTime,
      features: [
        'Standard processing speed',
        'Queue-based resource allocation',
        'Single operation processing',
        'Standard system priority'
      ],
      icon: <Clock className="w-5 h-5 text-slate-400" />
    },
    {
      id: 'priority',
      name: 'Priority Processing',
      speed: '3x',
      description: 'Skip the queue and process immediately with enhanced resources',
      cost: `$${priorityCost.toFixed(2)}`,
      processingTime: '~30 seconds',
      features: [
        '3x faster processing',
        'Skip processing queue',
        'Immediate processing start',
        'Enhanced resource allocation'
      ],
      icon: <TrendingUp className="w-5 h-5 text-orange-400" />,
      urgency: 'Process now'
    },
    {
      id: 'premium',
      name: 'Premium Access',
      speed: '5x',
      description: 'Unlimited operations with maximum performance optimization',
      cost: '$15/month',
      processingTime: '~15 seconds',
      features: [
        '5x faster processing',
        'Unlimited parallel operations',
        'Dedicated processing resources',
        'Advanced algorithm optimization',
        'Priority queue access'
      ],
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      popular: true,
      savings: '85% off ($99 → $15)',
      urgency: 'Limited time offer'
    }
  ]

  useEffect(() => {
    if (isOpen) {
      setSelectedTier('standard')
      setShowComparison(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const selectedTierData = tiers.find(t => t.id === selectedTier)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-100">
              Optimize Processing Speed
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Choose your processing experience for {operationType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current System Status */}
        <div className="px-6 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-300">
              System is optimizing resources for your session. Current wait time: {currentWaitTime}
            </span>
          </div>
        </div>

        {/* Tier Selection */}
        <div className="px-6 py-4 space-y-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                selectedTier === tier.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-600 hover:border-slate-500'
              } ${
                tier.id === 'priority' && hasInsufficientFunds
                  ? 'opacity-60 cursor-not-allowed'
                  : ''
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-2 left-4 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-medium">
                  Most Popular
                </div>
              )}

              {/* Urgency Badge */}
              {tier.urgency && (
                <div className="absolute -top-2 right-4 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                  {tier.urgency}
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{tier.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-slate-100">{tier.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tier.id === 'standard' ? 'bg-slate-700 text-slate-300' :
                        tier.id === 'priority' ? 'bg-orange-500/20 text-orange-300' :
                        'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {tier.speed} Speed
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{tier.description}</p>
                    
                    {/* Features */}
                    <div className="mt-2 space-y-1">
                      {tier.features.slice(0, 2).map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2 text-xs text-slate-400">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Savings */}
                    {tier.savings && (
                      <div className="mt-2 text-xs text-green-400 font-medium">
                        💰 {tier.savings}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-slate-100">{tier.cost}</div>
                  <div className="text-xs text-slate-400">Processing: {tier.processingTime}</div>
                  {tier.id === 'priority' && hasInsufficientFunds && (
                    <div className="text-xs text-red-400 mt-1">Insufficient balance</div>
                  )}
                </div>
              </div>

              {/* Radio Button */}
              <div className="absolute top-4 right-4">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedTier === tier.id
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-slate-500'
                }`}>
                  {selectedTier === tier.id && (
                    <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Comparison */}
        <div className="px-6 py-3 border-t border-slate-700">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
          >
            <span>{showComparison ? 'Hide' : 'Show'} detailed comparison</span>
            <ArrowRight className={`w-3 h-3 transition-transform ${showComparison ? 'rotate-90' : ''}`} />
          </button>

          {showComparison && (
            <div className="mt-3 bg-slate-700/20 rounded-lg p-3">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="font-medium text-slate-300 mb-2">Processing Time</div>
                  <div className="space-y-1">
                    <div>Standard: {currentWaitTime}</div>
                    <div>Priority: ~30 seconds</div>
                    <div>Premium: ~15 seconds</div>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-slate-300 mb-2">Parallel Operations</div>
                  <div className="space-y-1">
                    <div>Standard: Single only</div>
                    <div>Priority: Single only</div>
                    <div>Premium: Unlimited</div>
                  </div>
                </div>
                <div>
                  <div className="font-medium text-slate-300 mb-2">Resource Priority</div>
                  <div className="space-y-1">
                    <div>Standard: Queue-based</div>
                    <div>Priority: Skip queue</div>
                    <div>Premium: Dedicated</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account Balance */}
        <div className="px-6 py-3 border-t border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Account Balance:</span>
            <span className={`font-medium ${userBalance < priorityCost ? 'text-red-400' : 'text-green-400'}`}>
              ${userBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Social Proof */}
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-700/20">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Users className="w-3 h-3" />
            <span>1,247 developers are using optimized processing this month</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-700/20 rounded-b-lg flex justify-between items-center">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Shield className="w-3 h-3" />
            <span>Secure processing • Cancel anytime</span>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-slate-400 hover:text-slate-300 disabled:opacity-50"
            >
              Continue with Standard
            </button>
            
            <button
              onClick={() => {
                if (selectedTier === 'priority') {
                  onUpgrade('priority')
                } else if (selectedTier === 'premium') {
                  onUpgrade('subscription')
                } else {
                  onClose()
                }
              }}
              disabled={
                isLoading || 
                selectedTier === 'standard' || 
                (selectedTier === 'priority' && hasInsufficientFunds)
              }
              className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
                selectedTier === 'premium'
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-black'
                  : selectedTier === 'priority'
                    ? hasInsufficientFunds
                      ? 'bg-slate-600 text-slate-400'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-slate-600 text-slate-400'
              }`}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>
                {isLoading ? 'Processing...' :
                 selectedTier === 'standard' ? 'Continue' :
                 selectedTier === 'priority' ? 
                   hasInsufficientFunds ? 'Insufficient Balance' : `Upgrade for $${priorityCost.toFixed(2)}` :
                 'Get Premium Access'
                }
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}