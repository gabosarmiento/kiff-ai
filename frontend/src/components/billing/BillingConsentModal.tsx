import React, { useState, useEffect } from 'react'
import { 
  DollarSign, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  CreditCard,
  Zap,
  Calculator
} from 'lucide-react'

interface BillingConsentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  apiName: string
  apiDisplayName: string
  costDetails: {
    originalCost: number
    fractionalCost: number
    savings: number
    savingsPercentage: number
  }
  userBalance?: number
  isLoading?: boolean
}

export const BillingConsentModal: React.FC<BillingConsentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  apiName,
  apiDisplayName,
  costDetails,
  userBalance = 50.0,
  isLoading = false
}) => {
  const [agreed, setAgreed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAgreed(false)
      setShowDetails(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const hasInsufficientFunds = userBalance < costDetails.fractionalCost
  const isFree = costDetails.fractionalCost === 0

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {isFree ? (
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                {isFree ? 'Free API Access' : 'Confirm API Access Charge'}
              </h3>
              <p className="text-sm text-slate-400">
                Access to {apiDisplayName} documentation
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Cost Breakdown */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-300">Cost Breakdown</span>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {/* Main Cost Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">You Pay:</span>
                <span className={`text-xl font-bold ${isFree ? 'text-green-400' : 'text-blue-400'}`}>
                  {isFree ? 'FREE' : `$${costDetails.fractionalCost.toFixed(2)}`}
                </span>
              </div>
              
              {!isFree && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">You Save:</span>
                  <span className="text-green-400 font-medium">
                    ${costDetails.savings.toFixed(2)} ({costDetails.savingsPercentage.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>

            {/* Detailed Breakdown */}
            {showDetails && (
              <div className="mt-4 pt-3 border-t border-slate-600 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Full Indexing Cost:</span>
                  <span>${costDetails.originalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Your Share (Cost-Split):</span>
                  <span>{isFree ? 'FREE' : `$${costDetails.fractionalCost.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-green-400 font-medium">
                  <span>Your Savings:</span>
                  <span>${costDetails.savings.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Features Included */}
          <div className="bg-slate-700/20 rounded-lg p-3">
            <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
              <Zap className="w-4 h-4 mr-1 text-yellow-400" />
              What You Get:
            </h4>
            <ul className="space-y-1 text-sm text-slate-400">
              <li className="flex items-center">
                <CheckCircle className="w-3 h-3 mr-2 text-green-400" />
                Instant access to indexed API documentation
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-3 h-3 mr-2 text-green-400" />
                30 days of unlimited queries
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-3 h-3 mr-2 text-green-400" />
                High-quality vectorized knowledge base
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-3 h-3 mr-2 text-green-400" />
                No additional processing wait time
              </li>
            </ul>
          </div>

          {/* Account Balance */}
          <div className="flex items-center justify-between bg-slate-700/20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Account Balance:</span>
            </div>
            <span className={`font-medium ${hasInsufficientFunds ? 'text-red-400' : 'text-green-400'}`}>
              ${userBalance.toFixed(2)}
            </span>
          </div>

          {/* Warning for insufficient funds */}
          {hasInsufficientFunds && !isFree && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400 font-medium">Insufficient Balance</span>
              </div>
              <p className="text-sm text-red-300 mt-1">
                You need ${(costDetails.fractionalCost - userBalance).toFixed(2)} more to access this API.
                Please add credits to your account.
              </p>
            </div>
          )}

          {/* Free tier notification */}
          {isFree && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-medium">Free Tier Access</span>
              </div>
              <p className="text-sm text-green-300 mt-1">
                This API access is included in your free tier. No charges will apply.
              </p>
            </div>
          )}

          {/* Terms Agreement */}
          {!isFree && (
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="billing-agreement"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="billing-agreement" className="text-sm text-slate-300">
                I understand and agree to be charged{' '}
                <span className="font-medium text-blue-400">
                  ${costDetails.fractionalCost.toFixed(2)}
                </span>{' '}
                for 30-day access to {apiDisplayName} API documentation. This charge will be deducted from my account balance immediately.
              </label>
            </div>
          )}

          {/* Payment Security Notice */}
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Shield className="w-3 h-3" />
            <span>Secure billing • Cancel anytime • 7-day refund policy</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-700/20 rounded-b-lg flex justify-between">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-slate-400 hover:text-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isLoading || (!isFree && (!agreed || hasInsufficientFunds))}
            className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
              isFree 
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : hasInsufficientFunds
                  ? 'bg-slate-600 text-slate-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>
              {isLoading 
                ? 'Processing...' 
                : isFree 
                  ? 'Access for Free'
                  : hasInsufficientFunds
                    ? 'Insufficient Balance'
                    : `Confirm & Pay $${costDetails.fractionalCost.toFixed(2)}`
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}