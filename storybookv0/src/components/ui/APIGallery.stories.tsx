import type { Meta, StoryObj } from '@storybook/react'
import { APIGallery, type APIProvider } from './APIGallery'
import { APIDetailsModal } from './APIDetailsModal'
import { useState } from 'react'
import { Card } from './Card'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof APIGallery> = {
  title: 'UI/APIGallery',
  component: APIGallery,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    compact: {
      control: 'boolean',
    },
    showFilters: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Minimal mock providers for interactive stories
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
      },
      {
        id: 'embeddings',
        name: 'Embeddings',
        description: 'Create text embeddings for semantic search and similarity',
        endpoint: 'https://api.openai.com/v1/embeddings',
        method: 'POST',
        documentation: 'https://platform.openai.com/docs/api-reference/embeddings'
      }
    ],
    isAdded: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'AI safety company creating helpful, harmless, and honest AI systems like Claude.',
    logo: '🧠',
    website: 'https://anthropic.com',
    categories: ['AI/ML', 'Conversation', 'Analysis'],
    apis: [
      {
        id: 'messages',
        name: 'Messages',
        description: 'Interact with Claude for conversations and analysis',
        endpoint: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        documentation: 'https://docs.anthropic.com/claude/reference/messages'
      },
      {
        id: 'completions',
        name: 'Text Completions',
        description: 'Generate text completions with Claude models',
        endpoint: 'https://api.anthropic.com/v1/complete',
        method: 'POST',
        documentation: 'https://docs.anthropic.com/claude/reference/complete'
      }
    ]
  },
]

// Basic API Gallery
export const Default: Story = {
  args: {},
  render: (args) => (
    <PageContainer>
      <APIGallery {...args} />
    </PageContainer>
  ),
}

// Compact view
export const Compact: Story = {
  args: {
    compact: true,
  },
  render: (args) => (
    <PageContainer>
      <APIGallery {...args} />
    </PageContainer>
  ),
}

// Without filters
export const NoFilters: Story = {
  args: {
    showFilters: false,
  },
  render: (args) => (
    <PageContainer>
      <APIGallery {...args} />
    </PageContainer>
  ),
}

// Interactive demo with modal
export const InteractiveDemo: Story = {
  render: () => {
    const [providers, setProviders] = useState<APIProvider[]>(mockProviders)
    const [selectedProvider, setSelectedProvider] = useState<APIProvider | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleAddProvider = (provider: APIProvider) => {
      setProviders(prev => prev.map(p => 
        p.id === provider.id ? { ...p, isAdded: true, selectedAPIs: provider.selectedAPIs } : p
      ))
      console.log('Added to RAG:', provider.name)
    }

    const handleRemoveProvider = (provider: APIProvider) => {
      setProviders(prev => prev.map(p => 
        p.id === provider.id ? { ...p, isAdded: false, selectedAPIs: [] } : p
      ))
      console.log('Removed from RAG:', provider.name)
    }

    const handleViewDetails = (provider: APIProvider) => {
      setSelectedProvider(provider)
      setIsModalOpen(true)
    }

    return (
      <PageContainer>
        <APIGallery
          providers={providers}
          onAddProvider={handleAddProvider}
          onRemoveProvider={handleRemoveProvider}
          onViewDetails={handleViewDetails}
        />

        <APIDetailsModal
          provider={selectedProvider}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddProvider={handleAddProvider}
          onRemoveProvider={handleRemoveProvider}
        />
      </PageContainer>
    )
  },
}

// RAG Integration Dashboard
export const RAGIntegrationDashboard: Story = {
  render: () => {
    const [selectedProviders, setSelectedProviders] = useState<APIProvider[]>([
      mockProviders[0], // OpenAI is pre-selected
    ])
    
    const handleAddProvider = (provider: APIProvider) => {
      setSelectedProviders(prev => {
        if (prev.some(p => p.id === provider.id)) return prev
        return [...prev, { ...provider, isAdded: true }]
      })
    }

    const handleRemoveProvider = (provider: APIProvider) => {
      setSelectedProviders(prev => prev.filter(p => p.id !== provider.id))
    }

    const providersWithAddedState = mockProviders.map(provider => ({
      ...provider,
      isAdded: selectedProviders.some(selected => selected.id === provider.id)
    }))

    return (
      <PageContainer fullscreen>
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              RAG Evaluation API Integration
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Select and configure APIs for your RAG evaluation system. 
              Choose from AI models, data sources, and utility services.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* API Gallery */}
            <div className="lg:col-span-3">
              <APIGallery
                providers={providersWithAddedState}
                onAddProvider={handleAddProvider}
                onRemoveProvider={handleRemoveProvider}
              />
            </div>

            {/* Selected Providers Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-6">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Selected Providers ({selectedProviders.length})
                  </h3>

                  {selectedProviders.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No APIs selected yet. Browse the gallery to add APIs to your RAG system.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedProviders.map((provider) => (
                        <div key={provider.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {provider.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {provider.website}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveProvider(provider)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                      Configure RAG System
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </PageContainer>
    )
  },
  parameters: {
    layout: 'fullscreen',
  },
}

// Filter and search demo
export const FilteringDemo: Story = {
  render: () => (
    <PageContainer>
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Try the Filtering Features
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Search for "OpenAI" or "email" in the search box</li>
          <li>• Filter by category (AI/ML, Payments, Communication, etc.)</li>
          <li>• Filter by provider (OpenAI, Google, Stripe, etc.)</li>
          <li>• Sort by rating, usage, name, or last updated</li>
        </ul>
      </div>
      
      <APIGallery providers={mockProviders} />
    </PageContainer>
  ),
}

// Different API states
export const APIStates: Story = {
  render: () => {
    return (
      <PageContainer>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2"></div>
            <p className="text-sm font-medium">Active APIs</p>
            <p className="text-xs text-gray-500">Production ready</p>
          </div>
          <div className="text-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-2"></div>
            <p className="text-sm font-medium">Beta APIs</p>
            <p className="text-xs text-gray-500">Testing phase</p>
          </div>
          <div className="text-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-2"></div>
            <p className="text-sm font-medium">Deprecated APIs</p>
            <p className="text-xs text-gray-500">Being phased out</p>
          </div>
        </div>
        
        <APIGallery providers={mockProviders} showFilters={false} />
      </PageContainer>
    )
  },
}

// Empty state
export const EmptyState: Story = {
  args: {
    providers: [],
  },
}