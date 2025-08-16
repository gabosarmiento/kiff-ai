'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useLayoutState } from '@/components/layout/LayoutState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/ui/PageContainer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Removed tabs
import {
  Plus,
  Search,
  Package,
  Shield,
  Eye,
  Loader2,
  TrendingUp,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';
import { usePacks } from '@/contexts/PackContext';
import toast from 'react-hot-toast';

interface KiffPack {
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
  created_at: string;
  api_url: string;
  logo_url?: string | null;
  user_rating?: number;
  processing_status: string;
}

interface PacksResponse {
  packs: KiffPack[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

interface PackStats {
  total_packs: number;
  categories: Record<string, number>;
  total_usage: number; // fallback: sum of pack.usage_count
  // If backend provides number of kiffs created, prefer that for "Total Usage"
  kiffs_created?: number;
  avg_rating: number;
  verified_packs: number;
  top_pack?: {
    name: string;
    usage_count: number;
  };
}

export default function KiffPacksPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const { user, isAuthenticated, isLoading, token } = useAuth();
  const { selectedPacks, addPack, removePack } = usePacks();
  const router = useRouter();
  const [packs, setPacks] = useState<KiffPack[]>([]);
  const [stats, setStats] = useState<PackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  // Removed tabs state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const hasProcessing = packs.some((p) => p.processing_status === 'processing');
  // Track when we first noticed any pack in processing to avoid stale banners
  const [processingSince, setProcessingSince] = useState<number | null>(null);
  const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  // Allow user to hide a clearly stale banner locally
  const [suppressProcessingBanner, setSuppressProcessingBanner] = useState(false);

  const fetchTenantPacks = useCallback(async () => {
    try {
      if (!isAuthenticated) return;
      setLoading(true);
      const params = new URLSearchParams({
        search: searchQuery,
        category: categoryFilter,
        limit: '50'
      });
      // Use trailing slash to avoid backend 307 redirect when route is defined as /api/packs/
      // Add timestamp param and disable cache to avoid stale processing_status
      params.set('_ts', String(Date.now()));
      const data = await apiJson<PacksResponse>(`/api/packs/?${params.toString()}` , { cache: 'no-store' as any });
      setPacks(data.packs);
    } catch (error) {
      console.error('Error fetching packs:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, searchQuery, categoryFilter]);

  // Fetch stats only on client to avoid Next.js export errors.
  // Stabilize this callback so it doesn't depend on `packs` to prevent effect loops.
  const fetchPackStats = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      if (!isAuthenticated) return;
      const data = await apiJson<PackStats>('/api/packs/stats');
      setStats(data);
    } catch (error) {
      console.warn('Pack stats API unavailable, will compute fallback from packs');
      // Defer to the packs-based fallback effect below
      setStats((prev) => prev ?? null);
    }
  }, [isAuthenticated]);

  // Fetch when ready
  useEffect(() => {
    // Only fetch when authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchTenantPacks();
    fetchPackStats();
  }, [isAuthenticated, fetchTenantPacks, fetchPackStats]);

  // Compute stats fallback from current packs when API is unavailable
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!packs || packs.length === 0) return;
    // If stats is null or missing fields, compute a local fallback
    if (!stats || typeof (stats as any).total_packs !== 'number') {
      const total_packs = packs.length;
      const total_usage = packs.reduce((acc, p) => acc + (p.usage_count || 0), 0);
      const avg_rating_vals = packs.map((p) => p.avg_rating).filter((n) => typeof n === 'number' && !Number.isNaN(n));
      const avg_rating = avg_rating_vals.length ? (avg_rating_vals.reduce((a, b) => a + b, 0) / avg_rating_vals.length) : 0;
      const verified_packs = packs.filter((p) => p.is_verified).length;
      const top = packs.slice().sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))[0];
      setStats({
        total_packs,
        categories: {},
        total_usage,
        avg_rating,
        verified_packs,
        top_pack: top ? { name: top.display_name || top.name, usage_count: top.usage_count || 0 } : undefined,
        name: '',
        usage_count: 0,
      } as unknown as PackStats);
    }
  }, [isAuthenticated, packs, stats]);

  // Conditional polling: while any pack is processing, refetch packs periodically
  useEffect(() => {
    // Disabled polling per request to avoid periodic refreshes
    return;
  }, [isAuthenticated, hasProcessing, processingSince, fetchTenantPacks]);

  // Derived flag to control the banner visibility
  const elapsed = processingSince == null ? 0 : (Date.now() - processingSince);
  const isWithinTimeout = elapsed < PROCESSING_TIMEOUT_MS;
  const showProcessingBanner = !suppressProcessingBanner && hasProcessing && (processingSince == null || isWithinTimeout);
  const showStuckBanner = !suppressProcessingBanner && hasProcessing && processingSince != null && !isWithinTimeout;

  // Stop indexing utility: delete all packs currently in processing
  const stopIndexingAndRemove = async () => {
    if (!isAuthenticated) return;
    const processingPacks = packs.filter(p => p.processing_status === 'processing');
    if (processingPacks.length === 0) {
      toast('No indexing in progress');
      return;
    }
    const confirmMsg = `This will stop indexing and remove ${processingPacks.length} pack(s). Continue?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await Promise.all(
        processingPacks.map(p => apiJson(`/api/packs/${p.id}`, { method: 'DELETE' }))
      );
      toast.success('Stopped indexing and removed pack(s)');
      // Refresh list
      fetchTenantPacks();
    } catch (e) {
      console.error('Stop indexing failed', e);
      toast.error('Failed to stop indexing for some packs');
    }
  };

  // Removed archiveSelected feature by request

  const getStatusBadge = (pack: KiffPack) => {
    if (pack.processing_status === 'processing') {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Indexing
        </Badge>
      );
    }
    if (pack.processing_status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (pack.is_verified) {
      return <Badge variant="default" className="flex items-center gap-1">
        <Shield className="w-3 h-3" /> Verified
      </Badge>;
    }
    return <Badge variant="outline">Ready</Badge>;
  };

  type PackCardProps = { pack: KiffPack; isSelected: boolean; onToggle: (id: string) => void };
  const PackCard = memo(({ pack, isSelected, onToggle }: PackCardProps) => {
    const [logoError, setLogoError] = useState(false);
    return (
    <Card className="hover:shadow-lg transition-shadow duration-200 fx-card">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded bg-white ring-1 ring-slate-200 flex items-center justify-center overflow-hidden">
                {pack.logo_url && !logoError ? (
                  <Image
                    src={pack.logo_url}
                    alt={`${pack.display_name} logo`}
                    width={32}
                    height={32}
                    sizes="32px"
                    className="h-8 w-8 object-contain"
                    loading="lazy"
                    unoptimized
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span title="No logo" style={{ fontSize: 16, lineHeight: 1 }}>📦</span>
                )}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  {pack.display_name}
                  {pack.processing_status === 'processing' ? (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-gray-500"
                      title="Indexing in progress. This can take a couple of minutes."
                      aria-label="Indexing in progress"
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Indexing
                    </span>
                  ) : null}
                </CardTitle>
                {/* Byline removed per request */}
              </div>
            </div>
          </div>
          {getStatusBadge(pack)}
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-gray-700 mb-4 line-clamp-2">
          {pack.description}
        </p>
        
        {/* Usage and rating row removed per request */}

        <div className="flex gap-2">
          <Link href={`/kiffs/packs/scramble?pack=${pack.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full flex items-center gap-1 fx-button" disabled={pack.processing_status === 'processing'}>
              <Eye className="w-3 h-3" />
              Preview
            </Button>
          </Link>
          <Button
  size="sm"
  className={`rounded-lg px-4 py-2 text-base font-medium flex items-center gap-1 fx-button ${isSelected
    ? 'bg-black text-white hover:bg-zinc-800 shadow-lg border-0'
    : 'text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'}`}
  disabled={pack.processing_status === 'processing'}
  onClick={() => onToggle(pack.id)}
>
  {isSelected ? (
    <>
      <span className="font-bold text-lg">-</span> Unpack
    </>
  ) : (
    <>
      <Plus className="w-3 h-3" /> Use
    </>
  )}
</Button>
        </div>

        {/* Rating stars removed per request */}
      </CardContent>
    </Card>
  );
  });
  // eslint react/display-name
  PackCard.displayName = 'PackCard';

  const StatsOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{(stats?.kiffs_created ?? stats?.total_usage) || 0}</p>
              <p className="text-sm text-gray-600">{stats?.kiffs_created != null ? 'Total Kiffs' : 'Total Usage'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  // eslint react-display-name
  StatsOverview.displayName = 'StatsOverview';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <Card>
            <CardHeader>
              <CardTitle>Sign in to view Packs</CardTitle>
              <CardDescription>Authentication is required to access your tenant&apos;s packs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button className="w-full fx-button">Go to Login</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar fx-section" style={{ padding: 16, paddingLeft: leftWidth + 24, margin: "0 auto", maxWidth: 1200 }}>
        <PageContainer padded className="pt-2 sm:pt-3 md:pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-lg font-semibold">Your Packs</h2>
              <p className="mt-1 text-sm text-slate-600">API knowledge indexed</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/kiffs/packs/create">
                <Button
                  className="rounded-lg px-4 py-2 text-base font-medium text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 fx-button"
                >
                  <Plus className="w-4 h-4" />
                  Create Pack
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-6">
            {/* StatsUsage placed where the tabs used to be */}
            <StatsOverview />

            {/* Filters */}
            <Card className="mb-6 fx-card">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search packs by name, category, or API..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="AI/ML">AI/ML</SelectItem>
                      <SelectItem value="Audio/Video">Audio/Video</SelectItem>
                      <SelectItem value="Payment">Payment</SelectItem>
                      <SelectItem value="Communication">Communication</SelectItem>
                      <SelectItem value="Database">Database</SelectItem>
                      <SelectItem value="Authentication">Authentication</SelectItem>
                      <SelectItem value="Analytics">Analytics</SelectItem>
                      <SelectItem value="Social">Social</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View mode toggle replaces the sort control */}
                  <div className="inline-flex rounded-md border bg-white overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-2 text-sm flex items-center gap-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setViewMode('grid')}
                      aria-pressed={viewMode === 'grid'}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span className="hidden sm:inline">Grid</span>
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 text-sm flex items-center gap-2 border-l ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setViewMode('list')}
                      aria-pressed={viewMode === 'list'}
                      aria-label="List view"
                    >
                      <ListIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">List</span>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pack Gallery */}
            {showProcessingBanner ? (
              <Card className="mb-4 border-dashed fx-card">
                <CardContent className="p-4 text-sm text-gray-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Indexing in progress for one or more packs.
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="destructive" size="sm" onClick={stopIndexingAndRemove}>Stop indexing</Button>
                    <Button variant="outline" size="sm" onClick={() => { setSuppressProcessingBanner(false); fetchTenantPacks(); }}>Refresh</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSuppressProcessingBanner(true)}>Dismiss</Button>
                  </div>
                </CardContent>
              </Card>
            ) : showStuckBanner ? (
              <Card className="mb-4 border-amber-300 bg-amber-50 fx-card">
                <CardContent className="p-4 text-sm text-amber-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Indexing status seems stuck. We’ll stop auto-refreshing. You can refresh manually or dismiss this notice.
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="destructive" size="sm" onClick={stopIndexingAndRemove}>Stop indexing</Button>
                    <Button variant="outline" size="sm" onClick={() => { setSuppressProcessingBanner(false); fetchTenantPacks(); }}>Refresh</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSuppressProcessingBanner(true)}>Dismiss</Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {loading ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border rounded-xl p-4 fx-card">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded ring-1 ring-slate-200 fx-idle" />
                      <div className="flex-1">
                        <div className="h-4 w-40 fx-idle rounded mb-2" />
                        <div className="h-3 w-24 fx-idle rounded" />
                      </div>
                    </div>
                    <div className="h-16 w-full fx-idle rounded mt-4" />
                    <div className="flex gap-2 mt-4">
                      <div className="h-9 flex-1 fx-idle rounded" />
                      <div className="h-9 flex-1 fx-idle rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : packs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No packs found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery || categoryFilter !== 'all' 
                      ? 'Try adjusting your search or filters'
                      : 'Be the first to create a pack for your team!'
                    }
                  </p>
                  <Link href="/kiffs/packs/create">
                    <Button>Create First Pack</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
                {packs.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    isSelected={selectedPacks.includes(pack.id)}
                    onToggle={(id) => {
                      if (selectedPacks.includes(id)) {
                        removePack(id);
                        toast.custom((t) => (
                          <div className="bg-gray-900 text-white shadow-lg px-4 py-3 rounded-xl text-sm flex items-center gap-4 border border-gray-800">
                            <span className="select-none">🗑️</span>
                            <span>Pack removed from your session packs</span>
                            <button
                              className="ml-2 text-gray-300 hover:text-gray-100"
                              onClick={() => { addPack(id); toast.dismiss(t.id); toast.success('Restored'); }}
                              aria-label="Undo removal"
                            >
                              Undo
                            </button>
                          </div>
                        ), { duration: 5000 });
                      } else {
                        addPack(id);
                        const p = packs.find(x => x.id === id);
                        if (p) toast.success(`Pack \"${p.display_name}\" added to your available packs - find them ready in your model!`, { duration: 5000 });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </PageContainer>
      </main>
      <BottomNav />
    </div>
  );
}