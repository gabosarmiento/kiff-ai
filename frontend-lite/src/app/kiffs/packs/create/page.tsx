'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useLayoutState } from '@/components/layout/LayoutState';
import PageContainer from '@/components/ui/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Globe, 
  Shield, 
  Wand2, 
  CheckCircle,
  AlertCircle,
  Loader,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';
import { getTenantId } from '@/lib/tenant';

// Agent/Model used for pack generation/indexing in this flow
const AGENT_MODEL = 'llama-3.3-70b-versatile';

interface CreatePackResponse {
  pack_id: string;
}

interface PopularAPI {
  name: string;
  url: string;
  category: string;
  description: string;
}

const popularAPIs: PopularAPI[] = [
  {
    name: 'ElevenLabs Voice',
    url: 'https://docs.elevenlabs.io/',
    category: 'AI/ML',
    description: 'Voice synthesis and cloning API'
  },
  {
    name: 'OpenAI GPT',
    url: 'https://platform.openai.com/docs/',
    category: 'AI/ML',
    description: 'Large language models and AI capabilities'
  },
  {
    name: 'Stripe Payments',
    url: 'https://docs.stripe.com/api',
    category: 'Payment',
    description: 'Complete payment processing platform'
  },
  {
    name: 'Twilio Communications',
    url: 'https://www.twilio.com/docs/',
    category: 'Communication',
    description: 'SMS, voice, and video communications'
  },
  {
    name: 'SendGrid Email',
    url: 'https://docs.sendgrid.com/',
    category: 'Communication',
    description: 'Email delivery and marketing platform'
  },
  {
    name: 'Anthropic Claude',
    url: 'https://docs.anthropic.com/',
    category: 'AI/ML',
    description: 'Advanced AI assistant and language model'
  },
  {
    name: 'Replicate AI',
    url: 'https://replicate.com/docs',
    category: 'AI/ML',
    description: 'Run machine learning models in the cloud'
  },
  {
    name: 'Pinecone Vector DB',
    url: 'https://docs.pinecone.io/',
    category: 'Database',
    description: 'Vector database for AI applications'
  }
];

export default function CreatePackPage() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [selectedAPI, setSelectedAPI] = useState<PopularAPI | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    category: 'AI/ML',
    api_url: '',
    additional_urls: '',
    logo_url: '',
    make_public: true,
    request_verification: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleQuickSelect = (api: PopularAPI) => {
    setSelectedAPI(api);
    setFormData(prev => ({
      ...prev,
      name: api.name.replace(/\s+/g, '-').toLowerCase(),
      display_name: api.name,
      api_url: api.url,
      category: api.category,
      description: api.description
    }));
    setErrors({});
  };

  const clearSelection = () => {
    setSelectedAPI(null);
    setFormData({
      name: '',
      display_name: '',
      description: '',
      category: 'AI/ML',
      api_url: '',
      additional_urls: '',
      logo_url: '',
      make_public: true,
      request_verification: false
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Pack name is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.name)) {
      newErrors.name = 'Pack name can only contain lowercase letters, numbers, and hyphens';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Display name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!formData.api_url.trim()) {
      newErrors.api_url = 'API documentation URL is required';
    } else {
      try {
        new URL(formData.api_url);
      } catch {
        newErrors.api_url = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);
    setProcessingStage('Creating pack...');

    try {
      const additional_urls = formData.additional_urls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const result = await apiJson<CreatePackResponse>('/api/packs/create', {
        method: 'POST',
        body: {
          ...formData,
          // Default to a random logo when not provided
          logo_url: (formData.logo_url && formData.logo_url.trim()) || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(formData.name || 'kiffpack')}`,
          additional_urls
        }
      });

      setProcessingStage('Pack created! Starting processing…');

      // Immediately trigger a reprocess to ensure fresh indexing
      try {
        await apiJson(`/api/packs/${result.pack_id}/reprocess`, {
          method: 'POST'
        });
        setProcessingStage('Processing API documentation…');
      } catch (e) {
        // Even if reprocess fails here, continue to redirect; the pack page will show status
        console.warn('Reprocess request failed, proceeding to redirect', e);
      }

      // Add to pending packs in localStorage so Navbar can notify when done
      try {
        const key = 'pending_packs';
        const prev = JSON.parse(localStorage.getItem(key) || '[]');
        const tenant = getTenantId();
        const next = Array.isArray(prev) ? prev : [];
        // Avoid duplicates per tenant
        if (!next.find((p: any) => p && p.id === result.pack_id && p.tenant === tenant)) {
          next.push({ id: result.pack_id, tenant, added_at: Date.now() });
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        // non-fatal
      }
      
      // Redirect to the pack page after a short delay
      setTimeout(() => {
        router.push(`/kiffs/packs/${result.pack_id}`);
      }, 2000);
    } catch (error) {
      console.error('Error creating pack:', error);
      alert(`Failed to create pack: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  if (!isAuthenticated) {
    return <div>Redirecting to login...</div>;
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md fx-card">
          <CardContent className="p-8 text-center">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold mb-2">Creating Your Pack</h3>
            <p className="text-gray-600 mb-4">{processingStage}</p>
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-blue-700">
                This may take a few minutes as we process the API documentation and generate code examples.
              </p>
              <p className="text-sm text-blue-700">
                You can close this window and check back in a couple of minutes. We&apos;ll notify you in the navbar when your pack is ready or if processing fails.
              </p>
            </div>
            <Button
              className="mt-6 w-full fx-button"
              variant="outline"
              onClick={() => router.push('/kiffs/packs')}
            >
              Back to Packs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar fx-section" style={{ padding: 16, paddingLeft: leftWidth + 24, margin: "0 auto", maxWidth: 1200 }}>
        <PageContainer padded>
          {/* Header */}
          <div className="mb-8">
            <Link 
            href="/kiffs/packs" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Packs
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Pack</h1>
          <p className="text-gray-600 mt-2">
            Create an API knowledge pack that will be available to your entire team
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline">Agent</Badge>
            <span className="text-sm text-gray-700">{AGENT_MODEL}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quick API Selection */}
          <Card className="fx-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Quick Start - Popular APIs
              </CardTitle>
              <CardDescription>
                Choose from popular APIs to get started quickly, or scroll down for custom setup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 fx-stagger">
                {popularAPIs.map((api) => {
  const isSelected = selectedAPI?.name === api.name;
  return (
    <div
      key={api.name}
      className={`relative border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => handleQuickSelect(api)}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-sm">{api.name}</h4>
        <Badge variant="outline" className="text-xs">
          {api.category}
        </Badge>
      </div>
      <p className="text-xs text-gray-600 mb-2">{api.description}</p>
      <div className="flex items-center text-xs text-gray-500">
        <ExternalLink className="w-3 h-3 mr-1" />
        <a
          href={api.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-700"
          onClick={e => e.stopPropagation()}
        >
          Documentation
        </a>
      </div>
      {isSelected && (
        <CheckCircle className="absolute bottom-2 right-2 w-5 h-5 text-blue-600 bg-white rounded-full shadow" />
      )}
    </div>
  );
})}
              </div>
              
              {selectedAPI && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Selected: {selectedAPI.name}
                      </span>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="fx-button"
                      onClick={clearSelection}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pack Details */}
          <Card className="fx-card">
            <CardHeader>
              <CardTitle>Pack Details</CardTitle>
              <CardDescription>
                Provide information about your API pack
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Pack Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="elevenlabs-voice-api"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    URL-friendly name (lowercase, hyphens only)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="display_name">Display Name *</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({...prev, display_name: e.target.value}))}
                    placeholder="ElevenLabs Voice API"
                    className={errors.display_name ? 'border-red-500' : ''}
                  />
                  {errors.display_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.display_name}</p>
                  )}
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  placeholder="Comprehensive voice synthesis and cloning API pack with examples and integration patterns..."
                  rows={3}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                  <p className="text-sm text-red-600 mt-1">{errors.description}</p>
                )}
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({...prev, category: value}))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
              </div>
            </CardContent>
          </Card>

          {/* API Documentation */}
          <Card className="fx-card">
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>
                Provide URLs to the API documentation for processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="api_url">Primary Documentation URL *</Label>
                <Input
                  id="api_url"
                  value={formData.api_url}
                  onChange={(e) => setFormData(prev => ({...prev, api_url: e.target.value}))}
                  placeholder="https://docs.elevenlabs.io/api-reference"
                  type="url"
                  className={`${errors.api_url ? 'border-red-500' : ''} w-full`}
                />
                {errors.api_url && (
                  <p className="text-sm text-red-600 mt-1">{errors.api_url}</p>
                )}
              </div>

              <div>
                <Label htmlFor="additional_urls">Additional URLs (optional)</Label>
                <Textarea
                  id="additional_urls"
                  value={formData.additional_urls}
                  onChange={(e) => setFormData(prev => ({...prev, additional_urls: e.target.value}))}
                  placeholder="https://docs.elevenlabs.io/examples&#10;https://github.com/elevenlabs/examples"
                  rows={3}
                />
                <p className="text-sm text-gray-500 mt-1">One URL per line</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800 mb-1">What happens next?</p>
                    <ul className="text-blue-700 space-y-1">
                      <li>• We&apos;ll crawl the API documentation</li>
                      <li>• Extract endpoints, parameters, and examples</li>
                      <li>• Generate code examples in multiple languages</li>
                      <li>• Create integration patterns and best practices</li>
                      <li>• Store everything in a searchable format</li>
                    </ul>
                  </div>
                </div>
              </div>
              {/* Optional logo field */}
              <div>
                <Label htmlFor="logo_url">Logo URL (optional)</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({...prev, logo_url: e.target.value}))}
                  placeholder="https://logo.clearbit.com/example.com or any image URL"
                  type="url"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If left blank, a random placeholder logo will be used.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sharing Settings */}
          <Card className="fx-card">
            <CardHeader>
              <CardTitle>Sharing Settings</CardTitle>
              <CardDescription>
                Control how your pack is shared with the team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="make_public"
                  checked={formData.make_public}
                  onCheckedChange={(checked) => setFormData(prev => ({...prev, make_public: !!checked}))}
                />
                <Label htmlFor="make_public" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Share with entire tenant
                </Label>
              </div>
              <p className="text-sm text-gray-600 ml-6">
                ✅ Recommended: Help your team by sharing knowledge
              </p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="request_verification"
                  checked={formData.request_verification}
                  onCheckedChange={(checked) => setFormData(prev => ({...prev, request_verification: !!checked}))}
                />
                <Label htmlFor="request_verification" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Request admin verification
                </Label>
              </div>
              <p className="text-sm text-gray-600 ml-6">
                🏆 Verified packs get priority in search results
              </p>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Link href="/kiffs/packs">
              <Button type="button" variant="outline" className="fx-button">Cancel</Button>
            </Link>
            <Button 
              type="submit" 
              className="rounded-lg px-4 py-2 text-base font-medium text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 fx-button"
            >
              <Wand2 className="w-4 h-4" />
              Create Pack
            </Button>
          </div>
        </form>
        </PageContainer>
      </main>
      <BottomNav />
    </div>
  );
}