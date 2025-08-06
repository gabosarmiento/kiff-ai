import React, { useState } from 'react'
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  ExternalLink, 
  Database,
  FileText,
  Code2,
  Book,
  Eye,
  EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'

export interface KnowledgeItem {
  id: string
  type: 'api_documentation' | 'code_pattern' | 'framework_guide'
  title: string
  content: string
  relevance_score: number
  source: string
  url?: string
  enabled: boolean
  tags?: string[]
}

interface KnowledgeManagerProps {
  knowledgeItems: KnowledgeItem[]
  onKnowledgeChange: (items: KnowledgeItem[]) => void
  className?: string
}

export const KnowledgeManager: React.FC<KnowledgeManagerProps> = ({
  knowledgeItems,
  onKnowledgeChange,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [formData, setFormData] = useState<Partial<KnowledgeItem>>({
    type: 'api_documentation',
    title: '',
    content: '',
    url: '',
    enabled: true,
    tags: []
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'api_documentation':
        return <Database className="w-4 h-4" />
      case 'code_pattern':
        return <Code2 className="w-4 h-4" />
      case 'framework_guide':
        return <Book className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'api_documentation':
        return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30'
      case 'code_pattern':
        return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30'
      case 'framework_guide':
        return 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/30'
      default:
        return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800'
    }
  }

  const handleToggleEnabled = (id: string) => {
    const currentItem = knowledgeItems.find(item => item.id === id)
    if (!currentItem) return

    // If trying to disable and this is the last enabled source, prevent it
    if (currentItem.enabled) {
      const enabledCount = knowledgeItems.filter(item => item.enabled).length
      if (enabledCount <= 1) {
        toast.error('At least one knowledge source must remain enabled')
        return
      }
    }

    const updatedItems = knowledgeItems.map(item =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    )
    onKnowledgeChange(updatedItems)
    
    const item = updatedItems.find(i => i.id === id)
    toast.success(`${item?.title} ${item?.enabled ? 'enabled' : 'disabled'}`)
  }

  const openAddModal = () => {
    setFormData({
      type: 'api_documentation',
      title: '',
      content: '',
      url: '',
      enabled: true,
      tags: []
    })
    setModalMode('add')
    setIsModalOpen(true)
  }

  const openEditModal = (item: KnowledgeItem) => {
    setFormData({ ...item })
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setFormData({
      type: 'api_documentation',
      title: '',
      content: '',
      url: '',
      enabled: true,
      tags: []
    })
  }

  const handleSaveModal = () => {
    if (!formData.title || !formData.content || !formData.url) {
      toast.error('Title, content, and URL are required')
      return
    }

    // Auto-generate source from URL domain
    const getSourceFromUrl = (url: string) => {
      try {
        const domain = new URL(url).hostname.replace('www.', '')
        return domain.charAt(0).toUpperCase() + domain.slice(1)
      } catch {
        return 'Custom Source'
      }
    }

    if (modalMode === 'add') {
      const newItem: KnowledgeItem = {
        id: `custom-${Date.now()}`,
        type: formData.type as any,
        title: formData.title,
        content: formData.content,
        relevance_score: 1.0, // Default score, not shown in UI
        source: getSourceFromUrl(formData.url!),
        url: formData.url!,
        enabled: formData.enabled ?? true,
        tags: formData.tags || []
      }
      onKnowledgeChange([...knowledgeItems, newItem])
      toast.success('New knowledge source added!')
    } else {
      const updatedItems = knowledgeItems.map(item =>
        item.id === formData.id ? { 
          ...item, 
          ...formData, 
          source: getSourceFromUrl(formData.url!),
          url: formData.url!,
          relevance_score: item.relevance_score 
        } : item
      )
      onKnowledgeChange(updatedItems)
      toast.success('Knowledge source updated!')
    }

    closeModal()
  }

  const handleDelete = (id: string) => {
    const updatedItems = knowledgeItems.filter(item => item.id !== id)
    onKnowledgeChange(updatedItems)
    toast.success('Knowledge source deleted')
  }

  const enabledCount = knowledgeItems.filter(item => item.enabled).length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Add Source Button */}
      <div className="flex justify-end">
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Source</span>
        </button>
      </div>

      {/* Knowledge Items List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {knowledgeItems.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-lg border transition-all ${
              item.enabled 
                ? 'border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-600' 
                : 'border-gray-100 bg-gray-50 dark:bg-slate-700 dark:border-slate-600 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`p-1 rounded ${getTypeColor(item.type)}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-slate-200 flex-1">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                    {item.content}
                  </p>
                  {item.url && (
                    <div className="flex items-center text-xs">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View</span>
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleToggleEnabled(item.id)}
                    className={`p-1 rounded transition-colors ${
                      item.enabled 
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' 
                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title={item.enabled ? 'Disable source' : 'Enable source'}
                  >
                    {item.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit source"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete source"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
          </div>
        ))}
      </div>

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-200">
                {modalMode === 'add' ? 'Add New Knowledge Source' : 'Edit Knowledge Source'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Type
                </label>
                <select
                  value={formData.type || 'api_documentation'}
                  onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  <option value="api_documentation">API Documentation</option>
                  <option value="code_pattern">Code Pattern</option>
                  <option value="framework_guide">Framework Guide</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400"
                  placeholder="Enter title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Content *
                </label>
                <textarea
                  value={formData.content || ''}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400"
                  rows={4}
                  placeholder="Enter content description"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  value={formData.url || ''}
                  onChange={(e) => setFormData({...formData, url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400"
                  placeholder="https://example.com"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {modalMode === 'add' ? 'Add Source' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
