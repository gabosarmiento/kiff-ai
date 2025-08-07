import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Database, Book, Zap, Code2, ExternalLink, Copy, Settings, Grid3X3, User, Download, FileText, Eye, Play, Folder, X, ChevronDown, RotateCcw, Shuffle, MessageSquare } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { KnowledgeManager, KnowledgeItem } from '../components/knowledge/KnowledgeManager'
import { DocumentUpload } from '../components/conversation/DocumentUpload';
import { ConversationHistory } from '../components/conversation/ConversationHistory';
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

// FileInfo is the same as GeneratedFile for our use case
type FileInfo = GeneratedFile

interface AppInfo {
  name: string
  description: string
  framework: string
  files: GeneratedFile[]
  status: 'generating' | 'ready' | 'error'
  liveUrl?: string
  downloadUrl?: string
}

interface KnowledgeSource {
  id: string
  name: string
  description: string
}

export function GenerateV0Page() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { tenantId } = useTenant()
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "**Write. Check. Launch.** \n\nReady to create apps with knowledge-rich agents? I leverage real API documentation and examples to build production-ready applications. From concept to deployment - let's kiff something incredible together.\n\n*What would you like to build?*",
      timestamp: new Date()
    }
  ])
  const [sessionId, setSessionId] = useState<string>(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [isLoading, setIsLoading] = useState(false)
  const [input, setInput] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)
  
  // App generation state
  const [currentApp, setCurrentApp] = useState<AppInfo | null>(null)
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  
  // Knowledge state - connected to real knowledge engine
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeItem | null>(null)
  const [isKnowledgePanelOpen, setIsKnowledgePanelOpen] = useState(true);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [isConversationHistoryOpen, setIsConversationHistoryOpen] = useState(false);
  const [conversationHistoryEnabled, setConversationHistoryEnabled] = useState(false);
  const [showKnowledgeManager, setShowKnowledgeManager] = useState(false);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(true);
  
  // Idea generator state
  const [currentIdea, setCurrentIdea] = useState<{idea: string, description: string, suggested_apis: string[]} | null>(null)
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false)
  
  // Model selection state
  const [selectedModel, setSelectedModel] = useState<string>('kimi-k2')
  const [availableModels] = useState([
    {
      id: 'kimi-k2',
      name: 'Kimi K2',
      description: 'Default fast model for general development',
      provider: 'Kimi'
    },
    {
      id: 'gpt-oss-120b',
      name: 'GPT OSS 120B',
      description: 'Large model for complex applications',
      provider: 'OpenAI',
      url: 'https://huggingface.co/openai/gpt-oss-120b'
    },
    {
      id: 'gpt-oss-20b',
      name: 'GPT OSS 20B',
      description: 'Smaller model for faster responses',
      provider: 'OpenAI',
      url: 'https://huggingface.co/openai/gpt-oss-20b'
    }
  ])
  
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

  // Initialize AGNO session with real knowledge integration
  useEffect(() => {
    if (user && !sessionId && !isInitialized) {
      console.log('🚀 Initializing Generate V0 session for user:', user.email)
      initializeSession()
    }
  }, [user, isInitialized])
  
  // Ensure knowledge base is loaded even if session init fails
  useEffect(() => {
    if (user && knowledgeItems.length === 0) {
      console.log('📚 Loading knowledge base for Generate V0...')
      loadRealKnowledgeBase()
    }
  }, [user, knowledgeItems.length])
  
  // Background agent warmup - simulate idea generation to warm up AGNO agent
  useEffect(() => {
    if (user && sessionId && knowledgeItems.length > 0 && !currentIdea) {
      const warmupTimer = setTimeout(() => {
        console.log('🔥 Starting background agent warmup...')
        generateAppIdeaInBackground()
      }, 2000) // Wait 2 seconds after page load
      
      return () => clearTimeout(warmupTimer)
    }
  }, [user, sessionId, knowledgeItems.length, currentIdea])

  // Check conversation history feature flag
  useEffect(() => {
    const checkConversationHistoryFlag = async () => {
      try {
        const response = await fetch('/api/admin/feature-flags/', {
          headers: {
            'x-tenant-id': tenantId || '4485db48-71b7-47b0-8128-c6dca5be352d'
          }
        });
        if (response.ok) {
          const flags = await response.json();
          const conversationHistoryFlag = flags.find((flag: any) => flag.name === 'conversation_history');
          setConversationHistoryEnabled(conversationHistoryFlag?.is_enabled || false);
        }
      } catch (error) {
        console.error('Error checking conversation history flag:', error);
      }
    };
    
    checkConversationHistoryFlag();
  }, [tenantId]);

  // Initialize knowledge sources on component mount
  useEffect(() => {
    loadRealKnowledgeBase();
  }, []);

  const initializeSession = async () => {
    if (isInitialized) return // Prevent duplicate initialization
    
    setIsInitialized(true) // Set flag immediately to prevent race conditions
    
    try {
      const response = await fetch(`http://localhost:8000/api/agno-generation/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-ID': user?.tenant_id || 'demo'
        },
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        const data = await response.json()
        setSessionId(data.session_id)
        console.log('🔥 Generate V0 AGNO session initialized:', data.session_id)
        
        // Load real indexed knowledge
        await loadRealKnowledgeBase()
      } else {
        console.error('Failed to initialize Generate V0 session')
        toast.error('Failed to initialize Generate V0 session')
        setIsInitialized(false) // Reset on error
        // Still load knowledge base even if session fails
        await loadRealKnowledgeBase()
      }
    } catch (error) {
      console.error('Generate V0 session initialization error:', error)
      toast.error('Failed to connect to Generate V0 service')
      setIsInitialized(false) // Reset on error
      // Still load knowledge base even if session fails
      await loadRealKnowledgeBase()
    }
  }

  const loadRealKnowledgeBase = async () => {
    try {
      // Display the REAL AGNO knowledge sources used by Generate V0
      const agnoKnowledgeSources: KnowledgeItem[] = [
        {
          id: 'agno-docs',
          type: 'api_documentation',
          title: '🔥 AGNO Full Documentation',
          content: 'Complete AGNO framework documentation including agents, tools, knowledge bases, and all concepts. This is the primary source for understanding AGNO patterns.',
          relevance_score: 1.0,
          source: 'AGNO Official Docs',
          url: 'https://docs.agno.com/llms-full.txt',
          enabled: true
        },
        {
          id: 'finance-agent',
          type: 'code_pattern',
          title: '💰 Finance Agent Example',
          content: 'Real-world AGNO finance agent implementation showing financial data processing, analysis, and trading strategies using AGNO framework patterns.',
          relevance_score: 0.95,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/finance-agent',
          enabled: true
        },
        {
          id: 'tweet-analysis-agent',
          type: 'code_pattern',
          title: '🐦 Tweet Analysis Agent',
          content: 'AGNO agent for social media analysis, sentiment processing, and content extraction from Twitter/X using modern AGNO tools and workflows.',
          relevance_score: 0.90,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/tweet-analysis-agent',
          enabled: true
        },
        {
          id: 'youtube-agent',
          type: 'code_pattern',
          title: '📺 YouTube Agent',
          content: 'Video content processing agent built with AGNO for transcript analysis, video summarization, and content extraction from YouTube.',
          relevance_score: 0.90,
          source: 'AGNO Examples', 
          url: 'https://docs.agno.com/examples/agents/youtube-agent',
          enabled: true
        },
        {
          id: 'research-agent',
          type: 'code_pattern',
          title: '🔍 Research Agent',
          content: 'Comprehensive research agent using AGNO framework for information gathering, analysis, and report generation from multiple sources.',
          relevance_score: 0.95,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/research-agent',
          enabled: true
        },
        {
          id: 'research-agent-exa',
          type: 'code_pattern',
          title: '🔍 Research Agent (Exa)',
          content: 'Advanced research agent leveraging Exa search capabilities with AGNO framework for enhanced web research and data collection.',
          relevance_score: 0.92,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/research-agent-exa',
          enabled: true
        },
        {
          id: 'teaching-assistant',
          type: 'code_pattern',
          title: '👨‍🏫 Teaching Assistant',
          content: 'Educational AI assistant built with AGNO for tutoring, question answering, and personalized learning experiences.',
          relevance_score: 0.88,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/teaching-assistant',
          enabled: true
        },
        {
          id: 'recipe-creator',
          type: 'code_pattern',
          title: '🍳 Recipe Creator',
          content: 'Culinary AI agent using AGNO patterns for recipe generation, meal planning, and cooking assistance with ingredient analysis.',
          relevance_score: 0.85,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/recipe-creator',
          enabled: true
        },
        {
          id: 'movie-recommender',
          type: 'code_pattern',
          title: '🎬 Movie Recommender',
          content: 'Entertainment recommendation agent built with AGNO for personalized movie suggestions based on preferences and viewing history.',
          relevance_score: 0.85,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/movie-recommender',
          enabled: true
        },
        {
          id: 'books-recommender',
          type: 'code_pattern',
          title: '📚 Books Recommender',
          content: 'Literary recommendation agent using AGNO framework for book discovery, reading suggestions, and literary analysis.',
          relevance_score: 0.85,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/books-recommender',
          enabled: true
        },
        {
          id: 'travel-planner',
          type: 'code_pattern',
          title: '✈️ Travel Planner',
          content: 'Comprehensive travel planning agent built with AGNO for itinerary creation, booking assistance, and travel recommendations.',
          relevance_score: 0.88,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/travel-planner',
          enabled: true
        },
        {
          id: 'startup-analyst',
          type: 'code_pattern',
          title: '🚀 Startup Analyst',
          content: 'Business analysis agent using AGNO patterns for startup evaluation, market research, and investment analysis.',
          relevance_score: 0.92,
          source: 'AGNO Examples',
          url: 'https://docs.agno.com/examples/agents/startup-analyst-agent',
          enabled: true
        }
      ]

      setKnowledgeItems(agnoKnowledgeSources)
      setSelectedKnowledge(agnoKnowledgeSources[0])
      
      console.log(`🔥 Kiff Studio loaded ${agnoKnowledgeSources.length} knowledge-rich agent sources`)
      toast.success(`Connected to ${agnoKnowledgeSources.length} knowledge sources for smarter kiffs!`)
      
    } catch (error) {
      console.error('Failed to load AGNO knowledge sources:', error)
      
      // Fallback message
      const fallbackKnowledge: KnowledgeItem[] = [{
        id: 'agno-knowledge-loading',
        type: 'framework_guide',
        title: '🔗 AGNO Knowledge Loading',
        content: 'Loading AGNO official documentation and example agents. These are the real knowledge sources that power Generate V0 application generation.',
        relevance_score: 0.5,
        source: 'Generate V0 System',
        url: '',
        enabled: true
      }]
      setKnowledgeItems(fallbackKnowledge)
      setSelectedKnowledge(fallbackKnowledge[0])
    }
  }

  // Handle dynamic knowledge changes
  const handleKnowledgeChange = (updatedItems: KnowledgeItem[]) => {
    setKnowledgeItems(updatedItems)
    
    // Update the selected knowledge if it was modified
    if (selectedKnowledge) {
      const updatedSelected = updatedItems.find(item => item.id === selectedKnowledge.id)
      setSelectedKnowledge(updatedSelected || null)
    }
    
    // Log the change for the agent to pick up
    console.log('🔄 Knowledge sources updated:', {
      total: updatedItems.length,
      enabled: updatedItems.filter(item => item.enabled).length,
      disabled: updatedItems.filter(item => !item.enabled).length
    })
    
    // Show feedback
    const enabledCount = updatedItems.filter(item => item.enabled).length
    toast.success(`Knowledge updated! ${enabledCount} sources active`)
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
      // Get enabled knowledge sources
      const enabledKnowledgeSources = knowledgeItems
        .filter(item => item.enabled)
        .map(item => item.url)
      
      // Use AGNO Generation Streaming API for better UX
      const response = await fetch(`http://localhost:8000/api/agno-generation/generate-stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-ID': user?.tenant_id || 'demo'
        },
        body: JSON.stringify({
          user_request: currentInput,
          stream: true,
          knowledge_sources: enabledKnowledgeSources.length > 0 ? enabledKnowledgeSources : undefined,
          model: selectedModel
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
      console.error('Error in Kiff Studio:', error)
      toast.error('Kiff Studio processing failed')
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, Kiff Studio encountered an error. Please check your knowledge sources or try again with a different approach.',
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
      // Legacy events (for compatibility)
      case 'tool_call_started':
        if (content.tool === 'knowledge_retriever') {
          assistantMessage.content = `🔍 Searching real indexed API documentation...`
        }
        break

      case 'tool_call_completed':
        if (content.tool === 'knowledge_retriever') {
          assistantMessage.content = `📚 Found real API knowledge! Using indexed documentation to generate your app...`
          setActiveRightPanel('knowledge')
        }
        break

      // New conversational streaming events
      case 'conversation':
        assistantMessage.content += `${assistantMessage.content ? '\n\n' : ''}${content.message}`
        break

      // Legacy streaming events (for backward compatibility)
      case 'status':
        assistantMessage.content += `\n${content.message}`
        break

      case 'tool_started':
        assistantMessage.content += `\n${content.message}`
        break

      case 'tool_completed':
        assistantMessage.content += `\n${content.message}`
        break

      case 'file_created':
        assistantMessage.content += `\n${content.message}`
        
        // Extract file information from the message and update generatedFiles
        if (content.file_path && content.file_content) {
          const newFile: GeneratedFile = {
            path: content.file_path,
            content: content.file_content,
            type: content.file_path.split('.').pop() || 'txt'
          }
          
          setGeneratedFiles(prev => {
            // Check if file already exists and update it, or add new file
            const existingIndex = prev.findIndex(f => f.path === content.file_path)
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = newFile
              return updated
            } else {
              return [...prev, newFile]
            }
          })
        }
        break

      case 'thinking':
        assistantMessage.content += `\n${content.message}`
        break

      case 'reasoning':
        assistantMessage.content += `\n${content.message}`
        break

      case 'thinking_done':
        assistantMessage.content += `\n${content.message}`
        break

      case 'memory':
        assistantMessage.content += `\n${content.message}`
        break

      case 'tokens':
        assistantMessage.content += `\n${content.message}`
        break

      case 'billing':
        assistantMessage.content += `\n${content.message}`
        break

      case 'completed':
        assistantMessage.content += `\n${content.message}`
        
        // Set up project info from completed event with actual generated files
        const projectInfo: AppInfo = {
          name: content.id || 'Generated Kiff',
          description: content.response || 'AGNO generated kiff application',
          framework: 'FastAPI',
          files: generatedFiles, // Use the actual generated files
          status: 'ready',
          liveUrl: undefined,
          downloadUrl: undefined
        }

        setCurrentApp(projectInfo)
        // Switch to files panel to show the generated files
        setActiveRightPanel('files')
        break

      case 'error':
        assistantMessage.content += `\n❌ ${content.message}`
        break

      case 'content':
        assistantMessage.content += content.chunk || ''
        break

      default:
        if (content.message) {
          assistantMessage.content += `\n${content.message}`
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

  const downloadApp = async () => {
    if (!currentApp) {
      toast.error('No application to download')
      return
    }

    try {
      const response = await fetch(`/api/kiff/generated-apps/${currentApp.name}/download`, {
        method: 'GET',
        headers: {
          ...(tenantId && { 'X-Tenant-ID': tenantId })
        }
      })

      if (!response.ok) {
        throw new Error('Failed to download application')
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${currentApp.name}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Application downloaded successfully!')
    } catch (error) {
      console.error('Error downloading app:', error)
      toast.error('Failed to download application')
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

  // Background warmup - silently generate idea to warm up AGNO agent
  const generateAppIdeaInBackground = async () => {
    try {
      console.log('🔥 Background agent warmup: generating idea silently...')
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-id': '4485db48-71b7-47b0-8128-c6dca5be352d'
      }
      
      const enabledSources = knowledgeItems
        .filter(item => item.enabled)
        .map(item => item.url)
      
      const response = await fetch('http://localhost:8000/api/ideas/generate-idea', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          knowledge_sources: enabledSources.length > 0 ? enabledSources : null
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Background warmup completed - agent is now ready!')
        // Don't set the idea in state - this is just for warmup
      } else {
        console.log('⚠️ Background warmup failed (not critical)')
      }
    } catch (error) {
      console.log('⚠️ Background warmup error (not critical):', error)
    }
  }
  
  // Generate app idea using available knowledge sources
  const generateAppIdea = async () => {
    if (isGeneratingIdea) return
    
    setIsGeneratingIdea(true)
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tenant-id': '4485db48-71b7-47b0-8128-c6dca5be352d'  // Use working UUID that exists in DB
      }
      
      // Get enabled knowledge sources URLs for backend
      const enabledSources = knowledgeItems
        .filter(item => item.enabled)
        .map(item => item.url)
      
      const requestBody = {
        knowledge_sources: enabledSources.length > 0 ? enabledSources : null
      }
      
      console.log('🚀 Idea Generation Request:')
      console.log('- Tenant ID:', tenantId)
      console.log('- Headers:', headers)
      console.log('- Enabled Sources:', enabledSources)
      console.log('- Request Body:', requestBody)
      
      const response = await fetch('http://localhost:8000/api/ideas/generate-idea', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })
      
      console.log('📡 Response Status:', response.status)
      console.log('📡 Response OK:', response.ok)
      
      if (!response.ok) {
        throw new Error('Failed to generate app idea')
      }
      
      const ideaData = await response.json()
      setCurrentIdea(ideaData)
      toast.success('New app idea generated!')
      
    } catch (error) {
      console.error('Error generating app idea:', error)
      toast.error('Failed to generate app idea')
    } finally {
      setIsGeneratingIdea(false)
    }
  }

  // Use generated idea as prompt
  const useGeneratedIdea = () => {
    if (currentIdea) {
      setInput(`Create ${currentIdea.idea}: ${currentIdea.description}`)
      // Clear the idea display after using it
      setCurrentIdea(null)
      // Focus the input field
      if (inputRef.current) {
        inputRef.current.focus()
      }
      toast.success('Idea added to input!')
    }
  }

  // Build file tree structure from flat file list
  const buildFileTree = (files: FileInfo[]): Record<string, any> => {
    const tree: Record<string, any> = {}
    
    files.forEach((file: FileInfo) => {
      const parts: string[] = file.path.split('/')
      let current: Record<string, any> = tree
      
      parts.forEach((part: string, index: number) => {
        if (index === parts.length - 1) {
          // This is a file
          current[part] = file
        } else {
          // This is a directory
          if (!current[part]) {
            current[part] = {}
          }
          current = current[part]
        }
      })
    })
    
    return tree
  }

  // Render file tree with proper folder structure
  const renderFileTree = (files: FileInfo[]): JSX.Element => {
    const tree = buildFileTree(files)
    
    const renderNode = (node: any, name: string, path: string = '', level: number = 0): JSX.Element => {
      const isFile = node.content !== undefined
      const indent = level * 12
      
      if (isFile) {
        return (
          <button
            key={node.path}
            onClick={() => setSelectedFile(node)}
            className={`w-full text-left p-2 rounded-lg transition-colors ${
              selectedFile?.path === node.path
                ? 'bg-blue-500/10 border border-blue-400/30'
                : 'hover:bg-gray-100 dark:hover:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50'
            }`}
            style={{ marginLeft: `${indent}px` }}
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-900 dark:text-slate-200">{name}</span>
            </div>
            <div className="text-xs text-gray-500 ml-6">{node.size} bytes</div>
          </button>
        )
      } else {
        return (
          <div key={path + name}>
            <div 
              className="flex items-center space-x-2 p-2 text-sm font-medium text-gray-700 dark:text-slate-300"
              style={{ marginLeft: `${indent}px` }}
            >
              <Folder className="w-4 h-4 text-blue-500" />
              <span>{name}/</span>
            </div>
            {Object.entries(node).map(([childName, childNode]) => 
              renderNode(childNode, childName, path + name + '/', level + 1)
            )}
          </div>
        )
      }
    }
    
    return (
      <div className="space-y-1">
        {Object.entries(tree).map(([name, node]) => 
          renderNode(node, name, '', 0)
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex bg-white dark:bg-slate-950 relative">

      
      {/* Left Panel - Chat Interface */}
      <div className={`${currentApp ? 'w-1/2' : isKnowledgePanelOpen ? 'w-2/3' : 'flex-1'} flex flex-col border-r border-gray-200 dark:border-slate-700/50 transition-all duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-200">Kiff Studio</h1>
              <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">Write. Check. Launch.</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">

          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[85%] group">
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center border border-purple-400/30">
                      <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                  </div>
                )}

                <div className={`flex-1 ${message.role === 'user' ? 'mr-3' : 'ml-0'}`}>
                  <div className={`p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-purple-500/10 border border-purple-400/20'
                      : 'bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50'
                  }`}>
                    <div 
                      className="text-gray-900 dark:text-slate-200 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                    />
                    
                    {/* Show real knowledge used indicator */}
                    {message.knowledgeUsed && message.knowledgeUsed.length > 0 && (
                      <div className="mt-2 flex items-center space-x-2 text-xs text-purple-600 dark:text-purple-400">
                        <Database className="w-3 h-3" />
                        <span>Used {message.knowledgeUsed.length} real knowledge sources</span>
                      </div>
                    )}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 ml-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-400/30">
                      <User className="w-4 h-4 text-purple-400" />
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
          {/* Generated Idea Display - No button, just the idea content */}
          {currentIdea && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700/30 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                  AI-powered suggestions
                </span>
              </div>
              <div className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                <div className="font-medium mb-1">{currentIdea.idea}</div>
                <div className="text-gray-600 dark:text-slate-400">{currentIdea.description}</div>
              </div>
              {currentIdea.suggested_apis && currentIdea.suggested_apis.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentIdea.suggested_apis.map((api, index) => (
                    <span key={index} className="text-xs bg-purple-100 dark:bg-purple-800/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                      {api}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Enhanced Control Panel */}
          <div className="mb-4 p-3 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10 border border-blue-200/30 dark:border-blue-700/30 rounded-lg">
            {/* Top Row: Idea Generator */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={generateAppIdea}
                  disabled={isGeneratingIdea}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 px-3 py-2 rounded-lg text-xs font-medium flex items-center space-x-2 shadow-sm"
                >
                  {isGeneratingIdea ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      {currentIdea ? (
                        <Shuffle className="w-3 h-3" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      <span>Get Inspiration</span>
                    </>
                  )}
                </button>
                
                {/* Use Idea button */}
                {currentIdea && (
                  <button
                    onClick={useGeneratedIdea}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center space-x-2 shadow-sm"
                  >
                    <span>Use This Idea</span>
                  </button>
                )}
                
                <span className="text-xs text-gray-400 dark:text-slate-500">AI-powered suggestions</span>
              </div>
            </div>
            
            {/* Bottom Row: Model Selection */}
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">
                  Knowledge Agent
                </label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent appearance-none cursor-pointer shadow-sm"
                    disabled={isLoading}
                  >
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} - {model.description}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Provider</div>
                <div className="text-xs font-medium text-purple-600 dark:text-purple-400">
                  {availableModels.find(m => m.id === selectedModel)?.provider}
                </div>
              </div>
            </div>
            
            {selectedModel !== 'kimi-k2' && (
              <div className="mt-2 text-xs text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-800/50">
                ⚡ Using hosted model: {availableModels.find(m => m.id === selectedModel)?.name}
              </div>
            )}
          </div>
          
          {/* Enhanced Input Area */}
          <div className="bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 rounded-xl shadow-lg transition-all duration-200 focus-within:border-purple-400 focus-within:shadow-purple-100/50 dark:focus-within:shadow-purple-900/20">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Ready to Build</span>
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500">
                  Knowledge-rich agents • Production ready
                </div>
              </div>
              
              <div className="relative">
                <textarea
                  ref={(textarea: HTMLTextAreaElement | null) => {
                    Object.assign(inputRef, { current: textarea })
                    if (textarea) {
                      textarea.style.height = 'auto'
                      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
                    }
                  }}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    const newHeight = Math.min(target.scrollHeight, 240)
                    target.style.height = newHeight + 'px'
                    
                    if (target.scrollHeight > 240) {
                      target.style.overflowY = 'auto'
                    } else {
                      target.style.overflowY = 'hidden'
                    }
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={isLoading ? "Kiff Studio is building your app... Please wait" : "Describe your vision and let's kiff it into reality..."}
                  className={`w-full p-4 pr-16 rounded-lg resize-none text-base transition-all duration-200 border-0 focus:outline-none ${
                    isLoading 
                      ? 'bg-gray-50 dark:bg-slate-800/30 text-gray-400 dark:text-slate-500 placeholder-gray-400 dark:placeholder-slate-500 cursor-not-allowed'
                      : 'bg-gray-50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400'
                  }`}
                  rows={1}
                  style={{ minHeight: '56px', height: 'auto' }}
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  title={isLoading ? "Kiff Studio is processing..." : "Let's kiff it!"}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-3 rounded-lg transition-all duration-200 ${
                    isLoading
                      ? 'bg-gray-200 dark:bg-slate-700 cursor-not-allowed'
                      : !input.trim()
                      ? 'bg-gray-200 dark:bg-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-purple-200 dark:hover:shadow-purple-900/50'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <Send className={`w-4 h-4 ${
                      !input.trim() || isLoading ? 'text-gray-400' : 'text-white'
                    }`} />
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-slate-400">
                <div className="flex items-center space-x-2">
                  <span>💡</span>
                  <span>Try: "Build a task manager with real-time collaboration"</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>Press</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 rounded text-xs">Enter</kbd>
                  <span>to kiff</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Files & Preview */}
      {currentApp && (
        <div className="w-1/2 flex flex-col relative">
          <>
            {/* App Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center border border-green-400/30">
                  <Code2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200">{currentApp.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400">{currentApp.framework} • Generate V0</p>
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
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {activeRightPanel === 'files' && (
                <div className="h-full flex">
                  {/* File Tree */}
                  <div className="w-1/3 border-r border-gray-200 dark:border-slate-700/50 overflow-y-auto">
                    <div className="p-2">
                      {renderFileTree(generatedFiles)}
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
                      Your Generate V0 app is running at {currentApp.liveUrl}
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
            </div>
          </>
        </div>
      )}

      {/* Right Sidebar - Groq-style Parameters Panel */}
      <div className={`${isKnowledgePanelOpen ? 'w-1/3' : 'w-12'} flex flex-col border-l border-gray-200 dark:border-slate-700/50 bg-white dark:bg-slate-950 transition-all duration-300`}>
        {isKnowledgePanelOpen ? (
          <>
            {/* Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/30">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-200 uppercase tracking-wide">Knowledge Sources</h3>
          </div>
          <button
            onClick={() => setIsKnowledgePanelOpen(false)}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="Close Knowledge Panel"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

          {/* Knowledge Sources Count */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-slate-800/30 border-b border-gray-200 dark:border-slate-700/50">
            <div className="text-xs text-gray-600 dark:text-slate-400">
              {knowledgeItems.filter(item => item.enabled).length} of {knowledgeItems.length} sources enabled
            </div>
          </div>

          {/* Knowledge Management Toggle */}
          <div className="p-3 border-b border-gray-200 dark:border-slate-700/50">
            <button
              onClick={() => setShowKnowledgeManager(!showKnowledgeManager)}
              className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                showKnowledgeManager 
                  ? 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">{showKnowledgeManager ? 'View Sources' : 'Manage Sources'}</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${
                showKnowledgeManager ? 'rotate-180' : ''
              }`} />
            </button>
          </div>

          {/* Knowledge Content */}
          <div className="flex-1 overflow-y-auto">
            {showKnowledgeManager ? (
              <div className="p-3 space-y-4">
                <KnowledgeManager
                  knowledgeItems={knowledgeItems}
                  onKnowledgeChange={handleKnowledgeChange}
                />
                
                {/* Document Upload Section */}
                <div className="border-t border-gray-200 dark:border-slate-700/50 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    📄 Session Documents
                  </h4>
                  <DocumentUpload
                    sessionId={sessionId}
                    onDocumentUploaded={(filename) => {
                      console.log(`Document uploaded: ${filename} for session: ${sessionId}`)
                      toast.success(`Document "${filename}" will be included in your conversation context`)
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {knowledgeItems.filter(item => item.enabled).map((item, index) => (
                  <button
                    key={item.id || index}
                    onClick={() => setSelectedKnowledge(item)}
                    className={`w-full text-left p-2 rounded-lg transition-colors border ${
                      selectedKnowledge === item
                        ? 'bg-emerald-500/10 border-emerald-400/30'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-800/50 border-gray-200 dark:border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <div className={`flex-shrink-0 w-4 h-4 rounded-md flex items-center justify-center mt-0.5 ${
                        item.type === 'api_documentation' ? 'bg-blue-500/20 text-blue-400' :
                        item.type === 'framework_guide' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {item.type === 'api_documentation' ? <Book className="w-2.5 h-2.5" /> :
                         item.type === 'framework_guide' ? <Zap className="w-2.5 h-2.5" /> :
                         <Code2 className="w-2.5 h-2.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-slate-200 truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {item.content}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {knowledgeItems.filter(item => item.enabled).length === 0 && (
                  <div className="text-center text-gray-500 dark:text-slate-400 py-6">
                    <Database className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No knowledge sources enabled</p>
                    <p className="text-xs mt-1">Click "Manage Sources" to add sources</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Knowledge Detail */}
          {selectedKnowledge && (
            <div className="border-t border-gray-200 dark:border-slate-700/50 p-3 bg-gray-50 dark:bg-slate-800/30 max-h-32 overflow-y-auto">
              <div className="text-xs">
                <div className="font-medium text-gray-900 dark:text-slate-200 mb-1">
                  {selectedKnowledge.title}
                </div>
                <div className="text-gray-600 dark:text-slate-400 text-xs leading-relaxed">
                  {selectedKnowledge.content}
                </div>
                {selectedKnowledge.url && (
                  <button
                    onClick={() => window.open(selectedKnowledge.url, '_blank')}
                    className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>View Source</span>
                  </button>
                )}
              </div>
            </div>
          )}
          </>
        ) : (
        <div className="flex flex-col items-center justify-start h-full pt-4">
          <button
            onClick={() => setIsKnowledgePanelOpen(true)}
            className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
            title="Show Knowledge Panel"
          >
            <Database className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </div>
  )
}