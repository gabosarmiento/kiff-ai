import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  showLabel = true 
}) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`
        w-full flex items-center space-x-3 px-3 py-2 text-sm 
        text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 
        rounded-lg transition-all duration-200
        ${className}
      `}
    >
      <div className="flex-shrink-0">
        {theme === 'light' ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4" />
        )}
      </div>
      {showLabel && (
        <span>
          {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  )
}