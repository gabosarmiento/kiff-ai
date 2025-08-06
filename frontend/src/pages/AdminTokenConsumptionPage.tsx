import React, { useState, useEffect } from 'react'
import { Activity, Users, TrendingUp, Calendar, Download } from 'lucide-react'

interface TenantConsumption {
  user_id: string
  consumption: {
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
  cycle_info: {
    cycle_start: string
    cycle_end: string
    days_remaining: number
    cycle_type: string
    plan_type: string
  }
}

interface TenantTotals {
  total_tokens: number
  formatted_total: string
}

export function AdminTokenConsumptionPage() {
  const [tenantData, setTenantData] = useState<TenantConsumption[]>([])
  const [tenantTotals, setTenantTotals] = useState<TenantTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTenantId] = useState('4485db48-71b7-47b0-8128-c6dca5be352d') // Demo tenant

  const fetchTenantConsumption = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('authToken')
      const response = await fetch(
        `/api/billing/consumption/tenant-overview?tenant_id=${selectedTenantId}&limit=50`,
        {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Tenant-ID': selectedTenantId,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch tenant consumption: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setTenantData(data.data.tenant_overview)
        setTenantTotals(data.data.tenant_totals)
      } else {
        throw new Error('API returned unsuccessful response')
      }
    } catch (err) {
      console.error('Error fetching tenant consumption:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tenant consumption')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenantConsumption()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchTenantConsumption, 60000)
    return () => clearInterval(interval)
  }, [selectedTenantId])

  const exportToCSV = () => {
    const headers = ['User ID', 'Total Tokens', 'Input Tokens', 'Output Tokens', 'Generation Tokens', 'Chat Tokens', 'Plan Type', 'Days Remaining']
    const csvData = [
      headers.join(','),
      ...tenantData.map(user => [
        user.user_id,
        user.consumption?.total_tokens || 0,
        user.consumption?.total_input_tokens || 0,
        user.consumption?.total_output_tokens || 0,
        user.consumption?.generation_tokens || 0,
        user.consumption?.chat_tokens || 0,
        user.cycle_info?.plan_type || 'free',
        user.cycle_info?.days_remaining || 0
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tenant-token-consumption-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-slate-600">Loading tenant consumption data...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-red-500" />
            <span className="text-red-700">Error: {error}</span>
          </div>
          <button 
            onClick={fetchTenantConsumption}
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Token Consumption Overview</h1>
          <p className="text-slate-600 mt-1">Monitor token usage across all tenant users</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={fetchTenantConsumption}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
          >
            <Activity className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-slate-800">{tenantData.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Total Tokens Consumed</p>
              <p className="text-2xl font-bold text-slate-800">
                {tenantTotals?.formatted_total || '0 tokens'}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm">Average per User</p>
              <p className="text-2xl font-bold text-slate-800">
                {tenantData.length > 0 
                  ? Math.round((tenantTotals?.total_tokens || 0) / tenantData.length).toLocaleString()
                  : '0'
                }
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* User Consumption Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">User Consumption Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-slate-600">User ID</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Total Tokens</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Input/Output</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">By Operation</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Plan</th>
                <th className="text-left p-4 text-sm font-medium text-slate-600">Cycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tenantData.map((user) => (
                <tr key={user.user_id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{user.user_id}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-blue-600">
                      {user.consumption?.formatted_total || '0 tokens'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-600">
                      <div>In: {(user.consumption?.total_input_tokens || 0).toLocaleString()}</div>
                      <div>Out: {(user.consumption?.total_output_tokens || 0).toLocaleString()}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-600">
                      <div>Gen: {(user.consumption?.generation_tokens || 0).toLocaleString()}</div>
                      <div>Chat: {(user.consumption?.chat_tokens || 0).toLocaleString()}</div>
                      <div>Other: {(user.consumption?.other_tokens || 0).toLocaleString()}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      user.cycle_info?.plan_type === 'pro' 
                        ? 'bg-purple-100 text-purple-800'
                        : user.cycle_info?.plan_type === 'pay_per_token'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.cycle_info?.plan_type || 'free'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">
                        {user.cycle_info?.days_remaining || 0} days left
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tenantData.length === 0 && (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No token consumption data available</p>
          </div>
        )}
      </div>
    </div>
  )
}