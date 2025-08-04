import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Zap, ArrowRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import toast from 'react-hot-toast'
import DynamicProjectCreation from '@/components/DynamicProjectCreation'
import { KnowledgePanel } from '@/components/knowledge'

export function HomePage() {
  const navigate = useNavigate()
  const { setLoading } = useStore()
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [generatedApp, setGeneratedApp] = useState<any>(null)
  const [showDynamicUI, setShowDynamicUI] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    
    setIsProcessing(true)
    setLoading('generating', true)
    
    // Show dynamic UI instead of basic logs
    setShowDynamicUI(true)
    
    // The dynamic UI component will handle the actual generation via WebSocket
    // This function just initiates the process
  }

  // Callback handlers for dynamic UI
  const handleProjectComplete = (result: any) => {
    setGeneratedApp(result)
    setIsProcessing(false)
    setLoading('generating', false)
    toast.success('Application generated successfully!')
    
    // Navigate immediately to Applications page
    navigate('/applications')
  }

  const handleProjectError = (error: string) => {
    setIsProcessing(false)
    setLoading('generating', false)
    setShowDynamicUI(false)
    toast.error(`Generation failed: ${error}`)
    console.error('Generation error:', error)
  }


  const handleKnowledgeAdd = (apiId: string) => {
    toast.success(`Added ${apiId} to knowledge base`)
  }

  const handleKnowledgeRemove = (apiId: string) => {
    toast.success(`Removed ${apiId} from knowledge base`)
  }

  const handleBrowseGallery = () => {
    navigate('/gallery')
  }

  // Center panel content - the main generation interface
  const centerPanelContent = (
    <div className="h-full flex flex-col">
      {/* Hero Section */}
      <div className="text-center py-8 px-4">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-slate-600/50">
            <Bot className="w-8 h-8 text-cyan-400" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">
          Build Applications with
          <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"> Adaptive AI</span>
        </h1>
        <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
          kiff transforms your app ideas into complete, production-ready applications. 
          Describe what you want to build, and our AI extracts API knowledge to generate intelligent, working code.
        </p>
      </div>

      {/* Generation Interface */}
      <div className="flex-1 px-4 pb-4">
        <div className="max-w-4xl mx-auto">
          {!showDynamicUI ? (
            /* Input Section */
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Bot className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-slate-200">Describe your application</h2>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the application you want to create in detail..."
                  className="w-full h-32 p-4 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent resize-none"
                  disabled={isProcessing}
                />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    Be specific about features, technologies, and requirements
                  </p>
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isProcessing}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Generate Application</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* User Message */
            <div className="mb-6">
              <div className="flex items-start space-x-3 max-w-3xl ml-auto">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-cyan-400/30">
                  <span className="text-xs font-semibold text-cyan-400">YOU</span>
                </div>
                <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                  <p className="text-slate-200 leading-relaxed">{prompt}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Project Creation UI */}
        {showDynamicUI && (
          <div className="mt-8 max-w-6xl mx-auto">
            <DynamicProjectCreation
              request={prompt}
              onComplete={handleProjectComplete}
              onError={handleProjectError}
            />
          </div>
        )}

        {/* Generated App Results */}
        {generatedApp && (
          <div className="mt-12 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-100 mb-6 text-center">Generated Application</h3>
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">{generatedApp.status === 'completed' ? '✅' : '⏳'}</div>
                  <div className="text-slate-400">Status</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {Array.isArray(generatedApp.metrics?.total_tokens) ? generatedApp.metrics.total_tokens[generatedApp.metrics.total_tokens.length - 1] : generatedApp.metrics?.total_tokens || 0}
                  </div>
                  <div className="text-slate-400">Tokens Used</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-200">
                    {generatedApp.metrics?.model_used?.split('/')[1] || generatedApp.metrics?.model_provider || 'AI'}
                  </div>
                  <div className="text-slate-400">Model Used</div>
                </div>
              </div>
              
              {generatedApp.agent_response && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-slate-200 mb-3">Generated Application:</h4>
                  <div className="bg-slate-900/50 rounded-lg p-4 text-sm text-slate-300 border border-slate-600/30 max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{generatedApp.agent_response}</pre>
                  </div>
                </div>
              )}
              
              <div className="text-center">
                <p className="text-slate-400 mb-4">Application saved to: <code className="bg-slate-900/50 border border-slate-600/50 px-2 py-1 rounded text-sm text-slate-300">{generatedApp.generated_app_path}</code></p>
                <button
                  onClick={() => setGeneratedApp(null)}
                  className="px-6 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 rounded-lg border border-slate-600/50 transition-all duration-200 hover:border-slate-500/50"
                >
                  Generate Another App
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Center Panel - Main Content */}
      <div className="flex-1 min-w-0">
        {centerPanelContent}
      </div>

      {/* Right Panel - Knowledge APIs */}
      <div className="hidden lg:block w-80 border-l border-slate-700/50">
        <KnowledgePanel
          onAddKnowledge={handleKnowledgeAdd}
          onRemoveKnowledge={handleKnowledgeRemove}
          onBrowseGallery={handleBrowseGallery}
        />
      </div>
    </div>
  )
}
