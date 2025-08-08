import React from 'react'
import { cn } from './utils'
// import { Loader2 } from 'lucide-react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const buttonVariants = {
  primary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl border-0',
  secondary: 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm hover:shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-100 dark:border-slate-700',
  outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700 shadow-sm hover:shadow-md dark:border-slate-600 dark:text-gray-100 dark:hover:bg-slate-800',
  ghost: 'hover:bg-gray-100 text-gray-700 dark:text-gray-200 dark:hover:bg-slate-800',
  destructive: 'bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md border-0'
}

const buttonSizes = {
  sm: 'h-9 px-4 text-sm font-medium',
  md: 'h-10 px-6 py-2 font-medium',
  lg: 'h-12 px-8 font-medium',
  xl: 'h-14 px-10 text-lg font-medium'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    children, 
    ...props 
  }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]',
          buttonVariants[variant],
          buttonSizes[size],
          fullWidth && 'w-full',
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className="mr-2">⟳</span>}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
