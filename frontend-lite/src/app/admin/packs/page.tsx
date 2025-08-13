'use client';

import { useState, useEffect, useCallback } from 'react';
import { withTenantHeaders, getTenantId } from '@/lib/tenant';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Check, 
  X, 
  Edit, 
  Trash2, 
  Shield, 
  Search,
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  Star,
  Eye,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AdminKiffPack {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  created_by: string;
  created_by_name: string;
  usage_count: number;
  avg_rating: number;
  total_users_used: number;
  is_verified: boolean;
  is_active: boolean;
  processing_status: string;
  processing_error?: string;
  created_at: string;
  updated_at: string;
  api_url: string;
}

interface AdminStats {
  total_packs: number;
  verified_packs: number;
  pending_verification: number;
  failed_processing: number;
  total_usage: number;
  avg_rating: number;
}

export default function AdminPacksPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [packs, setPacks] = useState<AdminKiffPack[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Stable memoized loaders to satisfy exhaustive-deps
  const loadAllPacks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/packs/admin/all?${params}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'X-Tenant-ID': user?.tenant_id
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPacks(data.packs);
      } else {
        console.error('Failed to fetch admin packs');
      }
    } catch (error) {
      console.error('Error fetching admin packs:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, user?.token, user?.tenant_id]);

  const loadAdminStats = useCallback(async () => {
    try {
      const response = await fetch('/api/packs/admin/stats', {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'X-Tenant-ID': user?.tenant_id
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  }, [user?.token, user?.tenant_id]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (!user?.is_admin) {
      router.push('/kiffs/packs');
      return;
    }
    
    loadAllPacks();
    loadAdminStats();
  }, [isAuthenticated, user, statusFilter, loadAllPacks, loadAdminStats, router]);


  const handleVerifyPack = async (packId: string) => {
    setProcessingAction(packId);
    try {
      const response = await fetch(`/api/packs/${packId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'X-Tenant-ID': user?.tenant_id
        }
      });

      if (response.ok) {
        loadAllPacks();
        loadAdminStats();
      } else {
        alert('Failed to verify pack');
      }
    } catch (error) {
      console.error('Error verifying pack:', error);
      alert('Failed to verify pack');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDeletePack = async (packId: string, packName: string) => {
    if (!confirm(`Are you sure you want to delete the pack "${packName}"? This action cannot be undone.`)) {
      return;
    }

    setProcessingAction(packId);
    try {
      const tenantId = getTenantId();
      console.log('[Kiff Admin] Deleting pack', { packId, tenantId });
      const headers = withTenantHeaders({
        'Authorization': `Bearer ${user?.token}`,
        'X-Tenant-ID': tenantId
      });
      const response = await fetch(`/api/packs/${packId}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        loadAllPacks();
        loadAdminStats();
      } else {
        const errorText = await response.text();
        alert(`Failed to delete pack (tenant: ${tenantId}, pack: ${packId}):\n${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting pack:', error);
      alert('Failed to delete pack');
    } finally {
      setProcessingAction(null);
    }
  };

  const getStatusBadge = (pack: AdminKiffPack) => {
    if (pack.processing_status === 'processing') {
      return <Badge variant="secondary">Processing</Badge>;
    }
    if (pack.processing_status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (!pack.is_active) {
      return <Badge variant="outline">Inactive</Badge>;
    }
    if (pack.is_verified) {
      return <Badge variant="default" className="flex items-center gap-1">
        <Shield className="w-3 h-3" /> Verified
      </Badge>;
    }
    return <Badge variant="secondary">Pending Verification</Badge>;
  };

  const filteredPacks = packs.filter(pack => {
    const matchesSearch = pack.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pack.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pack.created_by_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const AdminStatsOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.total_packs || 0}</p>
              <p className="text-sm text-gray-600">Total Packs</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.verified_packs || 0}</p>
              <p className="text-sm text-gray-600">Verified</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.pending_verification || 0}</p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.failed_processing || 0}</p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.total_usage || 0}</p>
              <p className="text-sm text-gray-600">Total Usage</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.avg_rating?.toFixed(1) || '0.0'}</p>
              <p className="text-sm text-gray-600">Avg Rating</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!isAuthenticated || !user?.is_admin) {
    return <div>Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pack Administration</h1>
              <p className="text-gray-600 mt-1">
                Manage and moderate Kiff Packs for your tenant
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/kiffs/packs">
                <Button variant="outline">View Public Gallery</Button>
              </Link>
              <Link href="/kiffs/packs/create">
                <Button>Create Pack</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="management">Pack Management</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminStatsOverview />
            
            {/* Recent Activity or other overview content can go here */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common administrative tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setStatusFilter('pending_verification')}
                  >
                    <AlertTriangle className="w-6 h-6" />
                    Review Pending Packs
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setStatusFilter('failed')}
                  >
                    <X className="w-6 h-6" />
                    Check Failed Packs
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => router.push('/kiffs/packs/create')}
                  >
                    <Package className="w-6 h-6" />
                    Create New Pack
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="management">
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search packs by name, description, or creator..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Packs</SelectItem>
                      <SelectItem value="pending_verification">Pending Verification</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="failed">Failed Processing</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Packs Table */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>All Packs ({filteredPacks.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Pack
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Creator
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usage
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rating
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredPacks.map((pack) => (
                          <tr key={pack.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium text-gray-900">{pack.display_name}</div>
                                <div className="text-sm text-gray-500">{pack.category}</div>
                                {pack.processing_error && (
                                  <div className="text-xs text-red-600 mt-1 max-w-xs truncate">
                                    Error: {pack.processing_error}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {pack.created_by_name}
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(pack)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm">
                                <div>{pack.usage_count} uses</div>
                                <div className="text-gray-500">{pack.total_users_used} users</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span className="text-sm">{pack.avg_rating.toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(pack.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <Link href={`/kiffs/packs/${pack.id}`}>
                                  <Button size="sm" variant="outline">
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                </Link>
                                
                                <a href={pack.api_url} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </a>

                                {!pack.is_verified && pack.processing_status === 'ready' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleVerifyPack(pack.id)}
                                    disabled={processingAction === pack.id}
                                    className="flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    Verify
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeletePack(pack.id, pack.display_name)}
                                  disabled={processingAction === pack.id}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {filteredPacks.length === 0 && (
                      <div className="text-center py-12">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No packs found</h3>
                        <p className="text-gray-600">
                          {searchQuery 
                            ? 'Try adjusting your search query'
                            : 'No packs match the selected filters'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}