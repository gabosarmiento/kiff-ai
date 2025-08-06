import React from 'react'
import { Zap, Star, Crown } from 'lucide-react'

interface UpgradeButtonProps {
  currentPlan: 'free' | 'pay_per_token' | 'pro'
  onClick: () => void
  className?: string
  compact?: boolean
}

export const UpgradeButton: React.FC<UpgradeButtonProps> = ({
  currentPlan,
  onClick,
  className = '',
  compact = false
}) => {
  const getButtonContent = () => {
    switch (currentPlan) {
      case 'free':
        return {
          icon: <Star className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />,
          text: compact ? 'Upgrade' : 'Upgrade to Pro',
          style: 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg',
          pulse: true
        }
      case 'pay_per_token':
        return {
          icon: <Zap className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />,
          text: compact ? 'Go Pro' : 'Upgrade to Pro',
          style: 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg',
          pulse: false
        }
      case 'pro':
        return {
          icon: <Crown className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-yellow-400`} />,
          text: compact ? 'Pro' : 'Pro Plan',
          style: 'bg-slate-700 text-slate-200 cursor-default',
          pulse: false
        }
    }
  }

  const { icon, text, style, pulse } = getButtonContent()

  return (
    <button
      onClick={currentPlan !== 'pro' ? onClick : undefined}
      className={`
        ${style}
        ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
        rounded-lg font-medium transition-all duration-200 
        flex items-center space-x-2
        ${pulse ? 'animate-pulse-twice hover:animate-none' : ''}
        ${currentPlan !== 'pro' ? 'transform hover:scale-105' : ''}
        ${className}
      `}
      disabled={currentPlan === 'pro'}
    >
      {icon}
      <span className={compact ? 'hidden sm:inline' : ''}>{text}</span>
      {currentPlan === 'free' && !compact && (
        <div className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
          $20/mo
        </div>
      )}
    </button>
  )
}

// Plan indicator badge for navbar
export const PlanBadge: React.FC<{
  currentPlan: 'free' | 'pay_per_token' | 'pro'
  onClick: () => void
}> = ({ currentPlan, onClick }) => {
  const getPlanDisplay = () => {
    switch (currentPlan) {
      case 'free':
        return {
          text: 'Free',
          style: 'bg-gray-100 text-gray-700 border border-gray-300',
          clickable: true
        }
      case 'pay_per_token':
        return {
          text: 'Pay-per-token',
          style: 'bg-blue-50 text-blue-700 border border-blue-200',
          clickable: true
        }
      case 'pro':
        return {
          text: 'Pro',
          style: 'bg-gradient-to-r from-orange-100 to-pink-100 text-orange-700 border border-orange-200',
          clickable: true
        }
    }
  }

  const { text, style, clickable } = getPlanDisplay()

  return (
    <button
      onClick={clickable ? onClick : undefined}
      className={`
        ${style}
        px-2 py-1 rounded-md text-xs font-medium
        ${clickable ? 'hover:bg-opacity-80 cursor-pointer' : 'cursor-default'}
        transition-all duration-200
        flex items-center space-x-1
      `}
    >
      <span>{text}</span>
      {currentPlan === 'free' && (
        <Star className="w-3 h-3 text-gray-500" />
      )}
      {currentPlan === 'pro' && (
        <Crown className="w-3 h-3 text-orange-500" />
      )}
    </button>
  )
}