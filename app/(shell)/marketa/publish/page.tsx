'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Upload, Send, Eye, Edit, Calendar, Users, TrendingUp } from 'lucide-react';

// Mock data - replace with real API calls
const mockContentPacks = [
  {
    id: '1',
    name: 'Q1 Product Launch Pack',
    description: 'Complete content package for Q1 product launch campaign',
    type: 'campaign',
    status: 'published',
    created_at: new Date().toISOString(),
    assets_count: 12,
    channels: ['email', 'social', 'web'],
    performance: {
      impressions: 45000,
      clicks: 1200,
      engagement_rate: 2.7
    }
  },
  {
    id: '2',
    name: 'Brand Awareness Templates',
    description: 'Reusable templates for brand awareness campaigns',
    type: 'template',
    status: 'draft',
    created_at: new Date().toISOString(),
    assets_count: 8,
    channels: ['social', 'web'],
    performance: null
  },
  {
    id: '3',
    name: 'Partner Welcome Kit',
    description: 'Onboarding content package for new partners',
    type: 'onboarding',
    status: 'published',
    created_at: new Date().toISOString(),
    assets_count: 6,
    channels: ['email', 'web'],
    performance: {
      impressions: 12000,
      clicks: 480,
      engagement_rate: 4.0
    }
  }
];

export default function PublishPage() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'campaign':
        return <TrendingUp className="w-4 h-4" />;
      case 'template':
        return <Package className="w-4 h-4" />;
      case 'onboarding':
        return <Users className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <Package className="w-8 h-8" />
              Content Publishing
            </h1>
            <p className="text-slate-300">
              Create, manage, and distribute content packs across multiple channels
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
              <Upload className="w-4 h-4 mr-2" />
              Import Pack
            </Button>
            <Button className="bg-rose-500 hover:bg-rose-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Pack
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Packs</p>
              <p className="text-2xl font-bold text-white">{mockContentPacks.length}</p>
            </div>
            <Package className="w-8 h-8 text-rose-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Published</p>
              <p className="text-2xl font-bold text-green-400">
                {mockContentPacks.filter(p => p.status === 'published').length}
              </p>
            </div>
            <Send className="w-8 h-8 text-green-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Assets</p>
              <p className="text-2xl font-bold text-blue-400">
                {mockContentPacks.reduce((sum, p) => sum + p.assets_count, 0)}
              </p>
            </div>
            <Eye className="w-8 h-8 text-blue-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Impressions</p>
              <p className="text-2xl font-bold text-purple-400">
                {formatNumber(mockContentPacks.reduce((sum, p) => sum + (p.performance?.impressions || 0), 0))}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-400/50" />
          </div>
        </div>
      </div>

      {/* Content Packs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockContentPacks.map((pack) => (
          <div key={pack.id} className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6 hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getTypeIcon(pack.type)}
                <Badge className={getStatusColor(pack.status)}>
                  {pack.status}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-white mb-2">{pack.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{pack.description}</p>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Type:</span>
                <span className="text-white capitalize">{pack.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Assets:</span>
                <span className="text-white">{pack.assets_count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Channels:</span>
                <span className="text-white">{pack.channels.join(', ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Created:</span>
                <span className="text-white">{formatDate(pack.created_at)}</span>
              </div>
            </div>
            
            {pack.performance && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-sm text-slate-400 mb-2">Performance</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>{formatNumber(pack.performance.impressions)} impressions</div>
                  <div>{formatNumber(pack.performance.clicks)} clicks</div>
                  <div className="col-span-2">{pack.performance.engagement_rate}% engagement</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
