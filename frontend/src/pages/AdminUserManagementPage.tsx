/**
 * Admin User Management Page for kiff
 * Comprehensive user control and monitoring interface
 */

import React, { useState } from 'react';
import { apiRequest } from '@/utils/apiConfig';
import { useAdminCache } from '@/hooks/useAdminCache';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Ban, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  Activity,
  Calendar,
  Mail,
  User,
  AlertTriangle,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  status: 'active' | 'suspended' | 'banned' | 'pending';
  subscription_plan: 'free' | 'starter' | 'pro' | 'enterprise';
  monthly_tokens_used: number;
  monthly_token_limit: number;
  sandbox_count: number;
  last_activity: string | null;
  last_login: string | null;
  created_at: string;
}

interface UserDetail extends AdminUser {
  billing_history: Array<{
    id: number;
    amount: number;
    currency: string;
    billing_period_start: string;
    billing_period_end: string;
    payment_status: string;
    created_at: string;
  }>;
  sandboxes: Array<{
    id: string;
    status: string;
    strategy_type: string;
    uptime: number;
    tokens_used: number;
    created_at: string;
  }>;
}

const AdminUserManagementPage: React.FC = () => {
  // Local state for filters and UI
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const usersPerPage = 10;
  
  // Smart caching hook - prevents unnecessary API calls!
  const { data: users, loading, refresh } = useAdminCache<AdminUser[]>(
    'admin-users',
    async () => {
      const params = new URLSearchParams({
        skip: ((currentPage - 1) * usersPerPage).toString(),
        limit: usersPerPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter && { status: statusFilter }),
        ...(planFilter && { plan: planFilter })
      });
      
      const response = await apiRequest(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const result = await response.json();
      setTotalUsers(result.total);
      setTotalPages(result.pages);
      return result.users as AdminUser[];
    },
    [currentPage, searchQuery, statusFilter, planFilter] // Dependencies
  );

  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'ban' | ''>('');
  const [actionReason, setActionReason] = useState('');

  const fetchUserDetail = async (userId: number) => {
    try {
      const response = await apiRequest(`/api/admin/users/${userId}`, {
        method: 'GET'
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedUser(data);
        setShowUserModal(true);
      } else {
        toast.error('Failed to fetch user details');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error('Error loading user details');
    }
  };

  const handleUserAction = async () => {
    if (!selectedUser || !actionType) return;

    try {
      const response = await apiRequest(`/api/admin/users/${selectedUser.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: actionType === 'activate' ? 'active' : actionType,
          reason: actionReason
        })
      });

      if (response.ok) {
        toast.success(`User ${actionType}d successfully`);
        setShowActionModal(false);
        setShowUserModal(false);
        setActionReason('');
        refresh(); // Refresh the cached list
      } else {
        const error = await response.json();
        toast.error(`Failed to ${actionType} user: ${error.detail}`);
      }
    } catch (error) {
      console.error(`Error ${actionType}ing user:`, error);
      toast.error(`Error ${actionType}ing user`);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      banned: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800'
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const getPlanBadge = (plan: string) => {
    const styles = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-gold-100 text-gold-800'
    };
    return styles[plan as keyof typeof styles] || styles.free;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const calculateTokenUsagePercentage = (used: number, limit: number) => {
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  };

  const exportUsers = () => {
    try {
      // Create CSV content
      const headers = ['Name', 'Email', 'Status', 'Plan', 'Tokens Used', 'Token Limit', 'Created At'];
      const csvContent = [
        headers.join(','),
        ...(users || []).map(user => [
          `"${user.full_name || 'N/A'}"`,
          `"${user.email}"`,
          `"${user.status}"`,
          `"${user.subscription_plan || 'free'}"`,
          user.monthly_tokens_used || 0,
          user.monthly_token_limit || 10000,
          `"${user.created_at ? formatDate(user.created_at) : 'N/A'}"`
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `kiff-users-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('User data exported successfully!');
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error('Failed to export user data');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600">Manage and monitor all platform users</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={refresh}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
              
              <button 
                onClick={exportUsers}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="pending">Pending</option>
              </select>

              {/* Plan Filter */}
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>

              {/* Clear Filters */}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                  setPlanFilter('');
                }}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Loading users...</span>
                      </div>
                    </td>
                  </tr>
                ) : !users || users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No users found</p>
                    </td>
                  </tr>
                ) : (
                  (users || []).map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPlanBadge(user.subscription_plan || 'free')}`}>
                          {user.subscription_plan || 'free'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(user.monthly_tokens_used || 0).toLocaleString()} / {(user.monthly_token_limit || 10000).toLocaleString()}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${calculateTokenUsagePercentage(user.monthly_tokens_used || 0, user.monthly_token_limit || 10000)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_activity ? formatDate(user.last_activity) : (user.last_login ? formatDate(user.last_login) : 'Never')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => fetchUserDetail(user.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                          <div className="relative">
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!users || users.length < usersPerPage}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((currentPage - 1) * usersPerPage) + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * usersPerPage, totalUsers)}</span> of{' '}
                  <span className="font-medium">{totalUsers}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!users || users.length < usersPerPage}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">User Details</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Info */}
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">User Information</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium">{selectedUser.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Email:</span>
                      <span className="text-sm font-medium">{selectedUser.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className={`text-sm px-2 py-1 rounded-full ${getStatusBadge(selectedUser.status)}`}>
                        {selectedUser.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Plan:</span>
                      <span className={`text-sm px-2 py-1 rounded-full ${getPlanBadge(selectedUser.subscription_plan)}`}>
                        {selectedUser.subscription_plan}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Created:</span>
                      <span className="text-sm font-medium">{formatDate(selectedUser.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <h4 className="text-md font-medium text-gray-900">Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.status === 'active' && (
                      <button
                        onClick={() => {
                          setActionType('suspend');
                          setShowActionModal(true);
                        }}
                        className="flex items-center space-x-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
                      >
                        <Ban className="h-4 w-4" />
                        <span>Suspend</span>
                      </button>
                    )}
                    
                    {selectedUser.status === 'suspended' && (
                      <button
                        onClick={() => {
                          setActionType('activate');
                          setShowActionModal(true);
                        }}
                        className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Activate</span>
                      </button>
                    )}
                    
                    {selectedUser.status !== 'banned' && (
                      <button
                        onClick={() => {
                          setActionType('ban');
                          setShowActionModal(true);
                        }}
                        className="flex items-center space-x-2 px-3 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Ban</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Usage & Billing */}
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Usage Statistics</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Token Usage:</span>
                        <span className="font-medium">
                          {selectedUser.monthly_tokens_used.toLocaleString()} / {selectedUser.monthly_token_limit.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${calculateTokenUsagePercentage(selectedUser.monthly_tokens_used, selectedUser.monthly_token_limit)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Active Sandboxes:</span>
                      <span className="text-sm font-medium">{selectedUser.sandbox_count}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Billing */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Recent Billing</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedUser.billing_history.slice(0, 3).map((bill) => (
                      <div key={bill.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <div className="text-sm font-medium">{formatCurrency(bill.amount, bill.currency)}</div>
                          <div className="text-xs text-gray-500">{formatDate(bill.created_at)}</div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          bill.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {bill.payment_status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {showActionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-yellow-400" />
              <h3 className="text-lg font-medium text-gray-900 mt-4">
                Confirm {actionType?.charAt(0).toUpperCase() + actionType?.slice(1)} User
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to {actionType} this user? This action will be logged.
                </p>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Reason for this action (required)"
                  className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required
                />
              </div>
              <div className="flex items-center justify-center space-x-4 mt-4">
                <button
                  onClick={() => {
                    setShowActionModal(false);
                    setActionReason('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUserAction}
                  disabled={!actionReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  Confirm {actionType?.charAt(0).toUpperCase() + actionType?.slice(1)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagementPage;
