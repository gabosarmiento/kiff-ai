import { useState } from 'react'
import { ConversationalChat } from '@/components/chat/ConversationalChat'
import { PreviewPanel } from '@/components/chat/PreviewPanel'
import { KnowledgePanel } from '@/components/knowledge'
import { Bot, Grid3X3, MessageSquare, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

type LayoutMode = 'chat' | 'three-column'

interface PreviewData {
  type: 'application' | 'component' | 'file'
  title: string
  description?: string
  content?: string
  url?: string
  files?: Array<{
    name: string
    path: string
    content: string
    language: string
  }>
  metadata?: {
    framework?: string
    dependencies?: string[]
    buildCommand?: string
    startCommand?: string
  }
}

export function ConversationalHomePage() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('chat')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const handleLayoutToggle = () => {
    setLayoutMode(prev => prev === 'chat' ? 'three-column' : 'chat')
    toast.success(`Switched to ${layoutMode === 'chat' ? '3-column' : 'chat'} layout`)
  }

  const handlePreviewGenerated = (preview: PreviewData) => {
    setPreviewData(preview)
    setShowPreview(true)
    
    // In chat mode, move chat to left and show preview
    if (layoutMode === 'chat') {
      // This will be handled by the layout change
    }
    
    toast.success('Preview generated!')
  }

  const handleKnowledgeAdd = (apiId: string) => {
    toast.success(`Added ${apiId} to knowledge base`)
  }

  const handleKnowledgeRemove = (apiId: string) => {
    toast.success(`Removed ${apiId} from knowledge base`)
  }

  const handleBrowseGallery = () => {
    // Navigate to gallery - would need router integration
    toast('Opening API Gallery...', { icon: 'ℹ️' })
  }

  // Chat layout with optional preview
  if (layoutMode === 'chat') {
    const chatHasPreview = showPreview && previewData

    return (
      <div className="h-full flex bg-slate-900">
        {/* Header for mobile/small screens */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-400/30">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
              <h1 className="text-lg font-semibold text-slate-200">Kiff AI</h1>
            </div>
            <button
              onClick={handleLayoutToggle}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-colors"
            >
              <Grid3X3 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">3-Column</span>
            </button>
          </div>
        </div>

        {/* Chat Panel */}
        <div className={`${
          chatHasPreview ? 'w-1/2 lg:w-2/3' : 'flex-1'
        } transition-all duration-300 ${isPreviewExpanded ? 'hidden' : ''}`}>
          <ConversationalChat
            onLayoutToggle={handleLayoutToggle}
            showLayoutToggle={!chatHasPreview} // Hide toggle when preview is shown
            onPreviewGenerated={handlePreviewGenerated}
          />
        </div>

        {/* Preview Panel */}
        {chatHasPreview && (
          <div className={`${
            isPreviewExpanded ? 'w-full' : 'w-1/2 lg:w-1/3'
          } transition-all duration-300`}>
            <PreviewPanel
              previewData={previewData}
              isExpanded={isPreviewExpanded}
              onToggleExpand={() => setIsPreviewExpanded(!isPreviewExpanded)}
            />
          </div>
        )}
      </div>
    )
  }

  // Three-column layout (traditional)
  return (
    <div className="h-full flex bg-slate-900">
      {/* Left Panel - Knowledge APIs */}
      <div className="hidden lg:block w-80 border-r border-slate-700/50">
        <KnowledgePanel
          onAddKnowledge={handleKnowledgeAdd}
          onRemoveKnowledge={handleKnowledgeRemove}
          onBrowseGallery={handleBrowseGallery}
        />
      </div>

      {/* Center Panel - Main Content */}
      <div className="flex-1 min-w-0">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-slate-600/50">
                <Bot className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">
                  Build with
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"> Knowledge-Driven AI</span>
                </h1>
                <p className="text-slate-400">Transform ideas into production-ready applications</p>
              </div>
            </div>
            
            <button
              onClick={handleLayoutToggle}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Chat Mode</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto">
              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">Knowledge-First</h3>
                  <p className="text-slate-400 text-sm">
                    AI grounded in indexed API documentation for accurate, production-ready code generation.
                  </p>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                    <Bot className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">AGNO Powered</h3>
                  <p className="text-slate-400 text-sm">
                    Advanced agent tools for project analysis, API pattern recognition, and intelligent task evolution.
                  </p>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">Conversational</h3>
                  <p className="text-slate-400 text-sm">
                    Claude Code-like interface for natural development conversations with real-time previews.
                  </p>
                </div>
              </div>

              {/* CTA Section */}
              <div className="text-center">
                <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/50 rounded-2xl p-8">
                  <h2 className="text-2xl font-bold text-slate-100 mb-4">
                    Ready to build something amazing?
                  </h2>
                  <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
                    Switch to chat mode for a conversational development experience, or use the traditional 3-column layout for structured generation.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={handleLayoutToggle}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Start Chatting</span>
                    </button>
                    <button
                      onClick={() => toast('Opening API Gallery...', { icon: 'ℹ️' })}
                      className="px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 font-medium rounded-lg border border-slate-600/50 transition-all duration-200"
                    >
                      Browse API Gallery
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Preview (if available) */}
      {showPreview && previewData && (
        <div className="hidden xl:block w-96">
          <PreviewPanel
            previewData={previewData}
            isExpanded={isPreviewExpanded}
            onToggleExpand={() => setIsPreviewExpanded(!isPreviewExpanded)}
          />
        </div>
      )}
    </div>
  )
}
