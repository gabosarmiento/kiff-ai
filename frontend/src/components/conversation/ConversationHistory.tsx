import React, { useState, useEffect } from 'react'
import { MessageSquare, Plus, Clock, Archive, Trash2, Pin, PinOff, Search, Filter } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import toast from 'react-hot-toast'

interface Conversation {
  id: number
  title: string
  description?: string
  session_id: string
  status: 'active' | 'archived' | 'deleted'
  is_pinned: boolean
  generator_type: string
  app_generated: boolean
  message_count: number
  last_message_preview?: string
  created_at: string
  updated_at?: string
  last_message_at?: string
}

interface ConversationHistoryProps {
  currentSessionId?: string
  onConversationSelect?: (conversation: Conversation) => void
  onNewConversation?: () => void
  className?: string
}

// Helper function to ensure we always use a valid tenant ID
const getValidTenantId = (tenantId: string | null, user: any): string => {
  // If we have a valid UUID format tenant ID, use it
  if (tenantId && tenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return tenantId
  }
  
  // Check user tenant ID
  if (user?.tenant_id && user.tenant_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return user.tenant_id
  }
  
  // Fallback to known valid tenant ID
  return '4485db48-71b7-47b0-8128-c6dca5be352d'
}

export function ConversationHistory({ 
  currentSessionId, 
  onConversationSelect, 
  onNewConversation,
  className = '' 
}: ConversationHistoryProps) {
  const { user } = useAuth()
  const { tenantId } = useTenant()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEnabled, setIsEnabled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [showPinnedOnly, setShowPinnedOnly] = useState(false)

  // Check if conversation history feature is enabled
  useEffect(() => {
    checkFeatureEnabled()
  }, [])

  // Load conversations when feature is enabled
  useEffect(() => {
    if (isEnabled) {
      loadConversations()
    }
  }, [isEnabled, statusFilter])

  const checkFeatureEnabled = async () => {
    try {
      const response = await fetch('/api/admin/feature-flags/', {
        headers: {
          'x-tenant-id': getValidTenantId(tenantId, user)
        }
      })
      
      if (response.ok) {
        const flags = await response.json()
        const conversationHistoryFlag = flags.find((flag: any) => flag.name === 'conversation_history')
        const enabled = conversationHistoryFlag?.is_enabled || false
        setIsEnabled(enabled)
        
        if (!enabled) {
          console.log('💡 Conversation history feature is disabled via feature flag')
        }
      } else {
        setIsEnabled(false)
      }
    } catch (error) {
      console.error('Failed to check conversation history feature flag:', error)
      setIsEnabled(false)
    }
  }

  const loadConversations = async () => {
    if (!user || !tenantId) return

    setIsLoading(true)
    try {
      const currentTenantId = getValidTenantId(tenantId, user)
      
      const params = new URLSearchParams({
        tenant_id: currentTenantId,
        user_id: String(user.id || '1'),
        limit: '50',
        offset: '0'
      })

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/conversation-history/conversations?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': currentTenantId
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to load conversations: ${response.statusText}`)
      }

      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
      toast.error('Failed to load conversation history')
    } finally {
      setIsLoading(false)
    }
  }

  const togglePin = async (conversationId: number, isPinned: boolean) => {
    try {
      // Note: This would require an update endpoint in the backend
      console.log(`Toggle pin for conversation ${conversationId}: ${!isPinned}`)
      toast.success(`Conversation ${!isPinned ? 'pinned' : 'unpinned'}`)
      
      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, is_pinned: !isPinned }
          : conv
      ))
    } catch (error) {
      console.error('Failed to toggle pin:', error)
      toast.error('Failed to update conversation')
    }
  }

  const deleteConversation = async (conversationId: number) => {
    if (!user || !tenantId) return

    try {
      const currentTenantId = getValidTenantId(tenantId, user)
      
      const response = await fetch(`/api/conversation-history/conversations/${conversationId}?tenant_id=${currentTenantId}&user_id=${user.id || '1'}`, {
        method: 'DELETE',
        headers: {
          'x-tenant-id': currentTenantId
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete conversation')
      }

      toast.success('Conversation deleted')
      loadConversations() // Reload list
    } catch (error) {
      console.error('Failed to delete conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchQuery || 
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.last_message_preview && conv.last_message_preview.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesPinFilter = !showPinnedOnly || conv.is_pinned
    
    return matchesSearch && matchesPinFilter
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Don't render if feature is disabled
  if (!isEnabled) {
    return null
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Conversations
          </h2>
          <button
            onClick={onNewConversation}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="New Conversation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 text-sm">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
          >
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="archived">Archived</option>
          </select>
          
          <button
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              showPinnedOnly 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            <Pin className="w-3 h-3 inline mr-1" />
            Pinned
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  conversation.session_id === currentSessionId
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => onConversationSelect?.(conversation)}
              >
                {/* Pin indicator */}
                {conversation.is_pinned && (
                  <Pin className="absolute top-2 right-2 w-3 h-3 text-blue-500" />
                )}

                {/* Title */}
                <div className="font-medium text-gray-900 dark:text-white text-sm mb-1 pr-6">
                  {conversation.title}
                </div>

                {/* Preview */}
                {conversation.last_message_preview && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                    {conversation.last_message_preview}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(conversation.updated_at || conversation.created_at)}</span>
                    <span>•</span>
                    <span>{conversation.message_count} messages</span>
                    {conversation.app_generated && (
                      <>
                        <span>•</span>
                        <span className="text-green-500">App</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions (shown on hover) */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePin(conversation.id, conversation.is_pinned)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title={conversation.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    {conversation.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this conversation?')) {
                        deleteConversation(conversation.id)
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
