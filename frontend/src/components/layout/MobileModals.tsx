import React, { useEffect } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { MobileNavTab } from './MobileBottomNav'

interface MobileModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  showBackButton?: boolean
  fullHeight?: boolean
  className?: string
}

export const MobileModal: React.FC<MobileModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  showBackButton = true,
  fullHeight = true,
  className = ''
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-900">
      {/* Modal Header */}
      <div className="bg-slate-900 border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {showBackButton && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal Content */}
      <div className={`${fullHeight ? 'h-full' : 'flex-1'} overflow-y-auto ${className}`}>
        <div className="pb-20"> {/* Bottom padding for safe area */}
          {children}
        </div>
      </div>
    </div>
  )
}

interface MobileModalsProps {
  activeModal: MobileNavTab | null
  onCloseModal: () => void
  templatesContent?: React.ReactNode
  knowledgeContent?: React.ReactNode
  settingsContent?: React.ReactNode
}

const MobileModals: React.FC<MobileModalsProps> = ({
  activeModal,
  onCloseModal,
  templatesContent,
  knowledgeContent,
  settingsContent
}) => {
  const getModalContent = () => {
    switch (activeModal) {
      case 'templates':
        return {
          title: 'Templates',
          content: templatesContent || (
            <div className="p-4">
              <p className="text-slate-400">Templates content will go here</p>
            </div>
          )
        }
      case 'knowledge':
        return {
          title: 'Knowledge APIs',
          content: knowledgeContent || (
            <div className="p-4">
              <p className="text-slate-400">Knowledge panel content will go here</p>
            </div>
          )
        }
      case 'settings':
        return {
          title: 'Settings',
          content: settingsContent || (
            <div className="p-4">
              <p className="text-slate-400">Settings content will go here</p>
            </div>
          )
        }
      default:
        return null
    }
  }

  const modalContent = getModalContent()
  if (!modalContent) return null

  return (
    <MobileModal
      isOpen={!!activeModal}
      onClose={onCloseModal}
      title={modalContent.title}
    >
      {modalContent.content}
    </MobileModal>
  )
}

export default MobileModals