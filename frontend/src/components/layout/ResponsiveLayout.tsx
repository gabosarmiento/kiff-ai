import React, { useState } from 'react'
import useResponsive from '../../hooks/useResponsive'
import MobileHeader from './MobileHeader'
import MobileBottomNav, { MobileNavTab } from './MobileBottomNav'
import MobileModals from './MobileModals'
import DesktopColumns from './DesktopColumns'

interface ResponsiveLayoutProps {
  // Content for different panels
  leftPanel?: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel?: React.ReactNode
  
  // Mobile-specific props
  onSearch?: (query: string) => void
  searchValue?: string
  userEmail?: string
  notificationCount?: number
  knowledgeCount?: number
  
  // Layout configuration
  showLeftPanel?: boolean
  showRightPanel?: boolean
  leftPanelWidth?: string
  rightPanelWidth?: string
  
  className?: string
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  onSearch,
  searchValue = '',
  userEmail = 'demo@kiff.ai',
  notificationCount = 0,
  knowledgeCount = 0,
  showLeftPanel = true,
  showRightPanel = true,
  leftPanelWidth = 'w-64',
  rightPanelWidth = 'w-80',
  className = ''
}) => {
  const { isMobile } = useResponsive()
  
  // Mobile navigation state
  const [activeTab, setActiveTab] = useState<MobileNavTab>('home')
  const [activeModal, setActiveModal] = useState<MobileNavTab | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleTabChange = (tab: MobileNavTab) => {
    setActiveTab(tab)
    
    // For tabs other than home, open modal
    if (tab !== 'home') {
      setActiveModal(tab)
    } else {
      setActiveModal(null)
    }
  }

  const handleCloseModal = () => {
    setActiveModal(null)
    setActiveTab('home')
  }

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
    if (!isMobileMenuOpen) {
      setActiveModal('templates')
    } else {
      setActiveModal(null)
    }
  }

  if (isMobile) {
    return (
      <div className={`h-screen flex flex-col bg-white dark:bg-slate-950 ${className}`}>
        {/* Mobile Header */}
        <MobileHeader
          onMenuToggle={handleMenuToggle}
          searchValue={searchValue}
          onSearchChange={onSearch}
          userEmail={userEmail}
          notificationCount={notificationCount}
        />

        {/* Mobile Main Content */}
        <div className="flex-1 overflow-hidden">
          {centerPanel}
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          knowledgeCount={knowledgeCount}
        />

        {/* Mobile Modals */}
        <MobileModals
          activeModal={activeModal}
          onCloseModal={handleCloseModal}
          templatesContent={leftPanel}
          knowledgeContent={rightPanel}
          settingsContent={
            <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">Settings</h2>
              <p className="text-slate-400">Settings panel content will go here</p>
            </div>
          }
        />
      </div>
    )
  }

  // Desktop Layout
  return (
    <div className={`h-screen flex bg-slate-950 ${className}`}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-64">
        <DesktopColumns
          leftPanel={leftPanel}
          centerPanel={centerPanel}
          rightPanel={rightPanel}
          showLeftPanel={showLeftPanel}
          showRightPanel={showRightPanel}
          leftPanelWidth={leftPanelWidth}
          rightPanelWidth={rightPanelWidth}
        />
      </div>
    </div>
  )
}

export default ResponsiveLayout