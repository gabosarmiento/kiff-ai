import { useState, useEffect } from 'react'

interface FeatureFlags {
  [key: string]: boolean
}

interface UseFeatureFlagsReturn {
  flags: FeatureFlags
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const [flags, setFlags] = useState<FeatureFlags>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFeatureFlags = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/feature-flags/public/enabled')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch feature flags: ${response.statusText}`)
      }
      
      const data = await response.json()
      setFlags(data)
      
    } catch (err) {
      console.error('Error fetching feature flags:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Set default flags if fetch fails
      setFlags({
        api_gallery_enabled: false // Default to disabled if can't fetch
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFeatureFlags()
  }, [])

  return {
    flags,
    isLoading,
    error,
    refetch: fetchFeatureFlags
  }
}

// Helper hook for specific feature flag
export function useFeatureFlag(flagName: string, defaultValue: boolean = false): boolean {
  const { flags, isLoading } = useFeatureFlags()
  
  if (isLoading) {
    return defaultValue
  }
  
  return flags[flagName] ?? defaultValue
}