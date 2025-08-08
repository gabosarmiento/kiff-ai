import React from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md' | 'lg'
  rounded?: boolean
  dot?: boolean
}

const badgeVariants = {
  default: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700',
  secondary: 'bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-slate-100 border border-gray-300 dark:border-slate-600',
  success: 'bg-green-50 text-green-700 dark:bg-slate-800 dark:text-green-300 border border-green-200 dark:border-green-700',
  warning: 'bg-orange-50 text-orange-700 dark:bg-slate-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700',
  error: 'bg-red-50 text-red-700 dark:bg-slate-800 dark:text-red-300 border border-red-200 dark:border-red-700',
  info: 'bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
}

const badgeSizes = {
  sm: 'px-2.5 py-1 text-xs font-medium',
  md: 'px-3 py-1.5 text-sm font-medium',
  lg: 'px-4 py-2 text-sm font-medium'
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'sm',
    rounded = true,
    dot = false,
    children, 
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center transition-all duration-200 ease-in-out',
          badgeVariants[variant],
          badgeSizes[size],
          rounded ? 'rounded-full' : 'rounded-lg',
          className
        )}
        {...props}
      >
        {dot && (
          <div className={cn(
            'w-1.5 h-1.5 rounded-full mr-1.5',
            variant === 'success' && 'bg-green-600',
            variant === 'warning' && 'bg-yellow-600',
            variant === 'error' && 'bg-red-600',
            variant === 'info' && 'bg-blue-600',
            (variant === 'default' || variant === 'secondary') && 'bg-slate-500'
          )} />
        )}
        {children}
      </div>
    )
  }
)

Badge.displayName = 'Badge'
