'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Package, 
  Search, 
  Star, 
  Users, 
  TrendingUp, 
  Sparkles,
  Shield,
  Eye,
  ExternalLink,
  Plus,
  X
} from 'lucide-react';
import Link from 'next/link';

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
  api_url: string;
  logo_url?: string | null;
  similarity_score?: number;
}

interface PackSelectorProps {
  selectedPacks: string[];
  onPacksChange: (packs: string[]) => void;
  context?: string; // User's idea for relevant pack suggestions
  className?: string;
  maxSelections?: number;
}

export default function PackSelector({ 
  selectedPacks, 
  onPacksChange, 
  context, 
  className = '',
  maxSelections = 5
}: PackSelectorProps) {
  const { user } = useAuth();
  const [availablePacks, setAvailablePacks] = useState<KiffPack[]>([]);
  const [suggestedPacks, setSuggestedPacks] = useState<KiffPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('suggested');

  const fetchAvailablePacks = useCallback(async () => {
    try {
      const response = await fetch('/api/packs?limit=100&sort=most_used', {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'X-Tenant-ID': user?.tenant_id
        },
        next: { revalidate: 180 } // Cache for 3 minutes
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailablePacks(data.packs);
      }
    } catch (error) {
      console.error('Error fetching available packs:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.token, user?.tenant_id]);

  const fetchSuggestedPacks = useCallback(async (ideaContext: string) => {
    try {
      const params = new URLSearchParams({
        context: ideaContext,
        limit: '5'
      });
      
      const response = await fetch(`/api/packs/suggest?${params}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'X-Tenant-ID': user?.tenant_id
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestedPacks(data.suggested_packs || []);
        if (data.suggested_packs && data.suggested_packs.length > 0) {
          setActiveTab('suggested');
        } else {
          setActiveTab('all');
        }
      }
    } catch (error) {
      console.error('Error fetching suggested packs:', error);
    }
  }, [user?.token, user?.tenant_id]);

  useEffect(() => {
    fetchAvailablePacks();
    if (context) {
      fetchSuggestedPacks(context);
    }
  }, [context, fetchAvailablePacks, fetchSuggestedPacks]);

  const togglePack = (packId: string) => {
    if (selectedPacks.includes(packId)) {
      onPacksChange(selectedPacks.filter(id => id !== packId));
    } else if (selectedPacks.length < maxSelections) {
      onPacksChange([...selectedPacks, packId]);
    }
  };

  const filteredPacks = useMemo(() => 
    availablePacks.filter(pack =>
      pack.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pack.category.toLowerCase().includes(searchQuery.toLowerCase())
    ), [availablePacks, searchQuery]);

  const PackCard = ({ pack, isSelected, onToggle, isSuggested = false }: { 
    pack: KiffPack; 
    isSelected: boolean; 
    onToggle: () => void;
    isSuggested?: boolean;
  }) => (
    <Card className={`cursor-pointer transition-all duration-200 ${
      isSelected 
        ? 'border-blue-500 bg-blue-50 shadow-md' 
        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
    } ${!isSelected && selectedPacks.length >= maxSelections ? 'opacity-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-6 w-6 rounded bg-white ring-1 ring-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {pack.logo_url ? (
                  <img
                    src={pack.logo_url}
                    alt={`${pack.display_name} logo`}
                    className="h-6 w-6 object-contain"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement as HTMLElement | null;
                      if (parent) parent.textContent = '📦';
                    }}
                  />
                ) : (
                  <span title="No logo" style={{ fontSize: 12, lineHeight: 1 }}>📦</span>
                )}
              </div>
              <h4 className="font-medium text-sm">{pack.display_name}</h4>
              {pack.is_verified && (
                <Shield className="w-3 h-3 text-green-600" />
              )}
              {isSuggested && (
                <Sparkles className="w-3 h-3 text-yellow-500" />
              )}
            </div>
            <Badge variant="outline" className="text-xs mb-2">
              {pack.category}
            </Badge>
            <p className="text-xs text-gray-600 line-clamp-2 mb-3">
              {pack.description}
            </p>
          </div>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            disabled={!isSelected && selectedPacks.length >= maxSelections}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {pack.total_users_used}
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {pack.usage_count}
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {pack.avg_rating.toFixed(1)}
            </div>
          </div>
          
          <div className="flex gap-1">
            <Link href={`/kiffs/packs/${pack.id}`} target="_blank">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <Eye className="w-3 h-3" />
              </Button>
            </Link>
            <a href={pack.api_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          </div>
        </div>

        {isSuggested && pack.similarity_score && (
          <div className="mt-2 text-xs text-blue-600">
            {Math.round(pack.similarity_score * 100)}% match
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-600">
          <Package className="w-5 h-5" />
          <span className="font-medium">Loading Kiff Packs...</span>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium">Kiff Packs</h3>
          <Badge variant="outline">
            {selectedPacks.length}/{maxSelections} selected
          </Badge>
        </div>
        <Link href="/kiffs/packs/create">
          <Button size="sm" variant="outline" className="flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Create Pack
          </Button>
        </Link>
      </div>

      {/* Selected Packs Summary */}
      {selectedPacks.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">Selected Packs</span>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onPacksChange([])}
                className="h-6 text-xs text-blue-600 hover:text-blue-800"
              >
                Clear All
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedPacks.map(packId => {
                const pack = [...availablePacks, ...suggestedPacks].find(p => p.id === packId);
                return pack ? (
                  <Badge 
                    key={packId} 
                    variant="default" 
                    className="flex items-center gap-1"
                  >
                    <div className="h-4 w-4 rounded bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {pack.logo_url ? (
                        <img
                          src={pack.logo_url}
                          alt={`${pack.display_name} logo`}
                          className="h-4 w-4 object-contain"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = 'none';
                            const parent = img.parentElement as HTMLElement | null;
                            if (parent) parent.textContent = '📦';
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 8, lineHeight: 1 }}>📦</span>
                      )}
                    </div>
                    {pack.display_name}
                    <button
                      onClick={() => togglePack(packId)}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pack Selection Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="suggested" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Suggested ({suggestedPacks.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Packs ({availablePacks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggested" className="space-y-4">
          {suggestedPacks.length > 0 ? (
            <>
              <div className="text-sm text-gray-600">
                🎯 Based on your idea: &ldquo;{context?.substring(0, 100)}...&rdquo;
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestedPacks.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    isSelected={selectedPacks.includes(pack.id)}
                    onToggle={() => togglePack(pack.id)}
                    isSuggested={true}
                  />
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">
                  {context 
                    ? 'No specific pack suggestions found for your idea'
                    : 'Provide an idea to see suggested packs'
                  }
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Browse all available packs instead
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search packs by name, description, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Pack Grid */}
          {filteredPacks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {filteredPacks.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  isSelected={selectedPacks.includes(pack.id)}
                  onToggle={() => togglePack(pack.id)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">
                  {searchQuery 
                    ? `No packs found matching "${searchQuery}"`
                    : 'No packs available'
                  }
                </p>
                <Link href="/kiffs/packs/create" className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    Create the first pack
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Help Text */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        💡 <strong>Tip:</strong> Kiff Packs contain API documentation, code examples, and integration patterns 
        that will enhance your generated kiff with real API integrations. Select up to {maxSelections} packs 
        that match your project needs.
      </div>
    </div>
  );
}