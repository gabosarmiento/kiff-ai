import React, { useState, useEffect } from 'react'
import { Activity, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

interface TokenConsumptionData {
  total_tokens: number
  formatted_total: string
  input_tokens: number
  output_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  generation_tokens: number
  chat_tokens: number
  api_indexing_tokens: number
  other_tokens: number
}

interface CycleInfo {
  cycle_start: string
  cycle_end: string
  days_remaining: number
  cycle_type: string
  plan_type: string
}

interface TokenUsageHistoryEntry {
  consumption: TokenConsumptionData
  cycle_info: CycleInfo
}

interface TokenUsageHistoryProps {
  tenantId: string
  userId: string
  className?: string
}

export const TokenUsageHistory: React.FC<TokenUsageHistoryProps> = ({ 
  tenantId, 
  userId, 
  className = "" 
}) => {
  const [currentCycle, setCurrentCycle] = useState<TokenUsageHistoryEntry | null>(null)
  const [history, setHistory] = useState<TokenUsageHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const fetchTokenUsage = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch current cycle consumption
      const token = localStorage.getItem('authToken')
      const currentResponse = await fetch(
        `/api/billing/consumption/current?tenant_id=${tenantId}&user_id=${userId}`,
        {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Tenant-ID': tenantId,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!currentResponse.ok) {
        throw new Error(`Failed to fetch current consumption: ${currentResponse.status}`)
      }

      const currentData = await currentResponse.json()
      if (currentData.success) {
        // Mock cycle info for current consumption
        setCurrentCycle({
          consumption: currentData.data.consumption,
          cycle_info: {
            cycle_start: new Date().toISOString(),
            cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            days_remaining: 30,
            cycle_type: 'monthly',
            plan_type: 'free'
          }
        })
      }

      // Fetch historical data
      const historyResponse = await fetch(
        `/api/billing/consumption/history?tenant_id=${tenantId}&user_id=${userId}&limit=5`,
        {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Tenant-ID': tenantId,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!historyResponse.ok) {
        throw new Error(`Failed to fetch history: ${historyResponse.status}`)
      }

      const historyData = await historyResponse.json()
      if (historyData.success) {
        setHistory(historyData.data.history)
      }

    } catch (err) {
      console.error('Error fetching token usage:', err)
      setError(err instanceof Error ? err.message : 'Failed to load token usage')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId && userId) {
      fetchTokenUsage()
    }
  }, [tenantId, userId])

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`
    } else if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`
    } else {
      return `${tokens}`
    }
  }

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Token Usage</h3>
          <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
        </div>
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
          <div className="text-sm text-slate-500">Loading token usage...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-3 ${className}`}>
        <h3 className="text-lg font-semibold text-slate-100">Token Usage</h3>
        <div className="bg-red-900/20 rounded-lg border border-red-700/50 p-4">
          <div className="text-sm text-red-400">Error: {error}</div>
          <button 
            onClick={fetchTokenUsage}
            className="mt-2 px-3 py-1 bg-red-900/30 hover:bg-red-900/40 text-red-400 rounded text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const totalTokens = currentCycle?.consumption?.total_tokens || 0

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Token Usage</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center space-x-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          <span>{expanded ? 'Hide Details' : 'View Details'}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Current Cycle Summary */}
      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-slate-300 font-medium">Current Billing Cycle</span>
          </div>
          <div className="text-lg font-semibold text-blue-400">
            {formatTokens(totalTokens)} tokens
          </div>
        </div>
        
        {currentCycle?.cycle_info && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Monthly cycle</span>
            <span>{currentCycle.cycle_info.days_remaining} days remaining</span>
          </div>
        )}

        {/* Breakdown if expanded */}
        {expanded && currentCycle?.consumption && (
          <div className="mt-4 pt-3 border-t border-slate-700/30 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Input tokens:</span>
              <span className="ml-2 text-slate-300">{formatTokens(currentCycle.consumption.total_input_tokens || 0)}</span>
            </div>
            <div>
              <span className="text-slate-500">Output tokens:</span>
              <span className="ml-2 text-slate-300">{formatTokens(currentCycle.consumption.total_output_tokens || 0)}</span>
            </div>
            <div>
              <span className="text-slate-500">Generation:</span>
              <span className="ml-2 text-slate-300">{formatTokens(currentCycle.consumption.generation_tokens || 0)}</span>
            </div>
            <div>
              <span className="text-slate-500">Chat:</span>
              <span className="ml-2 text-slate-300">{formatTokens(currentCycle.consumption.chat_tokens || 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Historical Data */}
      {expanded && (
        <div className="space-y-3">
          <h4 className="text-md font-medium text-slate-300 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>Usage History</span>
          </h4>
          
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.map((entry, index) => (
                <div 
                  key={index}
                  className="bg-slate-800/20 rounded-lg border border-slate-700/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-400">
                        {formatDate(entry.cycle_info?.cycle_start || '')} - {formatDate(entry.cycle_info?.cycle_end || '')}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-300">
                      {entry.consumption?.formatted_total || '0 tokens'}
                    </div>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>Input: {formatTokens(entry.consumption?.total_input_tokens || 0)}</span>
                    <span>Output: {formatTokens(entry.consumption?.total_output_tokens || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800/20 rounded-lg border border-slate-700/30 p-4 text-center">
              <Activity className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No usage history available</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}