'use client';

/**
 * Marketa Asset Catalog
 * 
 * Browse and discover QubeBase content assets for use in campaigns
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Copy, ExternalLink, PlayCircle, Clock, Filter, Database, TrendingUp, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';

// Marketa styling constants
const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";
const ROSE_GLOW = "shadow-rose-500/20 shadow-lg hover:shadow-rose-500/30";

const GlassCard = ({ children, className = "", hover = true }: { 
  children: React.ReactNode; 
  className?: string; 
  hover?: boolean;
}) => (
  <div className={`${GLASS_CARD} ${hover ? GLASS_HOVER : ""} ${className} rounded-xl`}>
    {children}
  </div>
);

interface Asset {
  content_id: string;
  title: string;
  description: string;
  app: string;
  content_type: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  external_url?: string;
  modalities?: any;
  asset_ref: string;
  availability_status: string;
}

interface AssetCatalogResponse {
  success: boolean;
  data?: {
    assets: Asset[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
    filters: any;
  };
  error?: string;
}

export default function MarketaAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [appFilter, setAppFilter] = useState('Qriptopian');
  const [typeFilter, setTypeFilter] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAssets();
  }, [appFilter, typeFilter, pagination.offset]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        app: appFilter,
        type: typeFilter,
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      const response = await fetch(`/api/marketa/admin/assets?${params}`, {
        headers: {
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true', // Developer override
        },
      });

      const data: AssetCatalogResponse = await response.json();
      
      if (data.success && data.data) {
        setAssets(data.data.assets);
        setPagination(data.data.pagination);
      } else {
        setError(data.error || 'Failed to load assets');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const copyAssetRef = async (assetRef: string) => {
    try {
      await navigator.clipboard.writeText(assetRef);
      toast('Asset reference copied to clipboard', 'success');
    } catch (err) {
      toast('Failed to copy to clipboard', 'error');
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.asset_ref.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getAppColor = (app: string) => {
    switch (app) {
      case 'Qriptopian': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'metaKnyts': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'Codex': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'audio': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'text': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'image': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-purple-100 text-purple-800';
      case 'article': return 'bg-blue-100 text-blue-800';
      case 'audio': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVideoUrl = (modalities: any) => {
    return modalities?.watch?.videoAssets?.[0]?.url || 
           modalities?.watch?.video_url || 
           modalities?.link?.url;
  };

  const buildQriptopianUrl = (asset: Asset) => {
    const videoUrl = getVideoUrl(asset.modalities);
    if (videoUrl && videoUrl.includes('article?id=')) {
      return videoUrl;
    }
    return `https://theqriptopian.netlify.app/article?id=${asset.content_id}&type=video`;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <Database className="w-8 h-8" />
              Asset Catalog
            </h1>
            <p className="text-slate-300">
              Browse and discover QubeBase content assets for use in campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-rose-500 hover:bg-rose-600 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Upload Asset
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Filters */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Filters</h3>
            <p className="text-slate-300 text-sm">
              Filter assets by app, type, and search terms
            </p>
          </div>
          <Filter className="w-5 h-5 text-rose-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              App
            </label>
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="w-full p-2 border border-white/20 rounded-md bg-slate-800/50 text-white"
            >
              <option value="Qriptopian">Qriptopian</option>
              <option value="metaKnyts">metaKnyts</option>
              <option value="Codex">Codex</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full p-2 border border-white/20 rounded-md bg-slate-800/50 text-white"
            >
              <option value="">All Types</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Search
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-slate-800/50 border-white/20 text-white placeholder:text-slate-400"
              />
              <Button variant="outline" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Assets Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Assets ({pagination.total} total)</h3>
            <p className="text-slate-300 text-sm">
              Available content assets for campaign creation
            </p>
          </div>
          <TrendingUp className="w-5 h-5 text-rose-400" />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <Table className="border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="border-b border-white/10">
              <TableHead className="text-slate-300 font-semibold">Asset</TableHead>
              <TableHead className="text-slate-300 font-semibold">App</TableHead>
              <TableHead className="text-slate-300 font-semibold">Type</TableHead>
              <TableHead className="text-slate-300 font-semibold">Duration</TableHead>
              <TableHead className="text-slate-300 font-semibold">Reference</TableHead>
              <TableHead className="text-slate-300 font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.map((asset) => (
              <TableRow key={asset.content_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <TableCell className="text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-slate-800/50 flex items-center justify-center">
                      {asset.content_type === 'video' && <PlayCircle className="w-5 h-5 text-rose-400" />}
                      {asset.content_type === 'audio' && <PlayCircle className="w-5 h-5 text-cyan-400" />}
                      {asset.content_type === 'text' && <Database className="w-5 h-5 text-green-400" />}
                    </div>
                    <div>
                      <div className="font-medium">{asset.title}</div>
                      <div className="text-sm text-slate-400">{asset.description}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-white">
                  <Badge className={getAppColor(asset.app)}>
                    {asset.app}
                  </Badge>
                </TableCell>
                <TableCell className="text-white">
                  <Badge className={getTypeColor(asset.content_type)}>
                    {asset.content_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-white">
                  <div className="flex items-center text-sm text-slate-400">
                    <Clock className="mr-2 h-4 w-4" />
                    {asset.duration_seconds ? formatDuration(asset.duration_seconds) : 'N/A'}
                  </div>
                </TableCell>
                <TableCell className="text-white">
                  <code className="text-xs bg-slate-800/50 px-2 py-1 rounded text-slate-300">
                    {asset.asset_ref}
                  </code>
                </TableCell>
                <TableCell className="text-white">
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyAssetRef(asset.asset_ref)}
                      className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                    {asset.external_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
                      >
                        <a
                          href={asset.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredAssets.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            No assets found matching your criteria.
          </div>
        )}
      </GlassCard>

      {/* Usage Instructions */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Using Assets in Campaigns</h3>
            <p className="text-slate-300 text-sm">
              How to use these assets in your Marketa campaigns
            </p>
          </div>
          <Database className="w-5 h-5 text-rose-400" />
        </div>
        <div className="space-y-3 text-slate-300">
          <div className="text-sm">
            <h4 className="font-medium mb-1 text-white">Asset References</h4>
            <p>
              Use the asset reference (e.g., <code className="bg-slate-800/50 px-2 py-1 rounded text-slate-300">smart_content_qubes:123</code>) 
              when creating campaign sequences to automatically pull content.
            </p>
          </div>
          <div className="text-sm">
            <h4 className="font-medium mb-1 text-white">Content Types</h4>
            <p>
              Video assets work best for social media campaigns, while audio and text assets 
              can provide additional content for multi-channel campaigns.
            </p>
          </div>
          <div className="text-sm">
            <h4 className="font-medium mb-1 text-white">External Links</h4>
            <p>
              Click the external link icon to preview content in its native app before 
              adding it to your campaign.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
