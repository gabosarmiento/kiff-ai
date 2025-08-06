/**
 * SaaS Admin Dashboard for kiff
 * Comprehensive backoffice management interface
 */

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/utils/apiConfig';
import { useAdminStore } from '@/store/useAdminStore';
import { 
  Users, 
  Activity, 
  DollarSign, 
  Server, 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  Settings,
  BarChart3,
  MessageSquare,
  Database,
  Cpu,
  MemoryStick,
  Brain,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { DashboardMetrics } from '@/store/useAdminStore';
import { FeatureFlagsPanel } from '@/components/admin/FeatureFlagsPanel';

interface AgenticInsight {
  id: number;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggested_action: string;
  user_id?: number;
  confidence_score: number;
  is_resolved: boolean;
  created_at: string;
  events_analyzed: number;
}

interface ActivitySummary {
  period_hours: number;
  total_events: number;
  active_users: number;
  event_type_breakdown: Record<string, number>;
  unresolved_insights: number;
  generated_at: string;
}



const AdminDashboardPage: React.FC = () => {
  // Use cached store instead of local state
  const {
    dashboardMetrics,
    setDashboardMetrics,
    setDashboardLoading,
    setDashboardError,
    isDashboardStale
  } = useAdminStore();
  
  // Add missing state variables that are referenced in the component
  const [loading, setLoading] = useState(false);
  const dashboardData = dashboardMetrics.data; // Access the actual data from cached structure
  
  // Keep some local state for UI-only data
  const [agenticInsights, setAgenticInsights] = useState<AgenticInsight[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  useEffect(() => {
    // Only fetch if data is stale or missing (smart caching)
    if (isDashboardStale()) {
      fetchDashboardData();
    }
    
    // Still fetch insights and activity summary as they're not cached yet
    fetchAgenticInsights();
    fetchActivitySummary();
    
    // Refresh data every 5 minutes instead of 30 seconds (less aggressive)
    const interval = setInterval(() => {
      if (isDashboardStale()) {
        fetchDashboardData();
      }
      fetchAgenticInsights();
      fetchActivitySummary();
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [selectedTimeRange, isDashboardStale]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setDashboardLoading(true);
      setDashboardError(null);
      
      // Use centralized API request with automatic token handling
      const response = await apiRequest('/api/admin/dashboard');

      if (response.ok) {
        const data = await response.json();
        setDashboardMetrics(data);
      } else {
        setDashboardError('Failed to fetch dashboard data');
        toast.error('Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardError('Error loading dashboard');
      toast.error('Error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemMetrics = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
      const hours = selectedTimeRange === '24h' ? 24 : selectedTimeRange === '7d' ? 168 : 24;
      
      const response = await apiRequest(`/api/admin/system/metrics?hours=${hours}`);

      if (response.ok) {
        const data = await response.json();
        // System metrics data received but not currently used in UI
        console.log('System metrics:', data);
      }
    } catch (error) {
      console.error('Error fetching system metrics:', error);
    }
  };

  const fetchAgenticInsights = async () => {
    try {
      setInsightsLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
      const days = selectedTimeRange === '24h' ? 1 : selectedTimeRange === '7d' ? 7 : 1;
      
      const response = await apiRequest(`/api/admin/analytics/insights?days=${days}&limit=20`);

      if (response.ok) {
        const insights = await response.json();
        setAgenticInsights(insights);
      } else {
        console.error('Failed to fetch agentic insights');
      }
    } catch (error) {
      console.error('Error fetching agentic insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  };

  const fetchActivitySummary = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
      const hours = selectedTimeRange === '24h' ? 24 : selectedTimeRange === '7d' ? 168 : 24;
      
      const response = await apiRequest(`/api/admin/analytics/activity-summary?hours=${hours}`);

      if (response.ok) {
        const summary = await response.json();
        setActivitySummary(summary);
      } else {
        console.error('Failed to fetch activity summary');
      }
    } catch (error) {
      console.error('Error fetching activity summary:', error);
    }
  };

  const triggerMonitoringCycle = async () => {
    try {
      const response = await apiRequest('/api/admin/analytics/trigger-monitoring', {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Monitoring cycle triggered successfully');
        // Refresh insights after a short delay
        setTimeout(() => {
          fetchAgenticInsights();
          fetchActivitySummary();
        }, 2000);
      } else {
        toast.error('Failed to trigger monitoring cycle');
      }
    } catch (error) {
      console.error('Error triggering monitoring cycle:', error);
      toast.error('Error triggering monitoring cycle');
    }
  };

  const resolveInsight = async (insightId: number) => {
    try {
      const response = await apiRequest(`/api/admin/analytics/insights/${insightId}/resolve`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Insight marked as resolved');
        fetchAgenticInsights(); // Refresh insights
      } else {
        toast.error('Failed to resolve insight');
      }
    } catch (error) {
      console.error('Error resolving insight:', error);
      toast.error('Error resolving insight');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'operational': return 'text-green-400 bg-green-900/50 border border-green-700/50';
      case 'degraded': return 'text-yellow-400 bg-yellow-900/50 border border-yellow-700/50';
      case 'maintenance': return 'text-blue-400 bg-blue-900/50 border border-blue-700/50';
      case 'outage': return 'text-red-400 bg-red-900/50 border border-red-700/50';
      default: return 'text-slate-400 bg-slate-700/50 border border-slate-600/50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-400 bg-red-900/50 border border-red-700/50';
      case 'high': return 'text-orange-400 bg-orange-900/50 border border-orange-700/50';
      case 'medium': return 'text-yellow-400 bg-yellow-900/50 border border-yellow-700/50';
      case 'low': return 'text-blue-400 bg-blue-900/50 border border-blue-700/50';
      default: return 'text-slate-400 bg-slate-700/50 border border-slate-600/50';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (!dashboardData || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800/95 backdrop-blur-xl shadow-sm border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Admin Dashboard</h1>
              <p className="text-slate-400">kiff SaaS Management</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              
              {/* System Status */}
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dashboardData?.system_health?.status || 'unknown')}`}>
                {(dashboardData?.system_health?.status || 'unknown').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-slate-100">
                  {formatNumber(dashboardData?.user_stats?.total_users || 0)}
                </p>
                <p className="text-xs text-slate-400">
                  +{dashboardData?.user_stats?.new_users_7d || 0} this week
                </p>
              </div>
            </div>
          </div>

          {/* Active Sandboxes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Sandboxes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.sandbox_stats.active_sandboxes}
                </p>
                <p className="text-xs text-gray-500">
                  of {dashboardData.sandbox_stats.total_sandboxes} total
                </p>
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue (30d)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(dashboardData.revenue_stats.revenue_30d)}
                </p>
                <p className="text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  Growing
                </p>
              </div>
            </div>
          </div>

          {/* Support Tickets */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open Tickets</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.support_stats.open_tickets}
                </p>
                <p className="text-xs text-gray-500">Support queue</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* System Health */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Health</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* CPU Usage */}
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Cpu className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-600">CPU Usage</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.system_health.cpu_usage?.toFixed(1) || 0}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${dashboardData.system_health.cpu_usage || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <MemoryStick className="h-8 w-8 text-green-500" />
                    </div>
                    <p className="text-sm text-gray-600">Memory Usage</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.system_health.memory_usage?.toFixed(1) || 0}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${dashboardData.system_health.memory_usage || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* API Error Rate */}
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Server className="h-8 w-8 text-red-500" />
                    </div>
                    <p className="text-sm text-gray-600">API Error Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData.system_health.api_error_rate?.toFixed(2) || 0}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(dashboardData.system_health.api_error_rate || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Usage Statistics */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Usage Statistics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600">Tokens Used</p>
                        <p className="text-xl font-bold text-gray-900">
                          {formatNumber(dashboardData.usage_stats.total_tokens_used)}
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-blue-500" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600">API Calls</p>
                        <p className="text-xl font-bold text-gray-900">
                          {formatNumber(dashboardData.usage_stats.total_api_calls)}
                        </p>
                      </div>
                      <Database className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Alerts & Quick Actions */}
          <div className="space-y-6">
            {/* Recent Alerts */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
              </div>
              <div className="p-6">
                {dashboardData.recent_alerts.length === 0 ? (
                  <div className="text-center py-4">
                    <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No active alerts</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.recent_alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                            <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6 space-y-3">
                <button className="w-full flex items-center justify-between px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Manage Users</span>
                  </div>
                  <span className="text-blue-600">→</span>
                </button>
                
                <button className="w-full flex items-center justify-between px-4 py-3 text-left bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Monitor Sandboxes</span>
                  </div>
                  <span className="text-green-600">→</span>
                </button>
                
                <button 
                  onClick={() => window.location.href = '/admin/monitoring'}
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Brain className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">AGNO Monitoring</span>
                  </div>
                  <span className="text-purple-600">→</span>
                </button>
                
                <button className="w-full flex items-center justify-between px-4 py-3 text-left bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900">Support Queue</span>
                  </div>
                  <span className="text-orange-600">→</span>
                </button>
                
                <button className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <Settings className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">System Settings</span>
                  </div>
                  <span className="text-gray-600">→</span>
                </button>
              </div>
            </div>

            {/* Feature Flags */}
            <FeatureFlagsPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
