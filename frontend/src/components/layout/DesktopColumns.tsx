import React from 'react'

interface DesktopColumnsProps {
  leftPanel?: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel?: React.ReactNode
  leftPanelWidth?: string
  rightPanelWidth?: string
  showLeftPanel?: boolean
  showRightPanel?: boolean
  className?: string
}

const DesktopColumns: React.FC<DesktopColumnsProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  leftPanelWidth = 'w-64', // 256px
  rightPanelWidth = 'w-80', // 320px
  showLeftPanel = true,
  showRightPanel = true,
  className = ''
}) => {
  return (
    <div className={`hidden md:flex h-full ${className}`}>
      {/* Left Panel - Templates */}
      {showLeftPanel && leftPanel && (
        <div className={`${leftPanelWidth} flex-shrink-0 border-r border-gray-200 dark:border-slate-700/50`}>
          <div className="h-full overflow-y-auto">
            {leftPanel}
          </div>
        </div>
      )}

      {/* Center Panel - Main Content */}
      <div className="flex-1 min-w-0">
        <div className="h-full overflow-y-auto">
          {centerPanel}
        </div>
      </div>

      {/* Right Panel - Knowledge */}
      {showRightPanel && rightPanel && (
        <div className={`${rightPanelWidth} flex-shrink-0 border-l border-gray-200 dark:border-slate-700/50`}>
          <div className="h-full overflow-y-auto">
            {rightPanel}
          </div>
        </div>
      )}
    </div>
  )
}

export default DesktopColumns