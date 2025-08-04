import React from 'react'

interface KnowledgeSectionProps {
  title: string
  subtitle?: string
  count?: number
  totalCount?: number
  children: React.ReactNode
  className?: string
}

const KnowledgeSection: React.FC<KnowledgeSectionProps> = ({
  title,
  subtitle,
  count,
  totalCount,
  children,
  className = ''
}) => {
  const formatTitle = () => {
    let displayTitle = title.toUpperCase()
    
    if (count !== undefined) {
      if (totalCount !== undefined) {
        displayTitle += ` (${count} of ${totalCount} available)`
      } else {
        displayTitle += ` (${count})`
      }
    }
    
    return displayTitle
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Section Header */}
      <div className="px-3 py-1">
        <h3 className="text-xs font-semibold text-slate-400 tracking-wide">
          {formatTitle()}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>
      
      {/* Section Content */}
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}

export default KnowledgeSection