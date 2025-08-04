import React from 'react'
import { ExternalLink, Search, ArrowRight } from 'lucide-react'

interface GalleryLinkProps {
  totalApis: number
  onClick?: () => void
  variant?: 'default' | 'compact' | 'prominent'
  className?: string
}

const GalleryLink: React.FC<GalleryLinkProps> = ({
  totalApis,
  onClick,
  variant = 'default',
  className = ''
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      // Default behavior - navigate to gallery page
      // This could be handled by router or parent component
      console.log('Navigate to API Gallery')
    }
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-slate-400 hover:text-cyan-400 hover:bg-slate-800/30 rounded transition-colors group ${className}`}
      >
        <span>Browse Gallery ({totalApis} APIs)</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </button>
    )
  }

  if (variant === 'prominent') {
    return (
      <button
        onClick={handleClick}
        className={`w-full border border-slate-600/50 hover:border-cyan-400/50 rounded-lg p-4 transition-colors group bg-slate-800/20 hover:bg-slate-800/40 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-400/20">
              <Search className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-medium text-slate-200">Discover APIs</h3>
              <p className="text-xs text-slate-400">{totalApis} APIs available</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>
    )
  }

  // Default variant
  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-800/30 rounded transition-colors group border border-transparent hover:border-slate-600/30 ${className}`}
    >
      <div className="flex items-center space-x-2">
        <Search className="w-3 h-3" />
        <span>Browse Gallery ({totalApis} APIs)</span>
      </div>
      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
    </button>
  )
}

export default GalleryLink