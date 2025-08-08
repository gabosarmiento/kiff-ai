import React from 'react'
import { cn } from '../../lib/utils'

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  fullscreen?: boolean
}

// A shared page container that normalizes light/dark backgrounds and text colors
// Light: white canvas with dark text
// Dark: near-black canvas with light text
export const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className, children, padded = true, fullscreen = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // base canvas + typography
          'bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-200',
          // size helpers
          fullscreen ? 'min-h-screen' : '',
          padded ? 'p-4 sm:p-6 md:p-8' : '',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

PageContainer.displayName = 'PageContainer'
