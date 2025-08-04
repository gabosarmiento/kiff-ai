import React from 'react'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

export interface KnowledgeItemData {
  id: string
  name: string
  chunks?: number
  status: 'ready' | 'processing' | 'available' | 'failed'
  progress?: number
}

interface KnowledgeItemProps {
  item: KnowledgeItemData
  onAdd?: (id: string) => void
  onRemove?: (id: string) => void
  showActions?: boolean
}

const KnowledgeItem: React.FC<KnowledgeItemProps> = ({ 
  item, 
  onAdd, 
  onRemove, 
  showActions = true 
}) => {
  const getStatusDisplay = () => {
    switch (item.status) {
      case 'ready':
        return (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">{item.chunks?.toLocaleString()} chunks</span>
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">Ready</span>
          </div>
        )
      case 'processing':
        return (
          <div className="flex items-center space-x-2">
            <Clock className="w-3 h-3 text-blue-400 animate-spin" />
            <span className="text-xs text-blue-400">
              {item.progress ? `${item.progress}%` : 'Processing...'}
            </span>
          </div>
        )
      case 'failed':
        return (
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span className="text-xs text-red-400">Failed</span>
          </div>
        )
      case 'available':
      default:
        return null
    }
  }

  const getActionButton = () => {
    if (!showActions) return null

    switch (item.status) {
      case 'ready':
        return onRemove ? (
          <button
            onClick={() => onRemove(item.id)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Remove
          </button>
        ) : null
      case 'available':
        return onAdd ? (
          <button
            onClick={() => onAdd(item.id)}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
          >
            Add
          </button>
        ) : null
      case 'processing':
        return (
          <span className="text-xs text-slate-500">Indexing...</span>
        )
      case 'failed':
        return onAdd ? (
          <button
            onClick={() => onAdd(item.id)}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            Retry
          </button>
        ) : null
      default:
        return null
    }
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-800/30 rounded transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-200 font-medium truncate">
            {item.name}
          </span>
          {getStatusDisplay()}
        </div>
      </div>
      
      {showActions && (
        <div className="ml-3 flex-shrink-0">
          {getActionButton()}
        </div>
      )}
    </div>
  )
}

export default KnowledgeItem