import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, MessageSquare } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'
import { useAuth } from '../contexts/AuthContext'

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_preview?: string
}

export function ConversationsPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set())
  const [isSelecting, setIsSelecting] = useState(false)

  // Helper function to validate tenant ID
  const getValidTenantId = () => {
    if (!tenantId || tenantId === 'demo-tenant-id') {
      return '4485db48-71b7-47b0-8128-c6dca5be352d'
    }
    return tenantId
  }

  // Load conversations
  const loadConversations = async () => {
    try {
      setLoading(true)
      const validTenantId = getValidTenantId()
      const userId = user?.id || 'anonymous'

      const response = await fetch(`/api/conversations?tenant_id=${validTenantId}&user_id=${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': validTenantId,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      } else {
        console.error('Failed to load conversations:', response.statusText)
        setConversations([])
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
      setConversations([])
    } finally {
      setLoading(false)
    }
  }

  // Delete selected conversations
  const deleteSelectedConversations = async () => {
    try {
      const validTenantId = getValidTenantId()
      const conversationIds = Array.from(selectedConversations)

      for (const conversationId of conversationIds) {
        await fetch(`/api/conversations/${conversationId}?tenant_id=${validTenantId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': validTenantId,
          },
        })
      }

      // Reload conversations after deletion
      await loadConversations()
      setSelectedConversations(new Set())
      setIsSelecting(false)
    } catch (error) {
      console.error('Error deleting conversations:', error)
    }
  }

  // Start new chat
  const startNewChat = () => {
    navigate('/generate-v0')
  }

  // Select/deselect conversation
  const toggleConversationSelection = (conversationId: string) => {
    const newSelected = new Set(selectedConversations)
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId)
    } else {
      newSelected.add(conversationId)
    }
    setSelectedConversations(newSelected)
  }

  // Select all conversations
  const selectAllConversations = () => {
    const filteredConversations = conversations.filter(conv => 
      conv.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setSelectedConversations(new Set(filteredConversations.map(conv => conv.id)))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedConversations(new Set())
    setIsSelecting(false)
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    loadConversations()
  }, [tenantId, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-white dark:bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-200">
            Your kiff history
          </h1>
          <button
            onClick={startNewChat}
            className="flex items-center space-x-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New kiff</span>
          </button>
        </div>

        {conversations.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-gray-400 dark:text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-200 mb-2">
              Ready for your first kiff?
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md">
              Create knowledge-driven applications powered by real API documentation. Your kiff sessions will show up here.
            </p>
            <button
              onClick={startNewChat}
              className="flex items-center space-x-2 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New kiff</span>
            </button>
          </div>
        ) : (
          /* Conversations List */
          <>
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search your chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Batch Actions */}
            {selectedConversations.size > 0 && (
              <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {selectedConversations.size} selected chats
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteSelectedConversations}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* Conversations List */}
            <div className="space-y-2">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedConversations.has(conversation.id)
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                  }`}
                  onClick={() => {
                    if (isSelecting || selectedConversations.size > 0) {
                      toggleConversationSelection(conversation.id)
                    } else {
                      // Navigate to conversation (implement later)
                      console.log('Navigate to conversation:', conversation.id)
                    }
                  }}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedConversations.has(conversation.id)}
                      onChange={() => toggleConversationSelection(conversation.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-slate-200">
                        {conversation.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Last message {formatDate(conversation.updated_at)}
                        {conversation.last_message_preview && (
                          <span className="ml-2">in {conversation.last_message_preview}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredConversations.length === 0 && searchQuery && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-slate-400">
                  No conversations found matching "{searchQuery}"
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
