import React from 'react'
import { Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export type KnowledgeStatusType = 'ready' | 'processing' | 'available' | 'failed' | 'indexing'

interface KnowledgeStatusProps {
  status: KnowledgeStatusType
  progress?: number
  chunks?: number
  size?: 'sm' | 'md'
}

const KnowledgeStatus: React.FC<KnowledgeStatusProps> = ({ 
  status, 
  progress, 
  chunks,
  size = 'sm' 
}) => {
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  switch (status) {
    case 'ready':
      return (
        <div className="flex items-center space-x-2">
          {chunks && (
            <span className={`${textSize} text-slate-400`}>
              {chunks.toLocaleString()} chunks
            </span>
          )}
          <CheckCircle className={`${iconSize} text-green-400`} />
          <span className={`${textSize} text-green-400 font-medium`}>Ready</span>
        </div>
      )
    
    case 'processing':
    case 'indexing':
      return (
        <div className="flex items-center space-x-2">
          <Loader2 className={`${iconSize} text-blue-400 animate-spin`} />
          <span className={`${textSize} text-blue-400 font-medium`}>
            {progress ? `${progress}%` : 'Processing...'}
          </span>
        </div>
      )
    
    case 'failed':
      return (
        <div className="flex items-center space-x-2">
          <AlertCircle className={`${iconSize} text-red-400`} />
          <span className={`${textSize} text-red-400 font-medium`}>Failed</span>
        </div>
      )
    
    case 'available':
    default:
      return null
  }
}

// Status badge variant for compact displays
export const KnowledgeStatusBadge: React.FC<KnowledgeStatusProps> = ({ 
  status, 
  progress, 
  chunks 
}) => {
  const getBadgeStyles = () => {
    switch (status) {
      case 'ready':
        return 'bg-green-500/20 text-green-400 border-green-400/30'
      case 'processing':
      case 'indexing':
        return 'bg-blue-500/20 text-blue-400 border-blue-400/30'
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-400/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-400/30'
    }
  }

  const getBadgeContent = () => {
    switch (status) {
      case 'ready':
        return chunks ? `${chunks.toLocaleString()}` : 'READY'
      case 'processing':
      case 'indexing':
        return progress ? `${progress}%` : 'PROCESSING'
      case 'failed':
        return 'FAILED'
      default:
        return 'AVAILABLE'
    }
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getBadgeStyles()}`}>
      {getBadgeContent()}
    </div>
  )
}

export default KnowledgeStatus