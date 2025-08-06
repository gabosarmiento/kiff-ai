import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Flag, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface FeatureFlag {
  id: number
  name: string
  description: string
  is_enabled: boolean
  rollout_percentage: number
  created_at: string
}

export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFeatureFlags = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/feature-flags/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch feature flags: ${response.statusText}`)
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
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
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

  useEffect(() => {
    fetchFeatureFlags()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Flag className="w-5 h-5 mr-2" />
            Feature Flags
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading feature flags...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Flag className="w-5 h-5 mr-2" />
            Feature Flags
          </h3>
          <button
            onClick={fetchFeatureFlags}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-center py-8 text-red-600">
          <AlertCircle className="w-6 h-6 mr-2" />
          <span>Error: {error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Flag className="w-5 h-5 mr-2" />
          Feature Flags
        </h3>
        <button
          onClick={fetchFeatureFlags}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {flags.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No feature flags configured
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <div key={flag.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <h4 className="text-sm font-medium text-gray-900 mr-2">
                    {flag.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  {flag.is_enabled ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                {flag.description && (
                  <p className="text-xs text-gray-600">{flag.description}</p>
                )}
                <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                  <span>ID: {flag.id}</span>
                  <span>Rollout: {flag.rollout_percentage}%</span>
                  <span>Created: {new Date(flag.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="ml-4">
                <Switch
                  checked={flag.is_enabled}
                  onCheckedChange={() => toggleFeatureFlag(flag.id, flag.is_enabled)}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}