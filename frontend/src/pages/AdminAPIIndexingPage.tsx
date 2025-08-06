import React, { useState, useEffect } from 'react'
import { 
  Database, 
  Server, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Users,
  Activity,
  BarChart3,
  Settings
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useTenant } from '../contexts/TenantContext'

interface CacheEntry {
  api_name: string
  display_name: string
  status: string
  original_cost: number
  fractional_cost: number
  revenue_generated: number
  usage_count: number
  urls_indexed: number
  created_at: string
}

interface AdminOverview {
  total_cached_apis: number
  total_original_indexing_cost: number
  total_fractional_revenue: number
  cost_recovery_ratio: number
  cached_apis: CacheEntry[]
}

interface BillingMetrics {
  total_tokens: number
  total_operations: number
  preprocessing_tokens: number
  admin_tokens: number
  batch_operations: number
  api_endpoints_processed: number
}

export const AdminAPIIndexingPage: React.FC = () => {
  const { tenantId } = useTenant()
  
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [billingMetrics, setBillingMetrics] = useState<BillingMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [preIndexing, setPreIndexing] = useState(false)
  const [selectedAPIs, setSelectedAPIs] = useState<string[]>([])

  useEffect(() => {
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      // Load cache overview
      const overviewRes = await fetch('/api/gallery/cache/admin/overview')
      if (overviewRes.ok) {
        const overviewData = await overviewRes.json()
        setOverview(overviewData)
      }

      // Load billing metrics
      const billingRes = await fetch('/api/v1/billing/admin/consumption-summary')
      if (billingRes.ok) {
        const billingData = await billingRes.json()
        setBillingMetrics(billingData)
      }

    } catch (error) {
      console.error('Failed to load admin data:', error)
      toast.error('Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  const startPreIndexing = async (apiNames: string[]) => {
    try {
      setPreIndexing(true)
      
      const response = await fetch('/api/gallery/cache/admin/pre-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_names: apiNames,
          force_reindex: false
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`🚀 Started pre-indexing ${result.apis_queued.length} APIs - Batch: ${result.batch_id}`)
        
        // Poll for updates
        setTimeout(() => {
          loadAdminData()
        }, 5000)
      } else {
        throw new Error('Pre-indexing request failed')
      }

    } catch (error) {
      console.error('Pre-indexing failed:', error)
      toast.error('Failed to start pre-indexing')
    } finally {
      setPreIndexing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cached': return 'text-green-400'
      case 'indexing': return 'text-blue-400'
      case 'failed': return 'text-red-400'
      default: return 'text-slate-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'cached': return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'indexing': return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center">
            <Server className="w-6 h-6 mr-2 text-cyan-400" />
            Admin API Indexing Cache
          </h1>
          <p className="text-slate-400 mt-1">
            Manage cost-sharing cached API indexing system
          </p>
        </div>
        
        <button
          onClick={() => startPreIndexing(['stripe', 'openai', 'stability_ai'])}
          disabled={preIndexing}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Database className="w-4 h-4" />
          <span>{preIndexing ? 'Pre-indexing...' : 'Pre-index Popular APIs'}</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-100">
                {overview?.total_cached_apis || 0}
              </div>
              <div className="text-sm text-slate-400">Cached APIs</div>
            </div>
            <Database className="w-8 h-8 text-cyan-400" />
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-400">
                ${overview?.total_fractional_revenue.toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-slate-400">Revenue Generated</div>
            </div>
            <DollarSign className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {overview?.cost_recovery_ratio ? (overview.cost_recovery_ratio * 100).toFixed(1) : '0'}%
              </div>
              <div className="text-sm text-slate-400">Cost Recovery</div>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {billingMetrics?.total_operations || 0}
              </div>
              <div className="text-sm text-slate-400">Admin Operations</div>
            </div>
            <Activity className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Billing Metrics */}
      {billingMetrics && (
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-cyan-400" />
            Admin Consumption Metrics
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{billingMetrics.total_tokens.toLocaleString()}</div>
              <div className="text-sm text-slate-400">Total Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{billingMetrics.preprocessing_tokens.toLocaleString()}</div>
              <div className="text-sm text-slate-400">Preprocessing Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{billingMetrics.batch_operations}</div>
              <div className="text-sm text-slate-400">Batch Operations</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{billingMetrics.api_endpoints_processed}</div>
              <div className="text-sm text-slate-400">API Endpoints</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{billingMetrics.admin_tokens.toLocaleString()}</div>
              <div className="text-sm text-slate-400">Admin Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{billingMetrics.total_operations}</div>
              <div className="text-sm text-slate-400">Total Operations</div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Recovery Analysis */}
      {overview && (
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-400" />
            Cost Recovery Analysis
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Original Indexing Cost</div>
              <div className="text-xl font-bold text-red-400">
                ${overview.total_original_indexing_cost.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Revenue Generated</div>
              <div className="text-xl font-bold text-green-400">
                ${overview.total_fractional_revenue.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Net Position</div>
              <div className={`text-xl font-bold ${overview.total_fractional_revenue >= overview.total_original_indexing_cost ? 'text-green-400' : 'text-yellow-400'}`}>
                ${(overview.total_fractional_revenue - overview.total_original_indexing_cost).toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(overview.cost_recovery_ratio * 100, 100)}%` }}
            />
          </div>
          <div className="text-sm text-slate-400 mt-2">
            Cost recovery: {(overview.cost_recovery_ratio * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {/* Cached APIs Table */}
      {overview && overview.cached_apis.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center">
              <Database className="w-5 h-5 mr-2 text-cyan-400" />
              Cached APIs ({overview.cached_apis.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/30">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">API</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Original Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fractional Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Usage Count</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Revenue</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">URLs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {overview.cached_apis.map((api) => (
                  <tr key={api.api_name} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-slate-100">{api.display_name}</div>
                        <div className="text-sm text-slate-400">{api.api_name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(api.status)}
                        <span className={`text-sm font-medium ${getStatusColor(api.status)}`}>
                          {api.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      ${api.original_cost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-400 font-medium">
                      ${api.fractional_cost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">{api.usage_count}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-green-400 font-medium">
                      ${api.revenue_generated.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {api.urls_indexed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {overview && overview.cached_apis.length === 0 && (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400 mb-2">No cached APIs yet</h3>
          <p className="text-slate-500 mb-4">Start pre-indexing popular APIs to enable cost-sharing</p>
          <button
            onClick={() => startPreIndexing(['stripe', 'openai', 'stability_ai'])}
            disabled={preIndexing}
            className="btn btn-primary"
          >
            Pre-index Popular APIs
          </button>
        </div>
      )}
    </div>
  )
}