import React, { useState, useMemo } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Card, CardHeader, CardContent, CardFooter } from './Card'
import { Input } from './Input'
import { Badge } from './Badge'
import { 
  Search, Plus, ExternalLink, Check, ArrowRight, Info
} from 'lucide-react'

export interface APIProvider {
  id: string
  name: string
  description: string
  logo?: string
  website: string
  categories: string[]
  apis: {
    id: string
    name: string
    description: string
    endpoint: string
    method: string
    documentation: string
  }[]
  isAdded?: boolean
  selectedAPIs?: string[] // IDs of selected individual APIs
}

export interface APIGalleryProps {
  providers?: APIProvider[]
  onAddProvider?: (provider: APIProvider) => void
  onRemoveProvider?: (provider: APIProvider) => void
  onViewDetails?: (provider: APIProvider) => void
  className?: string
  compact?: boolean
  showFilters?: boolean
}

// Mock provider data
const defaultProviders: APIProvider[] = [
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
      },
      {
        id: 'maps-geocoding',
        name: 'Maps Geocoding',
        description: 'Convert addresses to coordinates and vice versa',
        endpoint: 'https://maps.googleapis.com/maps/api/geocode/json',
        method: 'GET',
        documentation: 'https://developers.google.com/maps/documentation/geocoding'
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
    id: 'twilio',
    name: 'Twilio',
    description: 'Cloud communications platform for SMS, voice, video, and email.',
    logo: '📱',
    website: 'https://twilio.com',
    categories: ['Communication', 'SMS', 'Voice'],
    apis: [
      {
        id: 'messages',
        name: 'Messages (SMS)',
        description: 'Send and receive SMS messages globally',
        endpoint: 'https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json',
        method: 'POST',
        documentation: 'https://www.twilio.com/docs/sms/api'
      },
      {
        id: 'voice',
        name: 'Voice',
        description: 'Make and receive phone calls programmatically',
        endpoint: 'https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Calls.json',
        method: 'POST',
        documentation: 'https://www.twilio.com/docs/voice/api'
      }
    ]
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Email delivery service for transactional and marketing emails.',
    logo: '📧',
    website: 'https://sendgrid.com',
    categories: ['Communication', 'Email', 'Marketing'],
    apis: [
      {
        id: 'mail-send',
        name: 'Mail Send',
        description: 'Send transactional and marketing emails',
        endpoint: 'https://api.sendgrid.com/v3/mail/send',
        method: 'POST',
        documentation: 'https://docs.sendgrid.com/api-reference/mail-send'
      },
      {
        id: 'contacts',
        name: 'Contacts',
        description: 'Manage email contact lists and segments',
        endpoint: 'https://api.sendgrid.com/v3/marketing/contacts',
        method: 'PUT',
        documentation: 'https://docs.sendgrid.com/api-reference/contacts'
      }
    ]
  },
]

const allCategories = Array.from(
  new Set(defaultProviders.flatMap(p => p.categories))
).map(cat => ({ label: cat, value: cat }))

export const APIGallery = React.forwardRef<HTMLDivElement, APIGalleryProps>(({
  providers = defaultProviders,
  onAddProvider,
  onRemoveProvider,
  onViewDetails,
  className,
  compact = false,
  showFilters = true,
  ...props
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const filteredProviders = useMemo(() => {
    return providers.filter(provider => {
      const matchesSearch = provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           provider.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           provider.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategories = selectedCategories.length === 0 || 
                               selectedCategories.some(cat => provider.categories.includes(cat))
      
      return matchesSearch && matchesCategories
    })
  }, [providers, searchQuery, selectedCategories])

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  return (
    <div ref={ref} className={cn('space-y-6', className)} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            API Gallery
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Browse and integrate API providers into your system
          </p>
        </div>
        <Badge variant="info" size="sm">
          {filteredProviders.length} providers available
        </Badge>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-4">
          {/* Search */}
          <div className="max-w-md">
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          
          {/* Horizontal Category Filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              Categories:
            </span>
            {allCategories.map((category) => (
              <Button
                key={category.value}
                variant={selectedCategories.includes(category.value) ? "primary" : "outline"}
                size="sm"
                onClick={() => toggleCategory(category.value)}
                className="h-8 px-3 text-xs"
              >
                {category.label}
              </Button>
            ))}
            {selectedCategories.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategories([])}
                className="h-8 px-3 text-xs text-gray-500"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Provider Grid */}
      <div className={cn(
        "grid gap-6",
        compact 
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        {filteredProviders.map((provider) => (
          <Card key={provider.id} variant="elevated" className="hover:shadow-xl transition-all duration-300 group">
            <CardHeader className={compact ? "pb-3" : "pb-4"}>
              <div className="flex items-start gap-3">
                {/* Logo */}
                <div className="text-3xl flex-shrink-0">
                  {provider.logo}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {provider.name}
                  </h3>
                  {!compact && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {provider.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {provider.apis.length} API{provider.apis.length !== 1 ? 's' : ''} available
                  </div>
                </div>
                
                {provider.isAdded && (
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                )}
              </div>
            </CardHeader>

            {!compact && (
              <CardContent className="py-3">
                {/* Categories */}
                <div className="flex flex-wrap gap-1">
                  {provider.categories.slice(0, 3).map((category) => (
                    <Badge key={category} variant="secondary" size="sm">
                      {category}
                    </Badge>
                  ))}
                  {provider.categories.length > 3 && (
                    <Badge variant="secondary" size="sm">
                      +{provider.categories.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            )}

            <CardFooter divider={!compact} className={compact ? "pt-3" : "pt-4"}>
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails?.(provider)}
                  className="flex-1"
                >
                  <Info className="h-4 w-4 mr-2" />
                  View APIs
                </Button>
                
                {provider.isAdded ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRemoveProvider?.(provider)}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Added
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onAddProvider?.(provider)}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

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
            Try adjusting your search criteria or category filters.
          </p>
          <Button variant="outline" onClick={() => {
            setSearchQuery('')
            setSelectedCategories([])
          }}>
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
})

APIGallery.displayName = 'APIGallery'