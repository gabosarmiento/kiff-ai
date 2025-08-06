import React, { useState, useEffect } from 'react'
import { 
  Flag, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'react-hot-toast'

interface FeatureFlag {
  id: number
  name: string
  description: string
  is_enabled: boolean
  rollout_percentage: number
  created_at: string
}

const AdminFeatureFlagsPage: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const fetchFeatureFlags = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/feature-flags/', {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Feature flags API error:', {status: response.status, statusText: response.statusText, body: errorText})
        throw new Error(`Failed to fetch feature flags: ${response.statusText} (${response.status})`)
      }

      const data = await response.json()
      setFlags(data)
    } catch (err) {
      console.error('Error fetching feature flags:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      toast.error('Failed to load feature flags')
    } finally {
      setLoading(false)
    }
  }

  const toggleFeatureFlag = async (flagId: number, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/feature-flags/${flagId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to toggle feature flag: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Update local state
      setFlags(flags.map(flag => 
        flag.id === flagId 
          ? { ...flag, is_enabled: result.is_enabled }
          : flag
      ))
      
      const status = result.is_enabled ? 'enabled' : 'disabled'
      toast.success(`Feature flag ${status} successfully`)
      
    } catch (err) {
      console.error('Error toggling feature flag:', err)
      toast.error('Failed to toggle feature flag')
    }
  }

  const toggleAllFlags = async (enable: boolean) => {
    try {
      const togglePromises = flags.map(flag => 
        flag.is_enabled !== enable ? toggleFeatureFlag(flag.id, flag.is_enabled) : Promise.resolve()
      )
      
      await Promise.all(togglePromises)
      const action = enable ? 'enabled' : 'disabled'
      toast.success(`All feature flags ${action}`)
      
    } catch (err) {
      console.error('Error toggling all flags:', err)
      toast.error('Failed to toggle all feature flags')
    }
  }

  useEffect(() => {
    fetchFeatureFlags()
  }, [])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mr-3" />
          <span className="text-lg text-gray-600">Loading feature flags...</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Feature Flags</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchFeatureFlags}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Bulk Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Actions</h3>
          <div className="flex space-x-4">
            <button
              onClick={() => toggleAllFlags(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ToggleRight className="w-4 h-4 mr-2" />
              Enable All Flags
            </button>
            <button
              onClick={() => toggleAllFlags(false)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <ToggleLeft className="w-4 h-4 mr-2" />
              Disable All Flags
            </button>
          </div>
        </div>

        {/* Feature Flags List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Feature Flags</h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchFeatureFlags}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Flag
                </button>
              </div>
            </div>
          </div>

          {flags.length === 0 ? (
            <div className="text-center py-12">
              <Flag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Feature Flags</h3>
              <p className="text-gray-600 mb-4">Create your first feature flag to control UI features</p>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Feature Flag
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {flags.map((flag) => (
                <div key={flag.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <div className="flex items-center mr-4">
                          {flag.is_enabled ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400 mr-2" />
                          )}
                          <h4 className="text-lg font-medium text-gray-900">
                            {flag.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </h4>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          flag.is_enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {flag.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      
                      {flag.description && (
                        <p className="text-gray-600 mb-3">{flag.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span>ID: {flag.id}</span>
                        <span>Rollout: {flag.rollout_percentage}%</span>
                        <span>Created: {new Date(flag.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 ml-6">
                      <Switch
                        checked={flag.is_enabled}
                        onCheckedChange={() => toggleFeatureFlag(flag.id, flag.is_enabled)}
                        className="data-[state=checked]:bg-green-500"
                      />
                      <button
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center">
              <Flag className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
                <p className="text-gray-600">Control UI features and manage rollouts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderContent()}
        </div>
    </div>
  )
}

export default AdminFeatureFlagsPage