import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Eye, 
  Play, 
  RefreshCw, 
  TrendingUp, 
  User, 
  Users,
  Zap
} from 'lucide-react';

interface Alert {
  id: string;
  user_id: string;
  user_email: string;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggested_action: string;
  timestamp: string;
  resolved: boolean;
}

interface MonitoringCycle {
  cycle_id: string;
  status: 'completed' | 'failed';
  agent_response: string;
  analysis_window_hours: number;
  timestamp: string;
}

interface UserAnalysis {
  user_id: string;
  analysis: string;
  patterns: string[];
  recommendations: string[];
  risk_level: 'low' | 'medium' | 'high';
}

const MonitoringDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentCycles, setRecentCycles] = useState<MonitoringCycle[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userAnalysis, setUserAnalysis] = useState<UserAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Load alerts on component mount
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring/agno/alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Parse alerts from AGNO response
        const alertsData = typeof data.data.alerts === 'string' 
          ? JSON.parse(data.data.alerts) 
          : data.data.alerts;
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const runMonitoringCycle = async () => {
    try {
      setCycleLoading(true);
      const response = await fetch('/api/monitoring/agno/run-cycle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newCycle: MonitoringCycle = {
          cycle_id: data.data.cycle_id,
          status: data.data.status,
          agent_response: data.data.agent_response,
          analysis_window_hours: data.data.analysis_window_hours,
          timestamp: new Date().toISOString()
        };
        
        setRecentCycles(prev => [newCycle, ...prev.slice(0, 4)]);
        
        // Reload alerts after cycle
        await loadAlerts();
      }
    } catch (error) {
      console.error('Failed to run monitoring cycle:', error);
    } finally {
      setCycleLoading(false);
    }
  };

  const analyzeUser = async () => {
    if (!selectedUser) return;
    
    try {
      setAnalysisLoading(true);
      const response = await fetch(`/api/monitoring/agno/analyze-user/${selectedUser}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Parse analysis from AGNO response
        const analysisText = data.data.analysis;
        setUserAnalysis({
          user_id: selectedUser,
          analysis: analysisText,
          patterns: [], // Could be extracted from analysis
          recommendations: [], // Could be extracted from analysis
          risk_level: 'medium' // Could be determined from analysis
        });
      }
    } catch (error) {
      console.error('Failed to analyze user:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const resolveAlert = async (alert: Alert) => {
    try {
      const response = await fetch('/api/monitoring/agno/resolve-alert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: alert.user_id,
          timestamp: alert.timestamp
        })
      });
      
      if (response.ok) {
        // Mark alert as resolved locally
        setAlerts(prev => 
          prev.map(a => 
            a.id === alert.id ? { ...a, resolved: true } : a
          )
        );
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'low': return <Eye className="w-5 h-5 text-blue-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-400" />
              AGNO Monitoring Dashboard
            </h1>
            <p className="text-gray-400 mt-2">
              Intelligent platform monitoring and user analytics powered by AGNO
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={loadAlerts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Alerts
            </button>
            
            <button
              onClick={runMonitoringCycle}
              disabled={cycleLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Play className={`w-4 h-4 ${cycleLoading ? 'animate-spin' : ''}`} />
              {cycleLoading ? 'Running...' : 'Run Cycle'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts Feed */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Active Alerts ({alerts.filter(a => !a.resolved).length})
              </h2>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-400">Loading alerts...</span>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p>No active alerts - system is healthy!</p>
                  </div>
                ) : (
                  alerts.map((alert, index) => (
                    <div
                      key={alert.id || index}
                      className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${
                        alert.resolved ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(alert.severity)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{alert.title}</h3>
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                                {alert.severity}
                              </span>
                            </div>
                            <p className="text-sm mb-2">{alert.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {alert.user_email || alert.user_id}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {alert.suggested_action && (
                              <div className="mt-2 p-2 bg-gray-700 rounded text-xs">
                                <strong>Suggested Action:</strong> {alert.suggested_action}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {!alert.resolved && (
                          <button
                            onClick={() => resolveAlert(alert)}
                            className="ml-4 px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Monitoring Cycles */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Recent Cycles
              </h3>
              
              <div className="space-y-3">
                {recentCycles.length === 0 ? (
                  <p className="text-gray-400 text-sm">No recent cycles</p>
                ) : (
                  recentCycles.map((cycle, index) => (
                    <div key={cycle.cycle_id} className="p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">
                          {cycle.cycle_id}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          cycle.status === 'completed' 
                            ? 'bg-green-600 text-green-100' 
                            : 'bg-red-600 text-red-100'
                        }`}>
                          {cycle.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(cycle.timestamp).toLocaleString()}
                      </p>
                      {cycle.agent_response && (
                        <p className="text-xs text-gray-300 mt-2 line-clamp-2">
                          {cycle.agent_response.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* User Analysis */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                User Analysis
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    User ID to Analyze
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      placeholder="Enter user ID..."
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={analyzeUser}
                      disabled={!selectedUser || analysisLoading}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      {analysisLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        'Analyze'
                      )}
                    </button>
                  </div>
                </div>

                {userAnalysis && (
                  <div className="p-4 bg-gray-700 rounded-lg">
                    <h4 className="font-medium text-white mb-2">
                      Analysis for {userAnalysis.user_id}
                    </h4>
                    <p className="text-sm text-gray-300 mb-3">
                      {userAnalysis.analysis}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Risk Level:</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        userAnalysis.risk_level === 'high' 
                          ? 'bg-red-600 text-red-100'
                          : userAnalysis.risk_level === 'medium'
                          ? 'bg-yellow-600 text-yellow-100'
                          : 'bg-green-600 text-green-100'
                      }`}>
                        {userAnalysis.risk_level}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;
