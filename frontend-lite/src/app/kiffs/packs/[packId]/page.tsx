'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft,
  Star,
  Users,
  TrendingUp,
  ExternalLink,
  Code,
  Settings,
  Download,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader,
  Eye,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiJson } from '@/lib/api';

interface KiffPackDetails {
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
  documentation_urls: string[];
  api_structure: any;
  code_examples: Record<string, string>;
  integration_patterns: string[];
  recent_ratings: Array<{
    rating: number;
    comment?: string;
    user_id: string;
    created_at: string;
  }>;
}

export default function PackDetailsPage() {
  const { user, isAuthenticated } = useAuth();
  const { packId } = useParams();
  const router = useRouter();
  const [pack, setPack] = useState<KiffPackDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchPackDetails = useCallback(async () => {
    try {
      const data = await apiJson<KiffPackDetails>(`/api/packs/${packId}`, {
        method: 'GET',
        headers: {
          'X-Tenant-ID': user?.tenant_id || '4485db48-71b7-47b0-8128-c6dca5be352d'
        }
      });
      setPack(data);
    } catch (error) {
      // If full details not available (often 404 during processing), try lightweight status
      try {
        const status = await apiJson<{ id: string; display_name?: string; processing_status: string; processing_error?: string }>(`/api/packs/${packId}/status`, { method: 'GET' });
        // Create a minimal stub so UI can show processing state
        const stub: KiffPackDetails = {
          id: status.id,
          name: status.display_name || status.id,
          display_name: status.display_name || status.id,
          description: '',
          category: 'General',
          created_by: '',
          created_by_name: '',
          usage_count: 0,
          avg_rating: 0,
          total_users_used: 0,
          is_verified: false,
          is_active: true,
          processing_status: status.processing_status,
          processing_error: status.processing_error,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          api_url: '',
          documentation_urls: [],
          api_structure: null,
          code_examples: {},
          integration_patterns: [],
          recent_ratings: [],
        };
        setPack(stub);
        setError(null);
      } catch (e2) {
        console.error('Error fetching pack status:', e2);
        setError('Failed to load pack details');
      }
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchPackDetails();
  }, [packId, isAuthenticated, router, fetchPackDetails]);

  // Poll lightweight status while processing or when full details are unavailable
  useEffect(() => {
    // If we already have a terminal state, do nothing
    if (pack && (pack.processing_status === 'ready' || pack.processing_status === 'failed')) return;
    let timer: any;
    const poll = async () => {
      try {
        const status = await apiJson<{ id: string; display_name?: string; processing_status: string; processing_error?: string }>(`/api/packs/${packId}/status`, {
          method: 'GET',
          headers: {
            'X-Tenant-ID': user?.tenant_id || '4485db48-71b7-47b0-8128-c6dca5be352d'
          }
        });
        if (status.processing_status === 'ready' || status.processing_status === 'failed') {
          await fetchPackDetails();
        } else if (!pack) {
          // If we had no pack yet, set a stub so UI shows processing
          setPack(prev => prev ?? {
            id: status.id,
            name: status.display_name || status.id,
            display_name: status.display_name || status.id,
            description: '',
            category: 'General',
            created_by: '',
            created_by_name: '',
            usage_count: 0,
            avg_rating: 0,
            total_users_used: 0,
            is_verified: false,
            is_active: true,
            processing_status: status.processing_status,
            processing_error: status.processing_error,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            api_url: '',
            documentation_urls: [],
            api_structure: null,
            code_examples: {},
            integration_patterns: [],
            recent_ratings: [],
          });
        }
      } catch (e) {
        // swallow, will retry
      }
    };
    poll();
    timer = setInterval(poll, 6000);
    return () => clearInterval(timer);
  }, [pack, packId, fetchPackDetails]);

  const handleRatingSubmit = async () => {
    if (!userRating || submittingRating) return;

    setSubmittingRating(true);
    try {
      const response = await fetch(`/api/packs/${packId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': user?.tenant_id
        },
        credentials: 'include',
        body: JSON.stringify({
          rating: userRating,
          comment: userComment.trim() || undefined
        })
      });

      if (response.ok) {
        // Refresh pack details to show updated rating
        fetchPackDetails();
        setUserRating(0);
        setUserComment('');
      } else {
        alert('Failed to submit rating');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleUsePack = async () => {
    try {
      // Track pack usage
      await fetch(`/api/packs/${packId}/use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': user?.tenant_id
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'launcher_redirect',
          context: 'pack_details_page'
        })
      });

      // Redirect to launcher with pack selected
      router.push(`/kiffs/launcher?pack=${packId}`);
    } catch (error) {
      console.error('Error tracking pack usage:', error);
      // Still redirect even if tracking fails
      router.push(`/kiffs/launcher?pack=${packId}`);
    }
  };

  const getStatusDisplay = () => {
    if (!pack) return null;

    switch (pack.processing_status) {
      case 'processing':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Processing API documentation...</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Processing failed</span>
          </div>
        );
      case 'ready':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>Ready to use</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="w-4 h-4" />
            <span>Pending processing</span>
          </div>
        );
    }
  };

  if (!isAuthenticated) {
    return <div>Redirecting to login...</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pack Not Found</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/kiffs/packs">
              <Button>Back to Packs</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/kiffs/packs" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Packs
          </Link>
          
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{pack.display_name}</h1>
                {pack.is_verified && (
                  <Badge className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Verified
                  </Badge>
                )}
                <Badge variant="outline">{pack.category}</Badge>
              </div>
              
              <p className="text-gray-600 mb-4">{pack.description}</p>
              
              <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {pack.total_users_used} users
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {pack.usage_count} uses
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  {pack.avg_rating.toFixed(1)} rating
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Created {new Date(pack.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="mb-4">
                {getStatusDisplay()}
              </div>
              {pack.processing_status !== 'ready' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  You can close this window and check back in a couple of minutes. We&apos;ll notify you in the navbar when your pack is ready or if processing fails.
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </Button>
              <Button 
                className="flex items-center gap-2"
                onClick={handleUsePack}
                disabled={pack.processing_status !== 'ready'}
              >
                <Download className="w-4 h-4" />
                Use in Kiff
              </Button>
            </div>
          </div>
        </div>

        {/* Processing Error */}
        {pack.processing_status === 'failed' && pack.processing_error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Processing Failed</h4>
                  <p className="text-sm text-red-700 mt-1">{pack.processing_error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="api-structure">API Structure</TabsTrigger>
            <TabsTrigger value="code-examples">Code Examples</TabsTrigger>
            <TabsTrigger value="patterns">Integration Patterns</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* API Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>API Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm">Primary Documentation</h4>
                        <a 
                          href={pack.api_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                        >
                          {pack.api_url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      
                      {pack.documentation_urls.length > 1 && (
                        <div>
                          <h4 className="font-medium text-sm">Additional URLs</h4>
                          <ul className="space-y-1">
                            {pack.documentation_urls.slice(1).map((url, index) => (
                              <li key={index}>
                                <a 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                                >
                                  {url}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Usage Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{pack.usage_count}</p>
                        <p className="text-sm text-gray-600">Total Uses</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{pack.total_users_used}</p>
                        <p className="text-sm text-gray-600">Users</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">{pack.avg_rating.toFixed(1)}</p>
                        <p className="text-sm text-gray-600">Rating</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Pack Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pack Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">Created by</h4>
                      <p className="text-sm text-gray-600">{pack.created_by_name}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Category</h4>
                      <Badge variant="outline">{pack.category}</Badge>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Status</h4>
                      {getStatusDisplay()}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Last Updated</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(pack.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Rate This Pack */}
                <Card>
                  <CardHeader>
                    <CardTitle>Rate This Pack</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setUserRating(star)}
                            className={`text-lg ${
                              userRating >= star
                                ? 'text-yellow-400'
                                : 'text-gray-300 hover:text-yellow-400'
                            }`}
                          >
                            <Star className="w-5 h-5 fill-current" />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <Textarea
                      placeholder="Leave a comment (optional)"
                      value={userComment}
                      onChange={(e) => setUserComment(e.target.value)}
                      rows={3}
                    />
                    
                    <Button 
                      onClick={handleRatingSubmit}
                      disabled={!userRating || submittingRating}
                      className="w-full"
                    >
                      {submittingRating ? 'Submitting...' : 'Submit Rating'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="api-structure">
            <Card>
              <CardHeader>
                <CardTitle>API Structure</CardTitle>
                <CardDescription>
                  Extracted API endpoints, parameters, and schema information
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pack.api_structure && Object.keys(pack.api_structure).length > 0 ? (
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{
                      maxHeight: '600px',
                      borderRadius: '8px'
                    }}
                  >
                    {JSON.stringify(pack.api_structure, null, 2)}
                  </SyntaxHighlighter>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Code className="w-12 h-12 mx-auto mb-2" />
                    <p>API structure not available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="code-examples">
            <div className="space-y-6">
              {pack.code_examples && Object.keys(pack.code_examples).length > 0 ? (
                Object.entries(pack.code_examples).map(([language, code]) => (
                  <Card key={language}>
                    <CardHeader>
                      <CardTitle className="capitalize">{language} Examples</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SyntaxHighlighter
                        language={language === 'curl' ? 'bash' : language}
                        style={vscDarkPlus}
                        customStyle={{
                          borderRadius: '8px'
                        }}
                      >
                        {code}
                      </SyntaxHighlighter>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Code Examples Not Available</h3>
                    <p className="text-gray-600">
                      Code examples are being generated or pack processing failed
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="patterns">
            <div className="space-y-4">
              {pack.integration_patterns && pack.integration_patterns.length > 0 ? (
                pack.integration_patterns.map((pattern, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="prose max-w-none">
                        <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm">
                          {pattern}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Integration Patterns Not Available</h3>
                    <p className="text-gray-600">
                      Integration patterns are being generated or pack processing failed
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="feedback">
            <div className="space-y-6">
              {pack.recent_ratings && pack.recent_ratings.length > 0 ? (
                pack.recent_ratings.map((rating, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= rating.rating
                                      ? 'text-yellow-400 fill-current'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(rating.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {rating.comment && (
                            <p className="text-gray-700">{rating.comment}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Feedback Yet</h3>
                    <p className="text-gray-600">
                      Be the first to rate and review this pack
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}