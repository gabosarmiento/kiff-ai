import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Sparkles, Code, Grid3X3 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: Array<{
    name: string
    status: 'running' | 'completed' | 'error'
    result?: any
  }>
  streaming?: boolean
}

interface ConversationalChatProps {
  onLayoutToggle?: () => void
  showLayoutToggle?: boolean
  onPreviewGenerated?: (previewData: any) => void
}

export function ConversationalChat({ 
  onLayoutToggle, 
  showLayoutToggle = true,
  onPreviewGenerated 
}: ConversationalChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Initialize AGNO session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Create AGNO session
        const response = await fetch(`/api/agno-chat/session?user_id=${user?.id || 'anonymous'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        })
        
        if (response.ok) {
          const data = await response.json()
          setSessionId(data.session_id)
          console.log('✅ AGNO session created:', data.session_id)
        } else {
          // Fallback to client-generated session ID
          const fallbackSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          setSessionId(fallbackSessionId)
          console.warn('⚠️ Using fallback session ID:', fallbackSessionId)
        }
      } catch (error) {
        console.error('Error creating AGNO session:', error)
        // Fallback to client-generated session ID
        const fallbackSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        setSessionId(fallbackSessionId)
      }
    }
    
    initializeSession()
    
    // Add welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your AI development assistant powered by knowledge-driven tools. I can help you build applications by leveraging indexed API documentation and best practices.

**What I can do:**
• Generate applications with API-aware code
• Analyze your project structure and suggest improvements  
• Query indexed API documentation for accurate implementations
• Evolve your project tasks intelligently
• Provide real-time previews and feedback

What would you like to build today?`,
      timestamp: new Date()
    }])
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/agno-chat/message?session_id=${sessionId}&user_id=${user?.id || 'anonymous'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        streaming: true,
        toolCalls: []
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
              const data = JSON.parse(line.slice(6))
              
              // Handle AGNO streaming event types
              if (data.type === 'RunStarted') {
                // Agent started processing - show thinking indicator
                console.log('🚀 AGNO Agent started:', data.content?.message)
              } else if (data.type === 'AgentThinking') {
                // Show thinking status
                console.log('🧠 Agent thinking:', data.content?.message)
              } else if (data.type === 'ContentChunk') {
                // Real-time content streaming - append each chunk
                const chunk = data.content?.chunk || ''
                if (chunk) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: msg.content + chunk }
                      : msg
                  ))
                }
              } else if (data.type === 'ReasoningStep') {
                // Show reasoning process
                console.log('🔍 Reasoning:', data.content?.message)
              } else if (data.type === 'ToolCallStarted') {
                // Tool usage started
                const toolName = data.content?.tool_name || 'unknown'
                console.log('🔧 Tool started:', toolName)
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { 
                        ...msg, 
                        toolCalls: [...(msg.toolCalls || []), {
                          name: toolName,
                          status: 'running',
                          result: null
                        }]
                      }
                    : msg
                ))
              } else if (data.type === 'ToolCallCompleted') {
                // Tool usage completed
                const toolName = data.content?.tool_name || 'unknown'
                console.log('✅ Tool completed:', toolName)
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { 
                        ...msg, 
                        toolCalls: (msg.toolCalls || []).map(tool => 
                          tool.name === toolName 
                            ? { ...tool, status: 'completed', result: data.content?.result }
                            : tool
                        )
                      }
                    : msg
                ))
              } else if (data.type === 'RunCompleted') {
                // Final response completed
                console.log('✅ AGNO Agent completed')
                const finalContent = data.content?.full_response || data.content?.message || ''
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: finalContent, streaming: false }
                    : msg
                ))
              } else if (data.type === 'RunError') {
                // Handle errors
                console.error('❌ AGNO Error:', data.content)
                throw new Error(data.content?.error || 'Unknown AGNO error')
              } else if (data.type === 'StreamCompleted') {
                // Stream finished
                console.log('🏁 Stream completed')
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, streaming: false }
                    : msg
                ))
              } else if (data.type === 'StreamError') {
                // Stream error
                console.error('❌ Stream Error:', data.content)
                throw new Error(data.content?.error || 'Stream error')
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message. Please try again.')
      setMessages(prev => prev.slice(0, -1)) // Remove the assistant message on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-800 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-800 p-3 rounded-lg overflow-x-auto my-2"><code>$1</code></pre>')
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-cyan-400/30">
            <Bot className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-200">AI Assistant</h2>
            <p className="text-xs text-gray-600 dark:text-slate-400">Knowledge-driven development</p>
          </div>
        </div>
        
        {showLayoutToggle && (
          <button
            onClick={onLayoutToggle}
            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg transition-colors"
            title="Switch to 3-column layout"
          >
            <Grid3X3 className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">3-Column</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} space-x-3`}>
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-blue-500/20 border border-blue-400/30' 
                  : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-blue-400" />
                ) : (
                  <Bot className="w-4 h-4 text-cyan-400" />
                )}
              </div>

              {/* Message Content */}
              <div className={`flex-1 ${message.role === 'user' ? 'mr-3' : 'ml-3'}`}>
                <div className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500/10 border border-blue-400/20'
                    : 'bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/50'
                }`}>
                  <div 
                    className="text-gray-900 dark:text-slate-200 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                  />
                  
                  {/* Tool Calls */}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.toolCalls.map((tool, index) => (
                        <div key={index} className="flex items-center space-x-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${
                            tool.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                            tool.status === 'completed' ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          <span className="text-slate-400">
                            {tool.status === 'running' ? 'Running' : 
                             tool.status === 'completed' ? 'Used' : 'Failed'} {tool.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {message.streaming && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      <span className="text-xs text-slate-400">Thinking...</span>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-slate-500 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
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
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want to build or ask for help..."
              className="w-full p-3 pr-12 bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600/50 rounded-lg text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-slate-700/30 disabled:cursor-not-allowed border border-cyan-400/30 disabled:border-slate-600/30 rounded-lg transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Send className="w-4 h-4 text-cyan-400 disabled:text-slate-400" />
              )}
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-slate-500">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>Knowledge-driven responses</span>
            </span>
            <span className="flex items-center space-x-1">
              <Code className="w-3 h-3" />
              <span>API-aware generation</span>
            </span>
          </div>
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  )
}
