import React from 'react'
import { cn } from './utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated' | 'filled'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  divider?: boolean
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  divider?: boolean
}

const cardVariants = {
  default: 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm',
  outlined: 'bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-600 shadow-sm',
  elevated: 'bg-white dark:bg-slate-900 shadow-xl border border-gray-100 dark:border-slate-700',
  filled: 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm'
}

const paddingVariants = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10'
}

const roundedVariants = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className, 
    variant = 'default', 
    padding = 'md',
    rounded = 'lg',
    children, 
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'transition-all duration-200 ease-in-out hover:shadow-lg',
          cardVariants[variant],
          paddingVariants[padding],
          roundedVariants[rounded],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, divider = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col space-y-2',
          divider && 'pb-4 border-b border-gray-200 dark:border-slate-700',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('pt-0', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, divider = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center',
          divider && 'pt-4 border-t border-gray-200 dark:border-slate-700',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
CardHeader.displayName = 'CardHeader'
CardContent.displayName = 'CardContent'
CardFooter.displayName = 'CardFooter'
