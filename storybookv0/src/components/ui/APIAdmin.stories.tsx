import type { Meta, StoryObj } from '@storybook/react'
import { APIAdmin } from './APIAdmin'
import { APIProvider } from './APIGallery'
import { useState } from 'react'
import { PageContainer } from './PageContainer'

const meta: Meta<typeof APIAdmin> = {
  title: 'Admin/APIAdmin',
  component: APIAdmin,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Mock providers for admin
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
      },
      {
        id: 'images',
        name: 'Images (DALL-E)',
        description: 'Generate and edit images using DALL-E models',
        endpoint: 'https://api.openai.com/v1/images/generations',
        method: 'POST',
        documentation: 'https://platform.openai.com/docs/api-reference/images'
      }
    ]
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
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Complete payment infrastructure for internet businesses of all sizes.',
    logo: '💳',
    website: 'https://stripe.com',
    categories: ['Payments', 'Finance', 'E-commerce'],
    apis: [
      {
        id: 'payments',
        name: 'Payment Intents',
        description: 'Process payments with built-in authentication',
        endpoint: 'https://api.stripe.com/v1/payment_intents',
        method: 'POST',
        documentation: 'https://stripe.com/docs/api/payment_intents'
      },
      {
        id: 'customers',
        name: 'Customers',
        description: 'Manage customer information and payment methods',
        endpoint: 'https://api.stripe.com/v1/customers',
        method: 'POST',
        documentation: 'https://stripe.com/docs/api/customers'
      },
      {
        id: 'subscriptions',
        name: 'Subscriptions',
        description: 'Handle recurring billing and subscription management',
        endpoint: 'https://api.stripe.com/v1/subscriptions',
        method: 'POST',
        documentation: 'https://stripe.com/docs/api/subscriptions'
      }
    ]
  },
  {
    id: 'google',
    name: 'Google Cloud',
    description: 'Comprehensive cloud platform with AI, data, and infrastructure services.',
    logo: '🌐',
    website: 'https://cloud.google.com',
    categories: ['AI/ML', 'Data', 'Maps', 'Translation'],
    apis: [
      {
        id: 'translate',
        name: 'Translation API',
        description: 'Translate text between 100+ languages',
        endpoint: 'https://translation.googleapis.com/language/translate/v2',
        method: 'POST',
        documentation: 'https://cloud.google.com/translate/docs'
      },
      {
        id: 'vision',
        name: 'Vision API',
        description: 'Analyze images and detect objects, faces, and text',
        endpoint: 'https://vision.googleapis.com/v1/images:annotate',
        method: 'POST',
        documentation: 'https://cloud.google.com/vision/docs'
      }
    ]
  }
]

// Default admin view
export const Default: Story = {
  args: {
    providers: mockProviders,
  },
  render: (args) => (
    <PageContainer padded fullscreen>
      <APIAdmin {...args} />
    </PageContainer>
  ),
}

// Interactive admin demo
export const InteractiveDemo: Story = {
  render: () => {
    const [providers, setProviders] = useState<APIProvider[]>(mockProviders)

    const handleCreate = (newProvider: Omit<APIProvider, 'id'>) => {
      const provider: APIProvider = {
        ...newProvider,
        id: `provider-${Date.now()}`,
        apis: newProvider.apis.map((api, index) => ({
          ...api,
          id: `api-${Date.now()}-${index}`
        }))
      }
      setProviders(prev => [...prev, provider])
    }

    const handleUpdate = (id: string, updates: Partial<APIProvider>) => {
      setProviders(prev => prev.map(p => 
        p.id === id ? { ...p, ...updates } : p
      ))
    }

    const handleDelete = (id: string) => {
      if (window.confirm('Are you sure you want to delete this provider?')) {
        setProviders(prev => prev.filter(p => p.id !== id))
      }
    }

    return (
      <PageContainer padded fullscreen>
        <APIAdmin
          providers={providers}
          onCreateProvider={handleCreate}
          onUpdateProvider={handleUpdate}
          onDeleteProvider={handleDelete}
        />
      </PageContainer>
    )
  },
}

// Empty state
export const EmptyState: Story = {
  args: {
    providers: [],
  },
  render: (args) => (
    <PageContainer padded fullscreen>
      <APIAdmin {...args} />
    </PageContainer>
  ),
}

// Admin dashboard with stats
export const AdminDashboard: Story = {
  render: () => {
    const [providers, setProviders] = useState<APIProvider[]>(mockProviders)

    const totalAPIs = providers.reduce((sum, provider) => sum + provider.apis.length, 0)
    const totalCategories = new Set(providers.flatMap(p => p.categories)).size

    const handleCreate = (newProvider: Omit<APIProvider, 'id'>) => {
      const provider: APIProvider = {
        ...newProvider,
        id: `provider-${Date.now()}`,
        apis: newProvider.apis.map((api, index) => ({
          ...api,
          id: `api-${Date.now()}-${index}`
        }))
      }
      setProviders(prev => [...prev, provider])
    }

    const handleUpdate = (id: string, updates: Partial<APIProvider>) => {
      setProviders(prev => prev.map(p => 
        p.id === id ? { ...p, ...updates } : p
      ))
    }

    const handleDelete = (id: string) => {
      if (window.confirm('Are you sure you want to delete this provider?')) {
        setProviders(prev => prev.filter(p => p.id !== id))
      }
    }

    return (
      <PageContainer fullscreen>
        {/* Admin Header with Stats */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  API Gallery Administration
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Manage API providers and endpoints for the public gallery
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm font-medium rounded-full">
                  System Operational
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Providers</p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{providers.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🏢</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 dark:text-green-400 text-sm font-medium">Total APIs</p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">{totalAPIs}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🔌</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Categories</p>
                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{totalCategories}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🏷️</span>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">Active Status</p>
                    <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">100%</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-800 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Admin Interface */}
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <APIAdmin
            providers={providers}
            onCreateProvider={handleCreate}
            onUpdateProvider={handleUpdate}
            onDeleteProvider={handleDelete}
          />
        </div>
      </PageContainer>
    )
  },
  parameters: {
    layout: 'fullscreen',
  },
}

// Quick actions demo
export const QuickActions: Story = {
  render: () => (
    <PageContainer padded fullscreen>
      <div className="max-w-7xl mx-auto">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            Admin Quick Actions Demo
          </h3>
          <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
            <p>• <strong>Create Provider:</strong> Click "Add Provider" to create a new API provider</p>
            <p>• <strong>Edit Provider:</strong> Click the edit icon on any provider to modify details</p>
            <p>• <strong>Manage APIs:</strong> Add multiple API endpoints to each provider</p>
            <p>• <strong>Categories:</strong> Use suggested categories or create custom ones</p>
            <p>• <strong>Bulk Actions:</strong> Import/export provider data</p>
          </div>
        </div>

        <APIAdmin providers={mockProviders} />
      </div>
    </PageContainer>
  ),
}

// Mobile responsive demo
export const MobileView: Story = {
  args: {
    providers: mockProviders.slice(0, 2), // Fewer providers for mobile demo
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: (args) => (
    <PageContainer padded fullscreen>
      <APIAdmin {...args} />
    </PageContainer>
  ),
}

// Form validation demo
export const FormValidation: Story = {
  render: () => (
    <PageContainer padded fullscreen>
      <div className="max-w-4xl mx-auto">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Form Features Demo
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p>• <strong>Dynamic Categories:</strong> Add custom categories or use suggested ones</p>
            <p>• <strong>API Management:</strong> Add multiple APIs with different HTTP methods</p>
            <p>• <strong>Real-time Validation:</strong> Form validates as you type</p>
            <p>• <strong>Documentation Links:</strong> Each API can have documentation URLs</p>
            <p>• <strong>Logo Support:</strong> Use emojis or image URLs for provider logos</p>
          </div>
        </div>

        <APIAdmin providers={[]} />
      </div>
    </PageContainer>
  ),
}