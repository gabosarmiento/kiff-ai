import React, { useState } from 'react'
import { 
  Zap, 
  ArrowUp, 
  Database,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  File,
  CheckCircle,
  Clock,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Code,
  Sparkles
} from 'lucide-react'
import { useStore } from '@/store/useStore'

interface GeneratedFile {
  name: string
  path: string
  content: string
  status: 'generating' | 'completed'
}

interface KnowledgeSource {
  id: string
  name: string
  description: string
  enabled: boolean
}

interface AgentProgress {
  stage: string
  message: string
  timestamp: string
}

export const AppBuilderInterface: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useStore()
  const [appDescription, setAppDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([
    { id: 'openai', name: 'OpenAI', description: 'GPT models, embeddings', enabled: true },
    { id: 'stripe', name: 'Stripe', description: 'Payments, subscriptions', enabled: false },
    { id: 'leonardo-ai', name: 'Leonardo AI', description: 'AI image generation', enabled: false },
    { id: 'agno', name: 'AGNO Framework', description: 'Multi-agent systems', enabled: true }
  ])

  const toggleKnowledgeSource = (sourceId: string) => {
    setKnowledgeSources(sources => 
      sources.map(source => 
        source.id === sourceId 
          ? { ...source, enabled: !source.enabled }
          : source
      )
    )
  }

  const startGeneration = async () => {
    if (!appDescription.trim()) return
    
    setIsGenerating(true)
    setAgentProgress([])
    setGeneratedFiles([])
    
    const enabledKnowledge = knowledgeSources
      .filter(source => source.enabled)
      .map(source => source.id)
    
    try {
      const ws = new WebSocket('ws://localhost:8000/ws/create-project')
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          request: appDescription,
          knowledge_sources: enabledKnowledge,
          agent_config: {
            use_agno_tools: true,
            enable_cross_agent_knowledge: true
          }
        }))
      }
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'agent_progress':
            setAgentProgress(prev => [...prev, {
              stage: data.stage,
              message: data.message,
              timestamp: new Date().toISOString()
            }])
            break
            
          case 'file_created':
            setGeneratedFiles(prev => [...prev, {
              name: data.file_name,
              path: data.file_path,
              content: data.file_content,
              status: 'completed'
            }])
            break
            
          case 'generation_completed':
            setIsGenerating(false)
            ws.close()
            break
        }
      }
      
    } catch (error) {
      console.error('Error:', error)
      setIsGenerating(false)
    }
  }

  const downloadProject = () => {
    if (generatedFiles.length === 0) return
    
    let projectBundle = `# Generated Application\n\n${appDescription}\n\n## Files:\n\n`
    generatedFiles.forEach(file => {
      projectBundle += `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`
    })
    
    const blob = new Blob([projectBundle], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'generated-app.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
      {/* Collapsible Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-0' : 'w-80'} transition-all duration-300 overflow-hidden bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50 flex flex-col shadow-xl`}>
        <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          <h2 className={`font-bold text-gray-900 dark:text-white ${sidebarCollapsed ? 'hidden' : 'block'} flex items-center space-x-2`}>
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Configuration</span>
          </h2>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-white/60 dark:hover:bg-gray-600/60 rounded-lg transition-all duration-200 hover:shadow-md"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <ChevronLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          </button>
        </div>
        <div className={`flex-1 p-4 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Knowledge Sources</span>
              </h3>
              <div className="space-y-3">
                {knowledgeSources.map((source) => (
                  <label key={source.id} className="flex items-center space-x-3 p-4 rounded-xl border-2 border-gray-200/60 dark:border-gray-600/60 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-gray-700 dark:hover:to-gray-600 cursor-pointer transition-all duration-200 hover:shadow-lg group">
                    <input
                      type="checkbox"
                      checked={source.enabled}
                      onChange={() => toggleKnowledgeSource(source.id)}
                      className="rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{source.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">{source.description}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-400 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-white via-blue-50 to-indigo-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 border-b border-blue-200/50 dark:border-gray-600/50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <span>AI Developer</span>
              </h1>
              <p className="text-gray-700 dark:text-gray-300 mt-2 font-medium">AGNO-powered generation with comprehensive API knowledge</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
              <div className="flex items-center gap-2">
                <Zap className="text-blue-600 dark:text-blue-400" size={24} />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Build something</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {generatedFiles.length > 0 && (
                <button
                  onClick={downloadProject}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Download size={16} />
                  Download
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Interface */}
        <div className="flex-1 flex">
          {!isGenerating && generatedFiles.length === 0 ? (
            /* Initial Input Interface - Lovable.dev Style */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-2xl w-full space-y-8">
                <div className="text-center space-y-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl transform hover:scale-105 transition-transform duration-300">
                      <Code className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -inset-1 bg-gradient-to-br from-blue-400 to-purple-600 rounded-2xl blur opacity-30 animate-pulse"></div>
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
                    Ready to Build
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 text-lg font-medium">
                    Start a conversation to generate your application using indexed API knowledge.
                  </p>
                </div>
                
                {/* Main Input */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                  <div className="relative bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-600 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-all duration-200 shadow-lg">
                    <textarea
                      value={appDescription}
                      onChange={(e) => {
                        setAppDescription(e.target.value)
                        // Auto-expand textarea
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = Math.min(target.scrollHeight, 400) + 'px'
                      }}
                      placeholder="Describe the application you want to build... ✨"
                      className="w-full min-h-[120px] max-h-[400px] p-6 bg-transparent resize-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-lg leading-relaxed overflow-y-auto"
                      style={{ height: 'auto' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          startGeneration()
                        }
                      }}
                      ref={(textarea) => {
                        if (textarea) {
                          // Set initial height based on content
                          textarea.style.height = 'auto'
                          textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px'
                        }
                      }}
                    />
                    <div className="absolute bottom-4 right-4 flex items-center space-x-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {appDescription.length > 0 && `${appDescription.length} characters`}
                      </div>
                      <button
                        onClick={startGeneration}
                        disabled={!appDescription.trim()}
                        className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 text-white px-6 py-3 rounded-xl font-bold transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none disabled:hover:shadow-lg"
                      >
                        <Sparkles className="w-5 h-5" />
                        <span>Generate App</span>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Knowledge Sources */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center space-x-2">
                    <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>Select Knowledge Sources</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {knowledgeSources.map((source) => (
                      <button
                        key={source.id}
                        onClick={() => toggleKnowledgeSource(source.id)}
                        className={`group p-4 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                          source.enabled
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-md'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gradient-to-br hover:from-gray-50 hover:to-blue-50 dark:hover:from-gray-800 dark:hover:to-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`text-sm font-bold transition-colors ${
                            source.enabled 
                              ? 'text-blue-700 dark:text-blue-300' 
                              : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`}>
                            {source.name}
                          </div>
                          {source.enabled && (
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <div className={`text-xs transition-colors ${
                          source.enabled
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                        }`}>
                          {source.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Quick Starters */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Quick Starters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { icon: '💳', text: 'Bill splitter' },
                      { icon: '🛒', text: 'E-commerce store' },
                      { icon: '🌤️', text: 'Weather dashboard' },
                      { icon: '💼', text: 'Personal website' }
                    ].map((starter, index) => (
                      <button
                        key={index}
                        onClick={() => setAppDescription(starter.text)}
                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-left"
                      >
                        <span className="text-xl">{starter.icon}</span>
                        <span className="text-gray-900 dark:text-white">{starter.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Generation Interface - 2 Column Layout */
            <div className="flex-1 flex">
              {/* Left Column - Progress & Files */}
              <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                {/* Progress */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Agent Progress</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {agentProgress.map((progress, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        {progress.stage === 'completed' ? (
                          <CheckCircle className="text-green-500 mt-0.5" size={14} />
                        ) : progress.stage === 'error' ? (
                          <div className="w-3.5 h-3.5 bg-red-500 rounded-full mt-0.5" />
                        ) : (
                          <Clock className="text-blue-500 mt-0.5" size={14} />
                        )}
                        <span className="text-gray-700 dark:text-gray-300">{progress.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Files */}
                <div className="flex-1 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">Generated Files</h3>
                    <span className="text-sm text-gray-500">{generatedFiles.length} files</span>
                  </div>
                  <div className="space-y-2">
                    {generatedFiles.map((file, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedFile(file.path)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          selectedFile === file.path
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <File className="text-gray-400" size={16} />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">{file.name}</div>
                          <div className="text-xs text-gray-500">{file.path}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Code/Preview */}
              <div className="w-1/2 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {selectedFile ? `Code: ${selectedFile}` : 'Select a file to view'}
                  </h3>
                </div>
                <div className="flex-1 p-4">
                  {selectedFile && generatedFiles.find(f => f.path === selectedFile) ? (
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-auto text-sm">
                      <code>{generatedFiles.find(f => f.path === selectedFile)?.content}</code>
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      Select a file to view its content
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
