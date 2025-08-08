import React, { useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Card, CardHeader, CardContent, CardFooter } from './Card'
import { Input } from './Input'
import { Badge } from './Badge'
import { APIProvider } from './APIGallery'
import { 
  Plus, Edit, Trash2, Search, Filter, MoreHorizontal, 
  Eye, Copy, Globe, Save, X, Upload, Download
} from 'lucide-react'

export interface APIAdminProps {
  providers?: APIProvider[]
  onCreateProvider?: (provider: Omit<APIProvider, 'id'>) => void
  onUpdateProvider?: (id: string, provider: Partial<APIProvider>) => void
  onDeleteProvider?: (id: string) => void
  className?: string
}

interface ProviderFormData {
  name: string
  description: string
  logo: string
  website: string
  categories: string[]
  apis: {
    name: string
    description: string
    endpoint: string
    method: string
    documentation: string
  }[]
}

const defaultFormData: ProviderFormData = {
  name: '',
  description: '',
  logo: '',
  website: '',
  categories: [],
  apis: []
}

const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const availableCategories = [
  'AI/ML', 'Payments', 'Communication', 'Data', 'Maps', 'Translation', 
  'Email', 'SMS', 'Voice', 'Finance', 'E-commerce', 'Marketing', 'Analytics'
]

// Mock data for demonstration
const mockProviders: APIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Leading AI company providing GPT models and advanced language processing capabilities.',
    logo: '🤖',
    website: 'https://openai.com',
    categories: ['AI/ML', 'Text Generation', 'Conversation'],
    apis: [
      {
        id: 'chat-completions',
        name: 'Chat Completions',
        description: 'Generate conversational responses using GPT models',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        documentation: 'https://platform.openai.com/docs/api-reference/chat'
      }
    ]
  }
]

export const APIAdmin = React.forwardRef<HTMLDivElement, APIAdminProps>(({
  providers = mockProviders,
  onCreateProvider,
  onUpdateProvider,
  onDeleteProvider,
  className,
  ...props
}, ref) => {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<APIProvider | null>(null)
  const [formData, setFormData] = useState<ProviderFormData>(defaultFormData)
  const [newCategory, setNewCategory] = useState('')
  const [newAPI, setNewAPI] = useState({
    name: '', description: '', endpoint: '', method: 'GET', documentation: ''
  })

  const filteredProviders = providers.filter(provider => 
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleCreateNew = () => {
    setFormData(defaultFormData)
    setView('create')
  }

  const handleEdit = (provider: APIProvider) => {
    setSelectedProvider(provider)
    setFormData({
      name: provider.name,
      description: provider.description,
      logo: provider.logo || '',
      website: provider.website,
      categories: [...provider.categories],
      apis: provider.apis.map(api => ({
        name: api.name,
        description: api.description,
        endpoint: api.endpoint,
        method: api.method,
        documentation: api.documentation
      }))
    })
    setView('edit')
  }

  const handleSave = () => {
    if (view === 'create') {
      onCreateProvider?.(formData)
    } else if (view === 'edit' && selectedProvider) {
      onUpdateProvider?.(selectedProvider.id, formData)
    }
    setView('list')
    setFormData(defaultFormData)
    setSelectedProvider(null)
  }

  const handleCancel = () => {
    setView('list')
    setFormData(defaultFormData)
    setSelectedProvider(null)
  }

  const addCategory = () => {
    if (newCategory && !formData.categories.includes(newCategory)) {
      setFormData(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory]
      }))
      setNewCategory('')
    }
  }

  const removeCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category)
    }))
  }

  const addAPI = () => {
    if (newAPI.name && newAPI.endpoint) {
      setFormData(prev => ({
        ...prev,
        apis: [...prev.apis, { ...newAPI }]
      }))
      setNewAPI({ name: '', description: '', endpoint: '', method: 'GET', documentation: '' })
    }
  }

  const removeAPI = (index: number) => {
    setFormData(prev => ({
      ...prev,
      apis: prev.apis.filter((_, i) => i !== index)
    }))
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div ref={ref} className={cn('max-w-4xl mx-auto space-y-6', className)} {...props}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {view === 'create' ? 'Create API Provider' : 'Edit API Provider'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {view === 'create' ? 'Add a new API provider to the gallery' : 'Update provider information'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              {view === 'create' ? 'Create Provider' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Provider Information</h3>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Provider Name"
                placeholder="e.g., OpenAI"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label="Logo (Emoji or URL)"
                placeholder="🤖 or https://..."
                value={formData.logo}
                onChange={(e) => setFormData(prev => ({ ...prev, logo: e.target.value }))}
              />
            </div>

            <Input
              label="Description"
              placeholder="Brief description of the provider..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />

            <Input
              label="Website"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              leftIcon={<Globe className="h-4 w-4" />}
            />

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Categories
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add category..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                    className="flex-1"
                  />
                  <Button onClick={addCategory} disabled={!newCategory}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Suggested Categories */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Suggested:</span>
                  {availableCategories
                    .filter(cat => !formData.categories.includes(cat))
                    .slice(0, 5)
                    .map(cat => (
                      <Button
                        key={cat}
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          categories: [...prev.categories, cat] 
                        }))}
                        className="h-6 px-2 text-xs"
                      >
                        + {cat}
                      </Button>
                    ))}
                </div>
                
                {/* Selected Categories */}
                <div className="flex flex-wrap gap-2">
                  {formData.categories.map(category => (
                    <div key={category} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm">
                      {category}
                      <button
                        onClick={() => removeCategory(category)}
                        className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* APIs Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">API Endpoints</h3>
              <Badge variant="info" size="sm">
                {formData.apis.length} API{formData.apis.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add New API */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Add New API</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="API Name"
                  value={newAPI.name}
                  onChange={(e) => setNewAPI(prev => ({ ...prev, name: e.target.value }))}
                />
                <div>
                  <select
                    value={newAPI.method}
                    onChange={(e) => setNewAPI(prev => ({ ...prev, method: e.target.value }))}
                    className="w-full h-11 px-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {methodOptions.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                placeholder="API Description"
                value={newAPI.description}
                onChange={(e) => setNewAPI(prev => ({ ...prev, description: e.target.value }))}
              />
              <Input
                placeholder="API Endpoint URL"
                value={newAPI.endpoint}
                onChange={(e) => setNewAPI(prev => ({ ...prev, endpoint: e.target.value }))}
              />
              <Input
                placeholder="Documentation URL"
                value={newAPI.documentation}
                onChange={(e) => setNewAPI(prev => ({ ...prev, documentation: e.target.value }))}
              />
              <Button onClick={addAPI} disabled={!newAPI.name || !newAPI.endpoint}>
                <Plus className="h-4 w-4 mr-2" />
                Add API
              </Button>
            </div>

            {/* API List */}
            {formData.apis.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">Added APIs</h4>
                {formData.apis.map((api, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-gray-900 dark:text-white">{api.name}</h5>
                          <Badge variant="info" size="sm">{api.method}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{api.description}</p>
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {api.endpoint}
                        </code>
                        {api.documentation && (
                          <div className="mt-1">
                            <a 
                              href={api.documentation} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Documentation →
                            </a>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAPI(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // List View
  return (
    <div ref={ref} className={cn('space-y-6', className)} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            API Provider Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage API providers in the gallery
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Badge variant="secondary">
          {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Provider Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Categories
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    APIs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-2xl mr-3">{provider.logo}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {provider.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {provider.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {provider.categories.slice(0, 2).map(category => (
                          <Badge key={category} variant="secondary" size="sm">
                            {category}
                          </Badge>
                        ))}
                        {provider.categories.length > 2 && (
                          <Badge variant="secondary" size="sm">
                            +{provider.categories.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {provider.apis.length} API{provider.apis.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="success" size="sm">Active</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="p-2">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-2"
                          onClick={() => handleEdit(provider)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-2 text-red-600 hover:text-red-700"
                          onClick={() => onDeleteProvider?.(provider.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {filteredProviders.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No providers found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery ? 'Try adjusting your search criteria.' : 'Get started by adding your first API provider.'}
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      )}
    </div>
  )
})

APIAdmin.displayName = 'APIAdmin'