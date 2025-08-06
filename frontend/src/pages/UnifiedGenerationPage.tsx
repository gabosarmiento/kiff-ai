import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Download, Eye, Code2, FileText, Folder, Play, ExternalLink, Maximize2, Minimize2, Book, Database, Zap, Grid3X3 } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  generatedFiles?: GeneratedFile[]
  appInfo?: AppInfo
  knowledgeUsed?: KnowledgeItem[]
}

interface GeneratedFile {
  name: string
  path: string
  content: string
  language: string
  size: number
}

interface AppInfo {
  name: string
  description: string
  framework: string
  files: GeneratedFile[]
  status: 'generating' | 'ready' | 'error'
  liveUrl?: string
  downloadUrl?: string
}

interface KnowledgeItem {
  type: 'api_documentation' | 'code_pattern' | 'framework_guide'
  title: string
  content: string
  relevance_score: number
  source: string
  url?: string
}

export function UnifiedGenerationPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI development assistant powered by AGNO. I can help you build applications using the knowledge from indexed APIs. What would you like to create today?",
      timestamp: new Date()
    }
  ])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // App generation state
  const [currentApp, setCurrentApp] = useState<AppInfo | null>(null)
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  
  // Knowledge state
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeItem | null>(null)
  
  // UI state
  const [layout, setLayout] = useState<'2-column' | '3-column'>('3-column')
  const [activeRightPanel, setActiveRightPanel] = useState<'preview' | 'files' | 'knowledge'>('knowledge')
  const [previewMode, setPreviewMode] = useState<'live' | 'code'>('live')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize AGNO session
  useEffect(() => {
    if (user && !sessionId) {
      initializeSession()
    }
  }, [user])

  const initializeSession = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/agno-chat/session?user_id=${user?.id || 'demo_user'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const data = await response.json()
        setSessionId(data.session_id)
        console.log('AGNO session initialized:', data.session_id)
        
        // Load initial knowledge
        await loadKnowledgeBase()
      } else {
        console.error('Failed to initialize AGNO session')
        toast.error('Failed to initialize chat session')
      }
    } catch (error) {
      console.error('Session initialization error:', error)
      toast.error('Failed to connect to AGNO service')
    }
  }

  const loadKnowledgeBase = async () => {
    try {
      // Load the actual selected/indexed APIs from the knowledge system
      const response = await fetch(`http://localhost:8000/api/knowledge/bases`, {
        headers: {
          'X-Tenant-ID': user?.tenant_id || 'demo'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const knowledgeBases = data.knowledge_bases || []
        
        // Transform knowledge bases to KnowledgeItem format
        const selectedApis: KnowledgeItem[] = knowledgeBases
          .filter((kb: any) => kb.status === 'indexed') // Only show indexed APIs
          .map((kb: any) => ({
            type: 'api_documentation' as const,
            title: `${kb.name} API`,
            content: `${kb.description || `${kb.name} API documentation with ${kb.document_count || 0} indexed sections.`} Available for code generation and integration.`,
            relevance_score: 1.0, // Selected APIs have highest relevance
            source: `${kb.name} Documentation`,
            url: kb.source_url,
            api_id: kb.id,
            document_count: kb.document_count || 0,
            last_indexed: kb.updated_at
          }))
        
        if (selectedApis.length === 0) {
          // Show message about selecting APIs if none are available
          const noApisSelected: KnowledgeItem[] = [{
            type: 'framework_guide',
            title: 'No APIs Selected',
            content: 'Go to the API Gallery to select and index APIs for use in code generation. Once indexed, their documentation will appear here and be available for AI-powered development.',
            relevance_score: 0.5,
            source: 'System Message'
          }]
          setKnowledgeItems(noApisSelected)
          setSelectedKnowledge(noApisSelected[0])
        } else {
          setKnowledgeItems(selectedApis)
          setSelectedKnowledge(selectedApis[0])
          
          // Show success message about available APIs
          const apiNames = selectedApis.map(api => api.title).join(', ')
          console.log(`📚 Loaded ${selectedApis.length} indexed APIs: ${apiNames}`)
        }
      } else {
        throw new Error('Failed to load knowledge bases')
      }
    } catch (error) {
      console.error('Failed to load selected APIs:', error)
      
      // Fallback to show message about selecting APIs
      const fallbackKnowledge: KnowledgeItem[] = [{
        type: 'framework_guide',
        title: 'Connect to API Gallery',
        content: 'Unable to load selected APIs. Please visit the API Gallery to select and index APIs that you want to use for code generation. Once indexed, their documentation will be available here.',
        relevance_score: 0.5,
        source: 'System Message'
      }]
      setKnowledgeItems(fallbackKnowledge)
      setSelectedKnowledge(fallbackKnowledge[0])
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !sessionId) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`http://localhost:8000/api/agno-chat/message?session_id=${sessionId}&user_id=${user?.id || 'demo_user'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      let assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6))
              await handleAgentEvent(eventData, assistantMessage)
            } catch (e) {
              console.error('Error parsing event:', e)
            }
          }
        }
      }

    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to process your request')
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAgentEvent = async (eventData: any, assistantMessage: ChatMessage) => {
    const { type, content } = eventData

    switch (type) {
      case 'KnowledgeSearchCompleted':
        // Update knowledge panel with relevant items found
        if (content.knowledge && content.knowledge.length > 0) {
          setKnowledgeItems(content.knowledge)
          setSelectedKnowledge(content.knowledge[0])
          assistantMessage.knowledgeUsed = content.knowledge
          setActiveRightPanel('knowledge')
        }
        assistantMessage.content = `📚 Found ${content.knowledge?.length || 0} relevant resources. Analyzing...`
        break

      case 'ToolCallCompleted':
        if (content.result && content.result.files) {
          const projectInfo: AppInfo = {
            name: content.result.name,
            description: content.result.description,
            framework: content.result.framework,
            files: content.result.files.map((file: any) => ({
              name: file.name,
              path: file.path,
              content: file.content,
              language: file.language,
              size: file.size
            })),
            status: content.result.status,
            liveUrl: content.result.live_url,
            downloadUrl: content.result.download_url
          }

          setCurrentApp(projectInfo)
          setGeneratedFiles(projectInfo.files)
          setSelectedFile(projectInfo.files[0])
          setActiveRightPanel('files')
          
          assistantMessage.generatedFiles = projectInfo.files
          assistantMessage.appInfo = projectInfo
        }
        break

      case 'RunResponseContent':
        assistantMessage.content = content.message
        if (content.project) {
          const projectInfo: AppInfo = {
            name: content.project.name,
            description: content.project.description,
            framework: content.project.framework,
            files: content.project.files || [],
            status: content.project.status,
            liveUrl: content.project.live_url,
            downloadUrl: content.project.download_url
          }
          assistantMessage.appInfo = projectInfo
        }
        break

      default:
        // Handle other event types with status updates
        if (content.message) {
          assistantMessage.content = content.message
        }
    }

    // Update the message in state
    setMessages(prev => prev.map(msg => 
      msg.id === assistantMessage.id ? { ...assistantMessage } : msg
    ))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const downloadApp = () => {
    if (currentApp?.downloadUrl) {
      window.open(currentApp.downloadUrl, '_blank')
      toast.success('Download started!')
    }
  }

  const openLivePreview = () => {
    if (currentApp?.liveUrl) {
      window.open(currentApp.liveUrl, '_blank')
    }
  }

  const formatContent = (content: string): string => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, `<code class="bg-slate-800 dark:bg-slate-700 px-1 py-0.5 rounded text-sm">$1</code>`)
      .replace(/```([\s\S]*?)```/g, `<pre class="bg-slate-800 dark:bg-slate-700 p-3 rounded-lg overflow-x-auto my-2"><code>$1</code></pre>`)
  }

  return (
    <div className="h-full flex bg-white dark:bg-slate-950">
      {/* Left Panel - Chat Interface */}
      <div className={`${layout === '3-column' ? 'w-1/3' : 'w-1/2'} flex flex-col border-r border-gray-200 dark:border-slate-700/50 transition-all duration-300`}>
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-400/30">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-200">AI Developer</h2>
              <p className="text-xs text-gray-600 dark:text-slate-400">AGNO-powered generation</p>
            </div>
          </div>
          
          <button
            onClick={() => setLayout(layout === '3-column' ? '2-column' : '3-column')}
            className="p-1.5 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-400/30 rounded-lg transition-colors"
            title={layout === '3-column' ? 'Switch to 2-column' : 'Switch to 3-column'}
          >
            <Grid3X3 className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[85%] group">
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-cyan-400/30">
                      <Bot className="w-4 h-4 text-cyan-400" />
                    </div>
                  </div>
                )}

                <div className={`flex-1 ${message.role === 'user' ? 'mr-3' : 'ml-0'}`}>
                  <div className={`p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500/10 border border-blue-400/20'
                      : 'bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50'
                  }`}>
                    <div 
                      className="text-gray-900 dark:text-slate-200 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                    />
                    
                    {/* Show knowledge used indicator */}
                    {message.knowledgeUsed && message.knowledgeUsed.length > 0 && (
                      <div className="mt-2 flex items-center space-x-2 text-xs text-cyan-600 dark:text-cyan-400">
                        <Database className="w-3 h-3" />
                        <span>Used {message.knowledgeUsed.length} knowledge sources</span>
                      </div>
                    )}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 ml-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700/50">
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={(textarea) => {
                  inputRef.current = textarea
                  if (textarea) {
                    // Set initial height
                    textarea.style.height = 'auto'
                    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
                  }
                }}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Auto-expand textarea up to ~12 lines (240px), then scroll
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  const newHeight = Math.min(target.scrollHeight, 240) // ~12 lines at 20px line height
                  target.style.height = newHeight + 'px'
                  
                  // Show scroll when content exceeds max height
                  if (target.scrollHeight > 240) {
                    target.style.overflowY = 'auto'
                  } else {
                    target.style.overflowY = 'hidden'
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder={isLoading ? "AI is thinking... Please wait for your turn to respond" : "Describe the application you want to build using available APIs..."}
                className={`w-full p-3 pr-12 rounded-lg resize-none transition-all duration-200 ${
                  isLoading 
                    ? 'bg-gray-100 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-600/30 text-gray-400 dark:text-slate-500 placeholder-gray-400 dark:placeholder-slate-500 cursor-not-allowed'
                    : 'bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600/50 text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent'
                }`}
                rows={1}
                style={{ minHeight: '48px', height: 'auto' }}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                title={isLoading ? "AI is processing... Please wait for your turn" : "Send message"}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-all duration-200 ${
                  isLoading
                    ? 'bg-slate-700/30 border border-slate-600/30 cursor-not-allowed'
                    : !input.trim()
                    ? 'bg-slate-700/30 border border-slate-600/30 cursor-not-allowed'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 hover:border-cyan-400/50'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Send className={`w-4 h-4 ${
                    !input.trim() || isLoading ? 'text-slate-400' : 'text-cyan-400'
                  }`} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Panel - Knowledge (3-column only) */}
      {layout === '3-column' && (
        <div className="w-1/3 flex flex-col border-r border-gray-200 dark:border-slate-700/50">
          {/* Knowledge Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-lg flex items-center justify-center border border-emerald-400/30">
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200">Knowledge Base</h3>
                <p className="text-xs text-gray-600 dark:text-slate-400">Indexed API documentation</p>
              </div>
            </div>
          </div>

          {/* Knowledge List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {knowledgeItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedKnowledge(item)}
                  className={`w-full text-left p-3 mb-2 rounded-lg transition-colors ${
                    selectedKnowledge === item
                      ? 'bg-emerald-500/10 border border-emerald-400/30'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 ${
                      item.type === 'api_documentation' ? 'bg-blue-500/20 text-blue-400' :
                      item.type === 'framework_guide' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {item.type === 'api_documentation' ? <Book className="w-3 h-3" /> :
                       item.type === 'framework_guide' ? <Zap className="w-3 h-3" /> :
                       <Code2 className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-200 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {item.content}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{item.source}</span>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            item.relevance_score > 0.8 ? 'bg-green-400' :
                            item.relevance_score > 0.6 ? 'bg-yellow-400' : 'bg-gray-400'
                          }`} />
                          <span className="text-xs text-gray-400">
                            {Math.round(item.relevance_score * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Knowledge Detail */}
          {selectedKnowledge && (
            <div className="border-t border-gray-200 dark:border-slate-700/50 p-4 bg-gray-50 dark:bg-slate-800/30">
              <div className="text-sm">
                <div className="font-medium text-gray-900 dark:text-slate-200 mb-2">
                  {selectedKnowledge.title}
                </div>
                <div className="text-gray-600 dark:text-slate-400 text-xs leading-relaxed">
                  {selectedKnowledge.content}
                </div>
                {selectedKnowledge.url && (
                  <button
                    onClick={() => window.open(selectedKnowledge.url, '_blank')}
                    className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Source</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right Panel - Files & Preview */}
      <div className={`${layout === '3-column' ? 'w-1/3' : 'w-1/2'} flex flex-col`}>
        {currentApp ? (
          <>
            {/* App Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center border border-green-400/30">
                  <Code2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200">{currentApp.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400">{currentApp.framework}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadApp}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/30 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400">Download</span>
                </button>
                
                <button
                  onClick={openLivePreview}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-400/30 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Live</span>
                </button>
              </div>
            </div>

            {/* Panel Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700/50">
              <button
                onClick={() => setActiveRightPanel('files')}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeRightPanel === 'files'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Files</span>
              </button>
              
              <button
                onClick={() => setActiveRightPanel('preview')}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeRightPanel === 'preview'
                    ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </button>
              
              {layout === '2-column' && (
                <button
                  onClick={() => setActiveRightPanel('knowledge')}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeRightPanel === 'knowledge'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>Knowledge</span>
                </button>
              )}
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {activeRightPanel === 'files' && (
                <div className="h-full flex">
                  {/* File List */}
                  <div className="w-1/3 border-r border-gray-200 dark:border-slate-700/50 overflow-y-auto">
                    <div className="p-2">
                      {generatedFiles.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file)}
                          className={`w-full text-left p-2 rounded-lg transition-colors ${
                            selectedFile?.path === file.path
                              ? 'bg-blue-500/10 border border-blue-400/30'
                              : 'hover:bg-gray-100 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-900 dark:text-slate-200">{file.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 ml-6">{file.size} bytes</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* File Content */}
                  <div className="w-2/3">
                    {selectedFile ? (
                      <pre className="h-full p-4 bg-slate-900 text-slate-200 text-sm overflow-auto font-mono">
                        <code>{selectedFile.content}</code>
                      </pre>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500 dark:text-slate-400">
                        Select a file to view its contents
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeRightPanel === 'preview' && (
                <div className="h-full bg-white dark:bg-slate-900 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center border border-green-400/30 mx-auto mb-4">
                      <Play className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200 mb-2">Live Preview</h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-4">
                      Your application is running at {currentApp.liveUrl}
                    </p>
                    <button
                      onClick={openLivePreview}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-400/30 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Open in New Tab</span>
                    </button>
                  </div>
                </div>
              )}

              {activeRightPanel === 'knowledge' && layout === '2-column' && (
                <div className="h-full overflow-y-auto p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-slate-200 mb-3">Available Knowledge</h4>
                  <div className="space-y-2">
                    {knowledgeItems.map((item, index) => (
                      <div key={index} className="p-3 border border-gray-200 dark:border-slate-700/50 rounded-lg">
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-200">{item.title}</div>
                        <div className="text-xs text-gray-600 dark:text-slate-400 mt-1">{item.content.slice(0, 100)}...</div>
                        <div className="text-xs text-gray-400 mt-2">{item.source}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-cyan-400/30 mx-auto mb-4">
                <Bot className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200 mb-2">Ready to Build</h3>
              <p className="text-gray-600 dark:text-slate-400">
                Start a conversation to generate your application using indexed API knowledge.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}