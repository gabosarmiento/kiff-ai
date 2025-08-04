import React, { useState, useEffect } from 'react'
import { Database, AlertTriangle } from 'lucide-react'
import KnowledgeSection from './KnowledgeSection'
import KnowledgeList from './KnowledgeList'
import GalleryLink from './GalleryLink'
import { KnowledgeItemData } from './KnowledgeItem'
import { apiRequest } from '@/utils/apiConfig'
import { useTenant } from '@/contexts/TenantContext'
import toast from 'react-hot-toast'

interface KnowledgePanelProps {
  onAddKnowledge?: (id: string) => void
  onRemoveKnowledge?: (id: string) => void
  onBrowseGallery?: () => void
  className?: string
}

// Available APIs for indexing (could be fetched from API gallery)
const availableApis = [
  { id: 'agno', name: 'AGNO Framework', url: 'https://docs.agno.com/' },
  { id: 'stripe', name: 'Stripe Payments', url: 'https://docs.stripe.com/api' },
  { id: 'leonardo', name: 'Leonardo AI', url: 'https://docs.leonardo.ai/' },
  { id: 'openai', name: 'OpenAI API', url: 'https://platform.openai.com/docs/api-reference' },
  { id: 'anthropic', name: 'Anthropic Claude', url: 'https://docs.anthropic.com/' },
  { id: 'stability', name: 'Stability AI', url: 'https://platform.stability.ai/docs/api-reference' }
]

const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  onAddKnowledge,
  onRemoveKnowledge,
  onBrowseGallery,
  className = ''
}) => {
  const { tenantId } = useTenant()
  const [inUseApis, setInUseApis] = useState<KnowledgeItemData[]>([])
  const [recommendedApis, setRecommendedApis] = useState<KnowledgeItemData[]>([])
  const [processingApis, setProcessingApis] = useState<KnowledgeItemData[]>([])
  const [totalApis, setTotalApis] = useState(availableApis.length)
  const [loading, setLoading] = useState(true)

  // Load existing knowledge bases on mount
  useEffect(() => {
    loadKnowledgeBases()
  }, [tenantId])

  const loadKnowledgeBases = async () => {
    try {
      setLoading(true)
      const response = await apiRequest('/api/knowledge/bases', {
        headers: {
          'X-Tenant-ID': tenantId || '4485db48-71b7-47b0-8128-c6dca5be352d'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const knowledgeBases = data.knowledge_bases || []
        
        // Transform knowledge bases to KnowledgeItemData format
        const inUse = knowledgeBases.map((kb: any) => ({
          id: kb.id,
          name: kb.name,
          status: kb.status === 'indexed' ? 'ready' : kb.status,
          chunks: kb.document_count || 0
        }))
        
        // Filter available APIs to show only those not already indexed
        const indexedIds = new Set(knowledgeBases.map((kb: any) => kb.id))
        const available = availableApis
          .filter(api => !indexedIds.has(api.id))
          .map(api => ({
            id: api.id,
            name: api.name,
            status: 'available' as const
          }))
        
        setInUseApis(inUse)
        setRecommendedApis(available)
      }
    } catch (error) {
      console.error('Failed to load knowledge bases:', error)
      toast.error('Failed to load knowledge bases')
      // Fallback to showing all as available
      setRecommendedApis(availableApis.map(api => ({
        id: api.id,
        name: api.name,
        status: 'available' as const
      })))
    } finally {
      setLoading(false)
    }
  }

  const handleAddKnowledge = async (id: string) => {
    // Find the API being added
    const apiToAdd = recommendedApis.find(api => api.id === id)
    const availableApi = availableApis.find(api => api.id === id)
    if (!apiToAdd || !availableApi) return

    console.log('🚀 Starting real knowledge indexing for:', apiToAdd.name, availableApi.url)

    // Move to processing state
    const processingApi = { ...apiToAdd, status: 'processing' as const, progress: 0 }
    setProcessingApis(prev => [...prev, processingApi])
    setRecommendedApis(prev => prev.filter(api => api.id !== id))

    try {
      // Make real API call to start indexing
      const response = await apiRequest('/api/knowledge/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId || '4485db48-71b7-47b0-8128-c6dca5be352d'
        },
        body: JSON.stringify({
          url: availableApi.url,
          name: apiToAdd.name,
          description: `${apiToAdd.name} API documentation`
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Indexing started:', result)
        
        toast.success(`Started indexing ${apiToAdd.name}`)
        
        // Simulate progress updates while real indexing happens
        const progressInterval = setInterval(() => {
          setProcessingApis(prev => 
            prev.map(api => 
              api.id === id 
                ? { ...api, progress: Math.min((api.progress || 0) + 15, 85) }
                : api
            )
          )
        }, 2000)

        // Poll for completion
        const pollForCompletion = async () => {
          try {
            const statusResponse = await apiRequest('/api/knowledge/bases', {
              headers: {
                'X-Tenant-ID': tenantId || '4485db48-71b7-47b0-8128-c6dca5be352d'
              }
            })
            
            if (statusResponse.ok) {
              const data = await statusResponse.json()
              const knowledgeBase = data.knowledge_bases?.find((kb: any) => kb.id === id)
              
              if (knowledgeBase && knowledgeBase.status === 'indexed') {
                clearInterval(progressInterval)
                
                // Move to in use with real data
                const completedApi = { 
                  ...apiToAdd, 
                  status: 'ready' as const, 
                  chunks: knowledgeBase.document_count || 0
                }
                
                setInUseApis(prev => [...prev, completedApi])
                setProcessingApis(prev => prev.filter(api => api.id !== id))
                
                toast.success(`${apiToAdd.name} indexed successfully! ${knowledgeBase.document_count} documents processed.`)
                return
              }
            }
            
            // Continue polling if not complete
            setTimeout(pollForCompletion, 3000)
          } catch (error) {
            console.error('Error checking indexing status:', error)
            setTimeout(pollForCompletion, 5000) // Retry in 5 seconds
          }
        }

        // Start polling after a short delay
        setTimeout(pollForCompletion, 3000)
        
      } else {
        throw new Error(`Failed to start indexing: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ Failed to start indexing:', error)
      toast.error(`Failed to start indexing ${apiToAdd.name}`)
      
      // Move back to recommended
      setRecommendedApis(prev => [...prev, apiToAdd])
      setProcessingApis(prev => prev.filter(api => api.id !== id))
    }

    // Call parent handler
    if (onAddKnowledge) {
      onAddKnowledge(id)
    }
  }

  const handleRemoveKnowledge = async (id: string) => {
    const apiToRemove = inUseApis.find(api => api.id === id)
    if (!apiToRemove) return

    console.log('🗑️ Removing knowledge base:', apiToRemove.name)

    try {
      // Make real API call to delete knowledge base
      const response = await apiRequest(`/api/knowledge/bases/${id}`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-ID': tenantId || '4485db48-71b7-47b0-8128-c6dca5be352d'
        }
      })

      if (response.ok) {
        // Move back to recommended
        const recommendedApi = { ...apiToRemove, status: 'available' as const }
        delete (recommendedApi as any).chunks

        setInUseApis(prev => prev.filter(api => api.id !== id))
        setRecommendedApis(prev => [...prev, recommendedApi])
        
        toast.success(`Removed ${apiToRemove.name} from knowledge base`)
      } else {
        throw new Error(`Failed to delete: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ Failed to remove knowledge base:', error)
      toast.error(`Failed to remove ${apiToRemove.name}`)
    }

    // Call parent handler
    if (onRemoveKnowledge) {
      onRemoveKnowledge(id)
    }
  }

  const isEmpty = inUseApis.length === 0 && processingApis.length === 0

  return (
    <div className={`bg-slate-900/95 border border-slate-700/50 rounded-xl h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-800/60">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-lg flex items-center justify-center border border-purple-400/30">
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">KNOWLEDGE APIS</h2>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Empty State */}
        {isEmpty && (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center border border-amber-400/20 mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-300">Basic Code Generation</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Generic templates • No API integrations • Limited functionality
              </p>
            </div>
            
            {/* Quick Start Buttons */}
            <div className="space-y-2 pt-4">
              <p className="text-xs text-slate-400 font-medium">Quick Start</p>
              <div className="space-y-2">
                {recommendedApis.slice(0, 3).map((api) => (
                  <button
                    key={api.id}
                    onClick={() => handleAddKnowledge(api.id)}
                    className="w-full px-3 py-2 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-slate-800/30 rounded border border-slate-600/30 hover:border-cyan-400/30 transition-colors"
                  >
                    {api.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* In Use APIs */}
        {inUseApis.length > 0 && (
          <KnowledgeSection
            title="In Use"
            count={inUseApis.length}
          >
            <KnowledgeList
              items={inUseApis}
              onRemove={handleRemoveKnowledge}
              showActions={true}
            />
          </KnowledgeSection>
        )}

        {/* Processing APIs */}
        {processingApis.length > 0 && (
          <KnowledgeSection
            title="Indexing"
            count={processingApis.length}
          >
            <KnowledgeList
              items={processingApis}
              showActions={false}
            />
          </KnowledgeSection>
        )}

        {/* Recommended APIs */}
        {recommendedApis.length > 0 && (
          <KnowledgeSection
            title="Recommended"
            count={recommendedApis.length}
            totalCount={totalApis}
          >
            <KnowledgeList
              items={recommendedApis}
              onAdd={handleAddKnowledge}
              showActions={true}
              emptyMessage="No recommendations available"
            />
          </KnowledgeSection>
        )}

        {/* Gallery Link */}
        <div className="pt-2">
          <GalleryLink
            totalApis={totalApis}
            onClick={onBrowseGallery}
            variant="default"
          />
        </div>
      </div>
    </div>
  )
}

export default KnowledgePanel