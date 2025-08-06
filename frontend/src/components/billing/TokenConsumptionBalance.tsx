import React, { useEffect, useState } from 'react'
import { Activity, TrendingUp } from 'lucide-react'

interface TokenConsumptionData {
  total_tokens: number
  formatted_total: string
  input_tokens: number
  output_tokens: number
}

interface CycleInfo {
  cycle_start: string
  cycle_end: string
  days_remaining: number
  cycle_type: string
  plan_type: string
}

interface TokenConsumptionBalanceProps {
  tenantId: string
  userId: string
  className?: string
}

export const TokenConsumptionBalance: React.FC<TokenConsumptionBalanceProps> = ({ 
  tenantId, 
  userId, 
  className = "" 
}) => {
  const [consumption, setConsumption] = useState<TokenConsumptionData | null>(null)
  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConsumption = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Validate required parameters
      if (!tenantId || !userId) {
        throw new Error('Missing tenant ID or user ID')
      }
      
      const token = localStorage.getItem('authToken')
      const response = await fetch(
        `/api/billing/consumption/dashboard-summary?tenant_id=${tenantId}&user_id=${userId}`,
        {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Tenant-ID': tenantId,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Token consumption API error:', response.status, errorText)
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setConsumption(data.data.consumption)
        setCycleInfo(data.data.cycle_info)
      } else {
        throw new Error(data.message || 'API returned unsuccessful response')
      }
    } catch (err) {
      console.error('Error fetching token consumption:', err)
      setError(err instanceof Error ? err.message : 'Failed to load token consumption')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId && userId) {
      fetchConsumption()
      // Set up polling every 30 seconds for real-time updates
      const interval = setInterval(fetchConsumption, 30000)
      return () => clearInterval(interval)
    } else {
      console.warn('TokenConsumptionBalance: Missing tenantId or userId', { tenantId, userId })
      setError('Missing tenant or user information')
    }
  }, [tenantId, userId])

  // Format large numbers for display
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M tokens`
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K tokens`
    } else {
      return `${tokens} tokens`
    }
  }

  if (loading) {
    return (
      <div className={`px-4 pb-3 ${className}`}>
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-xs text-slate-400">Tokens Used</span>
            </div>
            <div className="text-xs text-slate-500">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`px-4 pb-3 ${className}`}>
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-red-400" />
              <span className="text-xs text-slate-400">Tokens</span>
            </div>
            <div className="text-xs text-red-400">Error</div>
          </div>
        </div>
      </div>
    )
  }

  const totalTokens = consumption?.total_tokens || 0
  const formattedTotal = consumption?.formatted_total || '0 tokens'
  const daysRemaining = cycleInfo?.days_remaining || 0

  return (
    <div className={`px-4 pb-3 ${className}`}>
      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3">
        {/* Main consumption display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">Tokens Used</span>
          </div>
          <div className="text-sm font-semibold text-blue-400">
            {formatTokens(totalTokens)}
          </div>
        </div>
        
        {/* Cycle info */}
        {cycleInfo && (
          <div className="mt-2 pt-2 border-t border-slate-700/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-500">
                  {cycleInfo.cycle_type} cycle
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {daysRemaining > 0 ? `${daysRemaining} days left` : 'Cycle ending'}
              </div>
            </div>
          </div>
        )}
        
        {/* Breakdown for larger consumptions */}
        {consumption && totalTokens > 1000 && (
          <div className="mt-2 pt-2 border-t border-slate-700/30">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">
                Input: {formatTokens(consumption.input_tokens)}
              </span>
              <span className="text-slate-500">
                Output: {formatTokens(consumption.output_tokens)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}