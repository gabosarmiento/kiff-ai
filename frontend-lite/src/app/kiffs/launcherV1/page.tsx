"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";
import PageContainer from "@/components/ui/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiGallery } from "@/components/ApiGallery";
import { usePacks } from "@/contexts/PackContext";
import { useAuth } from "@/hooks/useAuth";
import toast from "react-hot-toast";
import Image from "next/image";
import {
  Plus,
  Search,
  Star,
  Users,
  TrendingUp,
  Shield,
  Eye,
  Loader2,
  Wand2,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { getTenantId } from "@/lib/tenant";
import dynamic from "next/dynamic";

// Import existing launcher page component and render as the top section
// This page component renders its own internal content; we compose it here under the unified shell.
const LauncherPage = dynamic(() => import("../launcher/page").then(m => m.default), { ssr: false });

// Types reused from packs page
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

// Embedded Packs Gallery (no own navbar/sidebar)
function PacksGalleryEmbedded() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const { isAuthenticated } = useAuth();
  const { selectedPacks, addPack, removePack } = usePacks();

  const [packs, setPacks] = useState<KiffPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("most_used");
  const [activeTab, setActiveTab] = useState("gallery");
  const hasProcessing = packs.some((p) => p.processing_status === "processing");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTenantPacks = useCallback(async () => {
    try {
      if (!isAuthenticated) return;
      const params = new URLSearchParams({
        search: searchQuery,
        category: categoryFilter,
        sort: sortBy,
        limit: "50",
      });
      const data = await apiJson<PacksResponse>(`/api/packs/?${params}`);
      setPacks(data.packs);
    } catch (error) {
      console.error("Error fetching packs:", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, searchQuery, categoryFilter, sortBy]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchTenantPacks();
  }, [isAuthenticated, fetchTenantPacks]);

  // Poll while indexing
  useEffect(() => {
    if (!isAuthenticated || !hasProcessing) return;
    const id = setInterval(() => fetchTenantPacks(), 3000);
    return () => clearInterval(id);
  }, [isAuthenticated, hasProcessing, fetchTenantPacks]);

  const handlePackRate = async (packId: string, rating: number) => {
    if (!isAuthenticated) return;
    setPacks((prev) => prev.map((p) => (p.id === packId ? { ...p, user_rating: rating } : p)));
    try {
      await apiJson(`/api/packs/${packId}/rate`, { method: "POST", body: { rating } });
      toast.success("Rating saved");
      fetchTenantPacks();
    } catch {
      toast.error("Failed to save rating");
    }
  };

  const getStatusBadge = (pack: KiffPack) => {
    if (pack.processing_status === "processing") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Indexing
        </Badge>
      );
    }
    if (pack.processing_status === "failed") return <Badge variant="destructive">Failed</Badge>;
    if (pack.is_verified)
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Shield className="w-3 h-3" /> Verified
        </Badge>
      );
    return <Badge variant="outline">Ready</Badge>;
  };

  const PackCard = ({ pack }: { pack: KiffPack }) => {
    const [logoError, setLogoError] = useState(false);
    const isSelected = selectedPacks.includes(pack.id);
    return (
      <Card className="hover:shadow-lg transition-shadow duration-200">
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
                      className="h-8 w-8 object-contain"
                      loading="lazy"
                      unoptimized
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <span title="No logo" style={{ fontSize: 16, lineHeight: 1 }}>
                      📦
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    {pack.display_name}
                    {pack.processing_status === "processing" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                        <Loader2 className="w-3 h-3 animate-spin" /> Indexing
                      </span>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 mt-1">
                    {pack.category} • by {pack.created_by_name}
                  </CardDescription>
                </div>
              </div>
            </div>
            {getStatusBadge(pack)}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 mb-4 line-clamp-2">{pack.description}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {pack.total_users_used} users
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {pack.usage_count} uses
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {pack.avg_rating.toFixed(1)}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => window.open(`/kiffs/packs/scramble?pack=${pack.id}`, "_blank")}
              disabled={pack.processing_status === "processing"}
            >
              <Eye className="w-3 h-3" /> Preview
            </Button>

            <Button
              size="sm"
              className={`rounded-lg px-4 py-2 text-base font-medium flex items-center gap-1 ${
                isSelected
                  ? "bg-black text-white hover:bg-zinc-800 shadow-lg border-0"
                  : "text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              }`}
              disabled={pack.processing_status === "processing"}
              onClick={() => {
                if (isSelected) {
                  const removedId = pack.id;
                  removePack(removedId);
                  toast.custom(
                    (t) => (
                      <div className="bg-gray-900 text-white shadow-lg px-4 py-3 rounded-xl text-sm flex items-center gap-4 border border-gray-800">
                        <span className="select-none">🗑️</span>
                        <span>Pack removed from your session packs</span>
                        <button
                          className="ml-2 text-gray-300 hover:text-gray-100"
                          onClick={() => {
                            addPack(removedId);
                            toast.dismiss(t.id);
                            toast.success("Restored");
                          }}
                          aria-label="Undo removal"
                        >
                          Undo
                        </button>
                      </div>
                    ),
                    { duration: 5000 }
                  );
                } else {
                  addPack(pack.id);
                  toast.success(
                    `Pack "${pack.display_name}" added to your available packs - find them ready in your model!`,
                    { duration: 5000 }
                  );
                }
              }}
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

          {/* Rating */}
          <div className="flex items-center gap-1 mt-3 pt-3 border-t">
            <span className="text-xs text-gray-500 mr-2">Rate:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handlePackRate(pack.id, star)}
                className={`text-sm ${pack.user_rating && pack.user_rating >= star ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
              >
                <Star className="w-3 h-3 fill-current" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <section style={{ marginTop: 24 }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="m-0 text-lg font-semibold">Packs</h2>
          <p className="mt-1 text-sm text-slate-600">Manage and use API knowledge packs</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="rounded-lg px-4 py-2 text-base font-medium text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Pack
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="gallery">Indexed Pack Gallery</TabsTrigger>
        </TabsList>
        <TabsContent value="gallery">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
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
                  <SelectTrigger className="w-48">
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

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="most_used">Most Used</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="highest_rated">Highest Rated</SelectItem>
                    <SelectItem value="alphabetical">A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {hasProcessing ? (
            <Card className="mb-4 border-dashed">
              <CardContent className="p-4 text-sm text-gray-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Indexing in progress for one or more packs. This can take a couple of minutes.
              </CardContent>
            </Card>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : packs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-gray-600 mb-4">No packs found. Be the first to create one!</p>
                <Button onClick={() => setCreateOpen(true)}>Create First Pack</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packs.map((pack) => (
                <PackCard key={pack.id} pack={pack} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Pack Modal */}
      {createOpen && <CreatePackModal onClose={() => setCreateOpen(false)} onCreated={fetchTenantPacks} />}
    </section>
  );
}

// Create Pack Modal (inline, using same fields as create page but without navigation)
function CreatePackModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    description: "",
    category: "AI/ML",
    api_url: "",
    additional_urls: "",
    logo_url: "",
    make_public: true,
    request_verification: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Pack name is required";
    else if (!/^[a-z0-9-]+$/.test(formData.name)) newErrors.name = "Lowercase letters, numbers, hyphens only";
    if (!formData.display_name.trim()) newErrors.display_name = "Display name is required";
    if (!formData.description.trim() || formData.description.length < 10) newErrors.description = "Description must be at least 10 characters";
    if (!formData.api_url.trim()) newErrors.api_url = "API documentation URL is required";
    else {
      try { new URL(formData.api_url); } catch { newErrors.api_url = "Please enter a valid URL"; }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsProcessing(true);
    setProcessingStage("Creating pack...");
    try {
      const additional_urls = formData.additional_urls
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      const result = await apiJson<{ pack_id: string }>("/api/packs/create", {
        method: "POST",
        body: {
          ...formData,
          logo_url:
            (formData.logo_url && formData.logo_url.trim()) ||
            `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(formData.name || "kiffpack")}`,
          additional_urls,
        },
      });

      setProcessingStage("Pack created! Starting processing…");
      try {
        await apiJson(`/api/packs/${result.pack_id}/reprocess`, { method: "POST" });
        setProcessingStage("Processing API documentation…");
      } catch (e) {
        console.warn("Reprocess request failed", e);
      }

      // Track pending pack for navbar notifications
      try {
        const key = "pending_packs";
        const prev = JSON.parse(localStorage.getItem(key) || "[]");
        const tenant = getTenantId();
        const next = Array.isArray(prev) ? prev : [];
        if (!next.find((p: any) => p && p.id === result.pack_id && p.tenant === tenant)) {
          next.push({ id: result.pack_id, tenant, added_at: Date.now() });
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {}

      toast.success("Pack created and processing started");
      onCreated();
      onClose();
    } catch (error: any) {
      console.error("Error creating pack:", error);
      toast.error(`Failed to create pack: ${error?.message || "Unknown error"}`);
      setIsProcessing(false);
      setProcessingStage("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        {isProcessing ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold mb-2">Creating Your Pack</h3>
              <p className="text-gray-600 mb-4">{processingStage}</p>
              <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-left">
                <p className="text-sm text-blue-700">We are processing the API documentation and generating examples. This may take a few minutes.</p>
              </div>
              <Button className="mt-6 w-full" variant="outline" onClick={onClose}>
                Close
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Create New Pack</CardTitle>
                <CardDescription>Create an API knowledge pack for your team</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pack Details</CardTitle>
                <CardDescription>Provide information about your API pack</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="text-sm font-medium">Pack Name *</label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="elevenlabs-voice-api"
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name ? <p className="text-sm text-red-600 mt-1">{errors.name}</p> : null}
                    <p className="text-xs text-gray-500 mt-1">URL-friendly name (lowercase, hyphens only)</p>
                  </div>

                  <div>
                    <label htmlFor="display_name" className="text-sm font-medium">Display Name *</label>
                    <Input
                      id="display_name"
                      value={formData.display_name}
                      onChange={(e) => setFormData((p) => ({ ...p, display_name: e.target.value }))}
                      placeholder="ElevenLabs Voice API"
                      className={errors.display_name ? "border-red-500" : ""}
                    />
                    {errors.display_name ? (
                      <p className="text-sm text-red-600 mt-1">{errors.display_name}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="text-sm font-medium">Description *</label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Comprehensive API pack with examples and integration patterns..."
                    rows={3}
                    className={errors.description ? "border-red-500" : ""}
                  />
                  {errors.description ? (
                    <p className="text-sm text-red-600 mt-1">{errors.description}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="category" className="text-sm font-medium">Category *</label>
                  <Select value={formData.category} onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}>
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

            <Card>
              <CardHeader>
                <CardTitle>API Documentation</CardTitle>
                <CardDescription>Provide URLs to the API documentation for processing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="api_url" className="text-sm font-medium">Primary Documentation URL *</label>
                  <Input
                    id="api_url"
                    value={formData.api_url}
                    onChange={(e) => setFormData((p) => ({ ...p, api_url: e.target.value }))}
                    placeholder="https://docs.elevenlabs.io/api-reference"
                    type="url"
                    className={`${errors.api_url ? "border-red-500" : ""} w-full`}
                  />
                  {errors.api_url ? <p className="text-sm text-red-600 mt-1">{errors.api_url}</p> : null}
                </div>

                <div>
                  <label htmlFor="additional_urls" className="text-sm font-medium">Additional URLs (optional)</label>
                  <Textarea
                    id="additional_urls"
                    value={formData.additional_urls}
                    onChange={(e) => setFormData((p) => ({ ...p, additional_urls: e.target.value }))}
                    placeholder="https://docs.elevenlabs.io/examples\nhttps://github.com/elevenlabs/examples"
                    rows={3}
                  />
                  <p className="text-sm text-gray-500 mt-1">One URL per line</p>
                </div>

                <div>
                  <label htmlFor="logo_url" className="text-sm font-medium">Logo URL (optional)</label>
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData((p) => ({ ...p, logo_url: e.target.value }))}
                    placeholder="https://logo.clearbit.com/example.com or any image URL"
                    type="url"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">If left blank, a random placeholder logo will be used.</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-lg px-4 py-2 text-base font-medium text-white shadow-lg hover:shadow-xl border-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" /> Create Pack
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LauncherV1Page() {
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar" style={{ padding: 16, paddingLeft: leftWidth + 24, margin: "0 auto", maxWidth: 1200 }}>
        <PageContainer padded>
          {/* Top: Existing Launcher */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle>Launcher</CardTitle>
                <CardDescription>Your main launcher view</CardDescription>
              </CardHeader>
              <CardContent>
                <LauncherPage />
              </CardContent>
            </Card>
          </section>

          {/* Middle: API Gallery */}
          <section style={{ marginTop: 24 }}>
            <ApiGallery />
          </section>

          {/* Bottom: Packs Gallery with Create Modal */}
          <PacksGalleryEmbedded />
        </PageContainer>
      </main>
      <BottomNav />
    </div>
  );
}
