import { useState, useEffect } from 'react'
import { Database, CheckCircle, XCircle, Clock, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiRequest } from '../utils/apiConfig'

interface KnowledgeBase {
  id: string
  name: string
  status: 'indexed' | 'indexing' | 'failed'
  documentsCount: number
  lastIndexed: string
}

export function KnowledgePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingKBs, setDeletingKBs] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const fetchKnowledgeBases = async () => {
    setLoading(true)
    try {
      // Connect to actual backend API for tenant's knowledge bases
      const response = await apiRequest('/api/knowledge/bases', {
        headers: {
          'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setKnowledgeBases(data.knowledge_bases || [])
      }
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKnowledgeBases()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'indexed': return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'indexing': return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-yellow-400" />
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>, kb: KnowledgeBase) => {
    e.stopPropagation()
    setConfirmDelete(kb.id)
  }

  const cancelDelete = () => {
    setConfirmDelete(null)
  }

  const confirmDeleteAction = async (kb: KnowledgeBase) => {
    const deletingSet = new Set(deletingKBs)
    deletingSet.add(kb.id)
    setDeletingKBs(deletingSet)
    
    try {
      console.log('🗑️ Deleting knowledge base:', kb.name)
      const response = await apiRequest(`/api/knowledge/bases/${kb.id}`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-ID': '4485db48-71b7-47b0-8128-c6dca5be352d'
        }
      })
      
      if (response.ok) {
        // Remove from local state
        setKnowledgeBases(prev => prev.filter(k => k.id !== kb.id))
        toast.success(`Deleted ${kb.name} knowledge base`)
        setConfirmDelete(null)
      } else {
        throw new Error(`Failed to delete: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to delete knowledge base:', error)
      toast.error('Failed to delete knowledge base')
    } finally {
      const deletingSet = new Set(deletingKBs)
      deletingSet.delete(kb.id)
      setDeletingKBs(deletingSet)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 font-mono tracking-wider">
            Knowledge Base
          </h1>
          <p className="text-slate-400 mt-2">
            Your indexed documentation and knowledge sources
          </p>
        </div>
        <button
          onClick={fetchKnowledgeBases}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600/50 transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Knowledge Bases List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading knowledge bases...</span>
        </div>
      ) : knowledgeBases.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            No knowledge bases yet
          </h3>
          <p className="text-slate-400 mb-6">
            Start by indexing documentation from the API Gallery
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Available Knowledge Bases</h2>
          {knowledgeBases.map((kb) => (
            <div
              key={kb.id}
              className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-semibold text-slate-100">{kb.name}</h3>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(kb.status)}
                    <span className="text-sm text-slate-400 capitalize">{kb.status}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm text-slate-400">
                    <div>{kb.documentsCount} documents</div>
                    <div>Last indexed: {formatDate(kb.lastIndexed)}</div>
                  </div>
                  
                  {/* Delete Button */}
                  {confirmDelete === kb.id ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => confirmDeleteAction(kb)}
                        disabled={deletingKBs.has(kb.id)}
                        className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded border border-red-500/30 text-sm transition-all duration-200 disabled:opacity-50"
                      >
                        {deletingKBs.has(kb.id) ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          'Confirm'
                        )}
                      </button>
                      <button
                        onClick={cancelDelete}
                        className="px-3 py-1 bg-slate-600/20 hover:bg-slate-600/30 text-slate-400 rounded border border-slate-500/30 text-sm transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDeleteClick(e, kb)}
                      className="p-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg border border-red-500/20 hover:border-red-500/30 transition-all duration-200 group"
                      title="Delete knowledge base"
                    >
                      <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Warning message for confirmation */}
              {confirmDelete === kb.id && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-300">
                    <strong>Warning:</strong> This will permanently delete the knowledge base "{kb.name}" and all its {kb.documentsCount} documents. This action cannot be undone.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
