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
      <div className={`h-screen flex flex-col bg-slate-950 ${className}`}>
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
    <div className={`h-screen flex flex-col bg-slate-950 ${className}`}>
      {/* Desktop Header */}
      <header className="bg-slate-900 border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-100 font-semibold">kiff</span>
              <span className="text-slate-400 text-xs">adaptive.ai</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search agents, strategies, or symbols..."
                value={searchValue}
                onChange={(e) => onSearch?.(e.target.value)}
                className="w-full pl-4 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
              />
            </div>
          </div>

          {/* User Section */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-slate-300 text-sm">{userEmail}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Columns */}
      <div className="flex-1 overflow-hidden">
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