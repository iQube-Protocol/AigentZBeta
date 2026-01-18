'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ContentActionIcons, type ContentModalityState } from '@/app/components/content/ContentActionIcons';
import MarketaQubeTalk from './components/MarketaQubeTalk';
import Link from 'next/link';
import { 
  TrendingUp, 
  Users, 
  Target, 
  Mail, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  Plus,
  Calendar,
  DollarSign,
  Eye,
  Edit,
  Trash2,
  BookOpen,
  Play,
  Headphones,
  Send,
  Share,
  Download,
  Heart,
  Bookmark,
  Database,
  Search
} from 'lucide-react';

// Mock data with SmartContent modalities
const mockCampaigns = [
  {
    id: '1',
    name: 'Q1 Product Launch',
    phase: 'codex1',
    status: 'active',
    startDate: '2024-01-15',
    endDate: '2024-03-31',
    budget: 50000,
    targetAudience: 12500,
    channels: ['email', 'social', 'web'],
    content: {
      modalities: { read: true, watch: true, listen: false, interact: true },
      title: 'Q1 Product Launch Campaign',
      description: 'Comprehensive product launch strategy with multi-channel content',
      thumbnail: '/api/placeholder/300/200'
    }
  },
  {
    id: '2', 
    name: 'Community Engagement',
    phase: 'pre_fairlaunch',
    status: 'draft',
    startDate: '2024-02-01',
    endDate: '2024-04-15',
    budget: 25000,
    targetAudience: 8000,
    channels: ['discord', 'telegram'],
    content: {
      modalities: { read: true, watch: false, listen: true, interact: true },
      title: 'Community Engagement Strategy',
      description: 'Building vibrant community through targeted engagement',
      thumbnail: '/api/placeholder/300/200'
    }
  }
];

const mockPartners = [
  {
    id: '1',
    name: 'TechCorp Solutions',
    role: 'strategic',
    status: 'active',
    channels: ['email', 'web'],
    lastCampaign: '2024-01-10',
    content: {
      modalities: { read: true, watch: true, listen: false, interact: false },
      title: 'TechCorp Partnership Profile',
      description: 'Strategic technology partner with integrated solutions',
      thumbnail: '/api/placeholder/300/200'
    }
  },
  {
    id: '2',
    name: 'Growth Partners LLC',
    role: 'affiliate',
    status: 'pending',
    channels: ['social'],
    lastCampaign: null,
    content: {
      modalities: { read: true, watch: false, listen: false, interact: true },
      title: 'Growth Partners Onboarding',
      description: 'Affiliate partnership program details and requirements',
      thumbnail: '/api/placeholder/300/200'
    }
  }
];

// Glass effect styling classes
const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";
const ROSE_GLOW = "shadow-rose-500/20 shadow-lg hover:shadow-rose-500/30";

export default function MarketaPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [campaigns, setCampaigns] = useState(mockCampaigns);
  const [partners, setPartners] = useState(mockPartners);

  const handleContentAction = (type: string, item: any) => {
    console.log(`Content action: ${type} for ${item.name}`);
    // Here you would integrate with SmartTriad content system
    switch (type) {
      case 'read':
        // Open content viewer with read modality
        break;
      case 'watch':
        // Open video player
        break;
      case 'listen':
        // Open audio player
        break;
      case 'interact':
        // Open interactive content
        break;
    }
  };

  const GlassCard = ({ children, className = "", hover = true }: { 
    children: React.ReactNode; 
    className?: string; 
    hover?: boolean;
  }) => (
    <div className={`${GLASS_CARD} ${hover ? GLASS_HOVER : ""} ${className} rounded-xl`}>
      {children}
    </div>
  );

  const ContentCard = ({ item, type }: { item: any; type: 'campaign' | 'partner' }) => (
    <GlassCard hover className="p-4 relative group">
      {/* SmartAction Icons */}
      <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ContentActionIcons
          modalities={item.content.modalities}
          size="sm"
          onRead={() => handleContentAction('read', item)}
          onWatch={() => handleContentAction('watch', item)}
          onListen={() => handleContentAction('listen', item)}
          onInteract={() => handleContentAction('interact', item)}
        />
      </div>

      {/* Thumbnail with overlay */}
      <div className="relative mb-4 rounded-lg overflow-hidden bg-slate-800/50">
        <div className="aspect-video flex items-center justify-center">
          <div className="text-slate-500 text-sm">Content Preview</div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Content Info */}
      <div className="space-y-2">
        <h4 className="font-semibold text-white group-hover:text-rose-400 transition-colors">
          {item.content.title}
        </h4>
        <p className="text-sm text-slate-400 line-clamp-2">
          {item.content.description}
        </p>
        
        {/* Metadata */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {item.status}
            </Badge>
            {type === 'campaign' && (
              <span className="text-xs text-slate-500">{item.phase}</span>
            )}
          </div>
          
          {/* Smart Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="w-6 h-6 rounded bg-black/40 backdrop-blur-sm flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              title="Share"
              onClick={(e) => { e.stopPropagation(); handleContentAction('share', item); }}
            >
              <Share className="w-3 h-3" />
            </button>
            <button
              className="w-6 h-6 rounded bg-black/40 backdrop-blur-sm flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Save"
              onClick={(e) => { e.stopPropagation(); handleContentAction('save', item); }}
            >
              <Heart className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Glass Header */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <TrendingUp className="w-8 h-8" />
              Aigent Marketa
            </h1>
            <p className="text-slate-300">
              Multi-tenant marketing automation with SmartContent integration
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Glass Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Active Campaigns</h3>
            <Target className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{campaigns.filter(c => c.status === 'active').length}</div>
            <p className="text-xs text-slate-500">+2 from last month</p>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Total Partners</h3>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{partners.length}</div>
            <p className="text-xs text-slate-500">+1 pending approval</p>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Audience Reach</h3>
            <Eye className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {campaigns.reduce((sum, c) => sum + c.targetAudience, 0).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500">Across all campaigns</p>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Total Budget</h3>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              ${campaigns.reduce((sum, c) => sum + c.budget, 0).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500">Q1 2024 allocation</p>
          </div>
        </GlassCard>
      </div>

      {/* Glass Tabs */}
      <GlassCard className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 bg-slate-800/50 border border-white/10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="campaign-mgmt" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Campaign Manager
            </TabsTrigger>
            <TabsTrigger value="partners" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Partners
            </TabsTrigger>
            <TabsTrigger value="qubetalk" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              QubeTalk
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Recent Campaigns</h3>
                <div className="space-y-4">
                  {campaigns.slice(0, 2).map((campaign) => (
                    <ContentCard key={campaign.id} item={campaign} type="campaign" />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Partner Activity</h3>
                <div className="space-y-4">
                  {partners.slice(0, 2).map((partner) => (
                    <ContentCard key={partner.id} item={partner} type="partner" />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((campaign) => (
                <ContentCard key={campaign.id} item={campaign} type="campaign" />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="campaign-mgmt" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Campaign Management Hub */}
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-rose-400" />
                  Campaign Manager
                </h3>
                <p className="text-slate-300 text-sm mb-6">
                  Create and manage multi-tenant campaigns with SmartContent integration
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full bg-rose-500 hover:bg-rose-600 text-white">
                    <Link href="/marketa/campaigns">
                      <Target className="w-4 h-4 mr-2" />
                      Manage Campaigns
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
                    <Link href="/marketa/assets">
                      <Database className="w-4 h-4 mr-2" />
                      Browse Assets
                    </Link>
                  </Button>
                </div>
              </GlassCard>

              {/* 21 Awakenings Campaign */}
              <GlassCard className="p-6 border-rose-500/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-purple-400" />
                  21 Awakenings
                </h3>
                <Badge className="mb-4 bg-purple-100 text-purple-800 border-purple-200">
                  Sequence Campaign
                </Badge>
                <p className="text-slate-300 text-sm mb-6">
                  21-day consciousness expansion journey featuring Qriptopian Shard content
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Duration:</span>
                    <span className="text-white">21 days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Content Type:</span>
                    <span className="text-white">Video & Articles</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Status:</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">Ready</Badge>
                  </div>
                  <Button asChild className="w-full bg-purple-500 hover:bg-purple-600 text-white mt-4">
                    <Link href="/marketa/campaigns">
                      <Eye className="w-4 h-4 mr-2" />
                      View Campaign
                    </Link>
                  </Button>
                </div>
              </GlassCard>

              {/* Asset Catalog */}
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  Asset Catalog
                </h3>
                <p className="text-slate-300 text-sm mb-6">
                  Browse QubeBase content assets for campaign creation
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Qriptopian:</span>
                    <span className="text-white">2 assets</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">metaKnyts:</span>
                    <span className="text-white">15 assets</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Codex:</span>
                    <span className="text-white">8 assets</span>
                  </div>
                  <Button asChild variant="outline" className="w-full bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
                    <Link href="/marketa/assets">
                      <Search className="w-4 h-4 mr-2" />
                      Browse All Assets
                    </Link>
                  </Button>
                </div>
              </GlassCard>
            </div>

            {/* Quick Actions */}
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button asChild className="bg-rose-500 hover:bg-rose-600 text-white">
                  <Link href="/marketa/campaigns">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Campaign
                  </Link>
                </Button>
                <Button asChild variant="outline" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
                  <Link href="/marketa/assets">
                    <Database className="w-4 h-4 mr-2" />
                    Browse Assets
                  </Link>
                </Button>
                <Button asChild variant="outline" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
                  <Link href="/marketa/campaigns">
                    <Users className="w-4 h-4 mr-2" />
                    View Partners
                  </Link>
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="partners" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners.map((partner) => (
                <ContentCard key={partner.id} item={partner} type="partner" />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="qubetalk" className="space-y-4 mt-6">
            <MarketaQubeTalk />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Campaign Performance</h3>
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                  <p className="text-slate-400">Analytics dashboard coming soon</p>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Audience Insights</h3>
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                  <p className="text-slate-400">Audience analytics coming soon</p>
                </div>
              </GlassCard>
            </div>
          </TabsContent>
        </Tabs>
      </GlassCard>
    </div>
  );
}
