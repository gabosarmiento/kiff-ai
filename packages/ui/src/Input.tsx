import React from 'react'
import { cn } from '../../lib/utils'
import { Eye, EyeOff } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  prepend?: React.ReactNode // new: element before input
  append?: React.ReactNode  // new: element after input
  variant?: 'default' | 'filled' | 'outline'
  inputSize?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const inputVariants = {
  default: 'border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 shadow-sm',
  filled: 'border-transparent bg-gray-100 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 shadow-sm',
  outline: 'border-2 border-gray-300 bg-white focus:border-blue-500 focus:ring-0 dark:border-slate-700 dark:bg-slate-900 shadow-sm'
}

const inputSizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 py-2',
  lg: 'h-13 px-4 text-base'
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className,
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    prepend,
    append,
    variant = 'default',
    inputSize = 'md',
    fullWidth = false,
    type,
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {label}
          </label>
        )}
        <div className="relative flex items-stretch w-full">
          {/* Prepend (Claude-style left controls) */}
          {prepend && (
            <div className="flex items-center px-2 border border-r-0 rounded-l-md bg-slate-100 dark:bg-slate-800">
              {prepend}
            </div>
          )}
          <div className="relative flex-1">
            {leftIcon && (
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 text-sm">{leftIcon}</span>
              </div>
            )}
            <input
              type={inputType}
              className={cn(
                'block rounded-lg border transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 font-medium appearance-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400',
                inputVariants[variant],
                inputSizes[inputSize],
                leftIcon && 'pl-10',
                (rightIcon || isPassword) && 'pr-10',
                fullWidth && 'w-full',
                error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                prepend && !append && 'rounded-l-none',
                !prepend && append && 'rounded-r-none',
                prepend && append && 'rounded-none',
                className
              )}
              ref={ref}
              {...props}
            />
            {(rightIcon || isPassword) && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {isPassword ? (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                ) : (
                  <span className="text-slate-400 text-sm">{rightIcon}</span>
                )}
              </div>
            )}
          </div>
          {/* Append (Claude-style right controls) */}
          {append && (
            <div className="flex items-center px-2 border border-l-0 rounded-r-md bg-slate-100 dark:bg-slate-800">
              {append}
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p className={cn(
            'text-sm mt-1',
            error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
