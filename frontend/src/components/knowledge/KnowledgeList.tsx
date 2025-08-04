import React from 'react'
import KnowledgeItem, { KnowledgeItemData } from './KnowledgeItem'

interface KnowledgeListProps {
  items: KnowledgeItemData[]
  onAdd?: (id: string) => void
  onRemove?: (id: string) => void
  showActions?: boolean
  emptyMessage?: string
  className?: string
}

const KnowledgeList: React.FC<KnowledgeListProps> = ({
  items,
  onAdd,
  onRemove,
  showActions = true,
  emptyMessage = 'No APIs available',
  className = ''
}) => {
  if (items.length === 0) {
    return (
      <div className={`px-3 py-4 text-center ${className}`}>
        <p className="text-xs text-slate-500 italic">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {items.map((item) => (
        <KnowledgeItem
          key={item.id}
          item={item}
          onAdd={onAdd}
          onRemove={onRemove}
          showActions={showActions}
        />
      ))}
    </div>
  )
}

export default KnowledgeList