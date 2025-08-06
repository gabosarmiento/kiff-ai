import React, { useState, useEffect } from 'react'
import { 
  Settings, 
  DollarSign, 
  Percent, 
  TrendingUp, 
  RefreshCw, 
  Save,
  AlertCircle,
  CheckCircle,
  Calculator,
  Users,
  Shield
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PricingRule {
  rule_id: string
  name: string
  description: string
  fractional_ratio: number
  fractional_percentage: number
  minimum_charge: number
  maximum_charge: number
  applies_to_apis: string[]
  applies_to_tiers: string[]
  active: boolean
  created_at: string
  created_by: string
}

interface TierConfig {
  tier: string
  display_name: string
  description: string
  monthly_credit: number
  free_api_access_count: number
  discount_percentage: number
  features: string[]
  priority_support: boolean
  maximum_monthly_spend?: number
}

interface PricingOverview {
  summary: any
  pricing_rules: PricingRule[]
  tier_configurations: TierConfig[]
  api_specific_pricing: any[]
  recent_changes: any[]
}

export const AdminPricingPage: React.FC = () => {
  const [overview, setOverview] = useState<PricingOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)

  // Calculator state
  const [calcApiName, setCalcApiName] = useState('stripe')
  const [calcOriginalCost, setCalcOriginalCost] = useState(5.0)
  const [calcTier, setCalcTier] = useState('demo')
  const [calcResult, setCalcResult] = useState<any>(null)

  useEffect(() => {
    loadPricingOverview()
  }, [])

  const loadPricingOverview = async () => {
    try {
      const response = await fetch('/api/admin/pricing/overview')
      if (response.ok) {
        const data = await response.json()
        setOverview(data)
      } else {
        throw new Error('Failed to load pricing overview')
      }
    } catch (error) {
      console.error('Failed to load pricing overview:', error)
      toast.error('Failed to load pricing configuration')
    } finally {
      setLoading(false)
    }
  }

  const updatePricingRule = async (ruleId: string, updates: any) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/admin/pricing/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        toast.success('Pricing rule updated successfully')
        await loadPricingOverview()
        setEditingRule(null)
      } else {
        throw new Error('Failed to update pricing rule')
      }
    } catch (error) {
      console.error('Failed to update pricing rule:', error)
      toast.error('Failed to update pricing rule')
    } finally {
      setUpdating(false)
    }
  }

  const calculateCost = async () => {
    try {
      const response = await fetch(`/api/admin/pricing/cost-calculator?api_name=${calcApiName}&original_cost=${calcOriginalCost}&tenant_tier=${calcTier}`)
      if (response.ok) {
        const result = await response.json()
        setCalcResult(result)
      } else {
        throw new Error('Cost calculation failed')
      }
    } catch (error) {
      console.error('Cost calculation failed:', error)
      toast.error('Cost calculation failed')
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
            <Settings className="w-6 h-6 mr-2 text-cyan-400" />
            Pricing Configuration
          </h1>
          <p className="text-slate-400 mt-1">
            Manage cost ratios, billing rules, and pricing tiers
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCalculatorOpen(!calculatorOpen)}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Calculator className="w-4 h-4" />
            <span>Cost Calculator</span>
          </button>
          
          <button
            onClick={loadPricingOverview}
            className="btn btn-primary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {overview.summary.active_rules}
                </div>
                <div className="text-sm text-slate-400">Active Rules</div>
              </div>
              <Shield className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {overview.tier_configurations.length}
                </div>
                <div className="text-sm text-slate-400">Pricing Tiers</div>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {overview.api_specific_pricing.length}
                </div>
                <div className="text-sm text-slate-400">Custom API Pricing</div>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {overview.recent_changes.length}
                </div>
                <div className="text-sm text-slate-400">Recent Changes</div>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Cost Calculator */}
      {calculatorOpen && (
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-cyan-400" />
            Cost Calculator
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">API Name</label>
              <input
                type="text"
                value={calcApiName}
                onChange={(e) => setCalcApiName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
                placeholder="e.g., stripe"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Original Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={calcOriginalCost}
                onChange={(e) => setCalcOriginalCost(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Tenant Tier</label>
              <select
                value={calcTier}
                onChange={(e) => setCalcTier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
              >
                <option value="free">Free</option>
                <option value="demo">Demo</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={calculateCost}
                className="btn btn-primary w-full"
              >
                Calculate
              </button>
            </div>
          </div>
          
          {calcResult && (
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-slate-400">Original Cost</div>
                  <div className="text-lg font-bold text-slate-100">
                    ${calcResult.calculation.original_cost.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">User Pays</div>
                  <div className="text-lg font-bold text-green-400">
                    ${calcResult.calculation.fractional_cost.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Savings</div>
                  <div className="text-lg font-bold text-blue-400">
                    ${calcResult.calculation.savings.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Savings %</div>
                  <div className="text-lg font-bold text-purple-400">
                    {calcResult.calculation.savings_percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pricing Rules */}
      {overview && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center">
              <Percent className="w-5 h-5 mr-2 text-cyan-400" />
              Pricing Rules ({overview.pricing_rules.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/30">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Rule</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fractional %</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Min Charge</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Max Charge</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {overview.pricing_rules.map((rule) => (
                  <tr key={rule.rule_id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-slate-100">{rule.name}</div>
                        <div className="text-sm text-slate-400">{rule.description}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingRule === rule.rule_id ? (
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={rule.fractional_percentage}
                          className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                          id={`ratio-${rule.rule_id}`}
                        />
                      ) : (
                        <span className="text-slate-100 font-medium">
                          {rule.fractional_percentage.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingRule === rule.rule_id ? (
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={rule.minimum_charge}
                          className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                          id={`min-${rule.rule_id}`}
                        />
                      ) : (
                        <span className="text-slate-100">${rule.minimum_charge.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingRule === rule.rule_id ? (
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={rule.maximum_charge}
                          className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                          id={`max-${rule.rule_id}`}
                        />
                      ) : (
                        <span className="text-slate-100">${rule.maximum_charge.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {rule.active ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className={rule.active ? 'text-green-400' : 'text-red-400'}>
                          {rule.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingRule === rule.rule_id ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              const ratioInput = document.getElementById(`ratio-${rule.rule_id}`) as HTMLInputElement
                              const minInput = document.getElementById(`min-${rule.rule_id}`) as HTMLInputElement
                              const maxInput = document.getElementById(`max-${rule.rule_id}`) as HTMLInputElement
                              
                              updatePricingRule(rule.rule_id, {
                                fractional_ratio: parseFloat(ratioInput.value) / 100,
                                minimum_charge: parseFloat(minInput.value),
                                maximum_charge: parseFloat(maxInput.value),
                                reason: "Admin UI update"
                              })
                            }}
                            disabled={updating}
                            className="text-green-400 hover:text-green-300 disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingRule(null)}
                            className="text-slate-400 hover:text-slate-300"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingRule(rule.rule_id)}
                          className="text-cyan-400 hover:text-cyan-300 text-sm"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing Tiers */}
      {overview && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-400" />
              Pricing Tiers ({overview.tier_configurations.length})
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {overview.tier_configurations.map((tier) => (
              <div key={tier.tier} className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-100">{tier.display_name}</h3>
                  {tier.priority_support && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                      Priority
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-slate-400 mb-3">{tier.description}</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Credit:</span>
                    <span className="text-green-400 font-medium">${tier.monthly_credit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Free APIs:</span>
                    <span className="text-slate-100">{tier.free_api_access_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Discount:</span>
                    <span className="text-blue-400">{tier.discount_percentage.toFixed(0)}%</span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <div className="text-xs text-slate-400">Features:</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tier.features.slice(0, 2).map((feature, idx) => (
                      <span key={idx} className="px-2 py-1 bg-slate-600/50 text-slate-300 text-xs rounded">
                        {feature}
                      </span>
                    ))}
                    {tier.features.length > 2 && (
                      <span className="px-2 py-1 bg-slate-600/50 text-slate-300 text-xs rounded">
                        +{tier.features.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}