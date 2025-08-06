import React, { useState, useEffect, useRef } from 'react'
import { Activity, Zap } from 'lucide-react'

interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cached_tokens: number
  reasoning_tokens: number
  audio_tokens: number
  cache_write_tokens: number
  cache_read_tokens: number
  display: string
}

interface TokenCounterProps {
  tenantId: string
  userId?: string
  sessionId?: string
  showDetails?: boolean
  className?: string
  trackingLevel?: 'session' | 'tenant' // New prop to choose tracking level
}

export function TokenCounter({ 
  tenantId, 
  userId, 
  sessionId, 
  showDetails = false, 
  className = "",
  trackingLevel = 'tenant' // Default to tenant-level tracking
}: TokenCounterProps) {
  const [usage, setUsage] = useState<TokenUsage>({
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cached_tokens: 0,
    reasoning_tokens: 0,
    audio_tokens: 0,
    cache_write_tokens: 0,
    cache_read_tokens: 0,
    display: "0 tokens"
  })
  
  const [isConnected, setIsConnected] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    if (!tenantId) return
    if (trackingLevel === 'session' && (!userId || !sessionId)) return

    // Create WebSocket connection for real-time updates
    const wsUrl = trackingLevel === 'tenant' 
      ? `ws://${window.location.hostname}:${window.location.port}/api/token-tracking/ws/tenant/${tenantId}`
      : `ws://${window.location.hostname}:${window.location.port}/api/token-tracking/ws/${tenantId}/${userId}/${sessionId}`
    
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(wsUrl)
        
        wsRef.current.onopen = () => {
          setIsConnected(true)
          console.log('Token tracking WebSocket connected')
        }
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            if ((data.type === 'token_update' || data.type === 'tenant_token_update') && data.data) {
              // Animate only if tokens increased
              const newTotal = data.data.total_tokens
              const oldTotal = usage.total_tokens
              
              if (newTotal > oldTotal) {
                setIsAnimating(true)
                setTimeout(() => setIsAnimating(false), 500)
              }
              
              setUsage(data.data)
              lastUpdateRef.current = Date.now()
            }
          } catch (error) {
            console.error('Error parsing token update:', error)
          }
        }
        
        wsRef.current.onclose = () => {
          setIsConnected(false)
          // Attempt to reconnect after 2 seconds
          setTimeout(connectWebSocket, 2000)
        }
        
        wsRef.current.onerror = (error) => {
          console.error('Token tracking WebSocket error:', error)
          setIsConnected(false)
        }
        
      } catch (error) {
        console.error('Error creating WebSocket:', error)
        setIsConnected(false)
        // Retry connection
        setTimeout(connectWebSocket, 2000)
      }
    }

    connectWebSocket()

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [tenantId, userId, sessionId, trackingLevel])

  // Fallback: fetch usage if WebSocket isn't working
  useEffect(() => {
    if (!isConnected && tenantId) {
      const fetchUsage = async () => {
        try {
          const url = trackingLevel === 'tenant' 
            ? `/api/token-tracking/tenant/${tenantId}`
            : `/api/token-tracking/usage/${tenantId}/${userId}/${sessionId}`
          
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data) {
              const usageData = trackingLevel === 'tenant' ? data.data.usage : data.data
              setUsage(usageData)
            }
          }
        } catch (error) {
          console.error('Error fetching token usage:', error)
        }
      }

      fetchUsage()
      const interval = setInterval(fetchUsage, 5000) // Poll every 5 seconds as fallback
      return () => clearInterval(interval)
    }
  }, [isConnected, tenantId, userId, sessionId, trackingLevel])

  const resetTokens = async () => {
    try {
      const response = await fetch(`/api/token-tracking/reset/${tenantId}/${userId}/${sessionId}`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error('Failed to reset tokens')
      }
    } catch (error) {
      console.error('Error resetting tokens:', error)
    }
  }

  if (!showDetails) {
    // Compact display for header/sidebar
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`flex items-center space-x-1 transition-all duration-300 ${
          isAnimating ? 'scale-110 text-green-400' : 'text-slate-400'
        }`}>
          <Activity className={`w-3 h-3 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
          <span className="text-xs font-mono">{usage.display}</span>
        </div>
      </div>
    )
  }

  // Detailed display
  return (
    <div className={`p-3 rounded-lg border border-slate-700/50 bg-slate-800/50 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Zap className={`w-4 h-4 ${isAnimating ? 'text-yellow-400' : 'text-slate-400'}`} />
          <span className="text-sm font-medium text-slate-200">Token Usage</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      
      <div className={`text-lg font-mono mb-3 transition-all duration-300 ${
        isAnimating ? 'text-green-400 scale-105' : 'text-slate-200'
      }`}>
        {usage.display}
      </div>
      
      <div className="space-y-1 text-xs text-slate-400">
        <div className="flex justify-between">
          <span>Input:</span>
          <span className="font-mono">{usage.input_tokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Output:</span>
          <span className="font-mono">{usage.output_tokens.toLocaleString()}</span>
        </div>
        {usage.cached_tokens > 0 && (
          <div className="flex justify-between">
            <span>Cached:</span>
            <span className="font-mono text-green-400">{usage.cached_tokens.toLocaleString()}</span>
          </div>
        )}
        {usage.reasoning_tokens > 0 && (
          <div className="flex justify-between">
            <span>Reasoning:</span>
            <span className="font-mono text-blue-400">{usage.reasoning_tokens.toLocaleString()}</span>
          </div>
        )}
      </div>
      
      <button
        onClick={resetTokens}
        className="w-full mt-3 px-2 py-1 text-xs bg-slate-700/50 hover:bg-slate-600/50 rounded transition-colors text-slate-300"
      >
        Reset
      </button>
    </div>
  )
}