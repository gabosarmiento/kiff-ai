import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  X,
  Check,
  Star,
  Headphones,
  Sparkles,
  CreditCard,
  Clock,
  ArrowRight
} from 'lucide-react'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubscribe: (planType: string) => void
  currentPlan?: string
  isLoading?: boolean
}

interface PlanFeature {
  text: string
  included: boolean
  highlight?: boolean
}

interface Plan {
  id: string
  name: string
  price: string
  billing: string
  description: string
  features: PlanFeature[]
  popular?: boolean
  buttonText: string
  buttonStyle: string
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  currentPlan = 'free',
  isLoading = false
}) => {
  const [selectedPlan, setSelectedPlan] = useState<string>(currentPlan)

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      billing: 'forever',
      description: 'Try our platform',
      features: [
        { text: '100 API calls/month', included: true },
        { text: 'Basic documentation', included: true },
        { text: 'Community support', included: true },
        { text: 'Priority processing', included: false },
        { text: 'Advanced AI features', included: false },
        { text: 'Premium support', included: false }
      ],
      buttonText: currentPlan === 'free' ? 'Current Plan' : 'Downgrade',
      buttonStyle: 'bg-slate-600 text-slate-300'
    },
    {
      id: 'pay_per_token',
      name: 'Pay-per-token',
      price: 'Pay per token',
      billing: '',
      description: 'Pay as you use',
      features: [
        { text: 'Pay per token only', included: true, highlight: true },
        { text: 'No monthly fees', included: true },
        { text: 'Full documentation', included: true },
        { text: 'Email support', included: true },
        { text: 'Priority processing', included: false },
        { text: 'Advanced AI features', included: false }
      ],
      buttonText: currentPlan === 'pay_per_token' ? 'Current Plan' : 'Switch to Pay-per-token',
      buttonStyle: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$20',
      billing: 'per month',
      description: 'For power users',
      popular: true,
      features: [
        { text: '1000 API calls or 5M tokens', included: true, highlight: true },
        { text: 'Priority processing', included: true, highlight: true },
        { text: 'Advanced AI features', included: true, highlight: true },
        { text: 'Premium support', included: true },
        { text: 'Team collaboration', included: true },
        { text: 'Analytics dashboard', included: true }
      ],
      buttonText: currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
      buttonStyle: 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg'
    }
  ]

  const selectedPlanData = plans.find(plan => plan.id === selectedPlan)

  useEffect(() => {
    if (isOpen && currentPlan !== 'free') {
      setSelectedPlan('pro')
    }
  }, [isOpen, currentPlan])

  if (!isOpen) return null

  const modalContent = (
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-h-[95vh] overflow-hidden mx-auto"
        style={{ maxWidth: '60rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Choose Your Plan
              </h2>
              <p className="text-sm text-gray-600">
                Unlock AI-powered development
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* Plan Cards */}
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPlan === plan.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } ${
                  plan.popular ? 'ring-1 ring-blue-500 ring-opacity-20' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <div className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1">
                      <Star className="w-2.5 h-2.5" />
                      <span>Popular</span>
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-3">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <div className="mb-1">
                    <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-1 text-sm">{plan.billing}</span>
                  </div>
                  <p className="text-xs text-gray-600">{plan.description}</p>
                </div>
                
                <div className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      {feature.included ? (
                        <Check className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                          feature.highlight ? 'text-blue-500' : 'text-green-500'
                        }`} />
                      ) : (
                        <X className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={`text-xs ${
                        feature.included 
                          ? feature.highlight 
                            ? 'text-blue-700 font-medium' 
                            : 'text-gray-700'
                          : 'text-gray-400'
                      }`}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
                
                {selectedPlan === plan.id && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>



          {/* Selected Plan Summary */}
          {selectedPlanData && (
            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedPlanData.name} Plan Selected
                  </h3>
                  <p className="text-gray-600">
                    {selectedPlanData.price}/{selectedPlanData.billing}
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  {selectedPlan === 'pro' && (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Billed monthly • Cancel anytime</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Trust Indicators */}
          <div className="flex items-center justify-center space-x-4 mb-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <CreditCard className="w-3 h-3" />
              <span>Secure payment</span>
            </div>
            <div className="flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center space-x-1">
              <Headphones className="w-3 h-3" />
              <span>24/7 support</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Maybe Later
            </button>
            
            <button
              onClick={() => onSubscribe(selectedPlan)}
              disabled={isLoading || selectedPlan === currentPlan}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
                selectedPlanData?.buttonStyle || 'bg-gray-600'
              }`}
            >
              {isLoading && (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {selectedPlan === 'pro' && <Sparkles className="w-3 h-3" />}
              <span>
                {isLoading ? 'Processing...' : selectedPlanData?.buttonText}
              </span>
              {selectedPlan !== currentPlan && selectedPlan !== 'free' && (
                <ArrowRight className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Additional Info */}
        </div>
      </div>
    </div>
  )

  // Render modal using React Portal to ensure proper positioning
  return createPortal(modalContent, document.body)
}