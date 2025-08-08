import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Badge } from './Badge'
import { APIProvider } from './APIGallery'
import { 
  X, ExternalLink, Check, Plus, Globe, BookOpen
} from 'lucide-react'

export interface APIDetailsModalProps {
  provider: APIProvider | null
  isOpen: boolean
  onClose: () => void
  onAddProvider?: (provider: APIProvider) => void
  onRemoveProvider?: (provider: APIProvider) => void
  className?: string
}

export const APIDetailsModal = React.forwardRef<HTMLDivElement, APIDetailsModalProps>(({
  provider,
  isOpen,
  onClose,
  onAddProvider,
  onRemoveProvider,
  className,
  ...props
}, ref) => {
  const [selectedAPIs, setSelectedAPIs] = useState<string[]>([])

  if (!isOpen || !provider) return null

  const toggleAPI = (apiId: string) => {
    setSelectedAPIs(prev => 
      prev.includes(apiId) 
        ? prev.filter(id => id !== apiId)
        : [...prev, apiId]
    )
  }

  const selectAll = () => {
    setSelectedAPIs(provider.apis.map(api => api.id))
  }

  const selectNone = () => {
    setSelectedAPIs([])
  }

  const handleAddProvider = () => {
    const updatedProvider = {
      ...provider,
      selectedAPIs: selectedAPIs,
      isAdded: true
    }
    onAddProvider?.(updatedProvider)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        ref={ref}
        className={cn(
          "relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="text-4xl flex-shrink-0">
              {provider.logo}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {provider.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1 max-w-md">
                {provider.description}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(provider.website, '_blank')}
                  className="p-0 h-auto text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Globe className="h-4 w-4 mr-1" />
                  {provider.website}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Categories */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Categories:
            </span>
            <div className="flex flex-wrap gap-2">
              {provider.categories.map((category) => (
                <Badge key={category} variant="secondary" size="sm">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* API Selection */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Available APIs ({provider.apis.length})
            </h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="text-xs"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectNone}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {provider.apis.map((api) => (
              <div key={api.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleAPI(api.id)}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                      selectedAPIs.includes(api.id)
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                    )}
                  >
                    {selectedAPIs.includes(api.id) && (
                      <Check className="h-3 w-3" />
                    )}
                  </button>
                  
                  {/* API Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {api.name}
                      </h4>
                      <Badge variant="info" size="sm">
                        {api.method}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {api.description}
                    </p>
                    
                    {/* Endpoint */}
                    <div className="mb-2">
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-800 dark:text-gray-200">
                        {api.endpoint}
                      </code>
                    </div>
                    
                    {/* Documentation Link */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(api.documentation, '_blank')}
                      className="p-0 h-auto text-blue-600 dark:text-blue-400 hover:underline text-xs"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      View Documentation
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedAPIs.length > 0 ? (
              `${selectedAPIs.length} API${selectedAPIs.length !== 1 ? 's' : ''} selected`
            ) : (
              'No APIs selected'
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            
            {provider.isAdded ? (
              <Button
                variant="secondary"
                onClick={() => {
                  onRemoveProvider?.(provider)
                  onClose()
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Remove from RAG
              </Button>
            ) : (
              <Button
                onClick={handleAddProvider}
                disabled={selectedAPIs.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to RAG ({selectedAPIs.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

APIDetailsModal.displayName = 'APIDetailsModal'