import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, leftIcon, ...props }, ref) => {
  const inputEl = (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        leftIcon ? "pl-8" : "",
        className
      )}
      ref={ref}
      {...props}
    />
  )

  if (!leftIcon) return inputEl

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
        {leftIcon}
      </div>
      {inputEl}
    </div>
  )
})
Input.displayName = "Input"

export { Input }
