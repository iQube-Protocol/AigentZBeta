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

const BRIDGE_ENDPOINT = '/api/marketa/lvb/bridge-enhanced';
const BRIDGE_HEADERS = {
  'x-persona-id': 'test-persona-admin',
  'x-tenant-id': 'agq-tenant',
  'x-dev-override': 'true'
};
const AWAKENINGS_CAMPAIGN_ID = '21-awakenings-campaign';
const PLACEHOLDER_THUMBNAIL = '/api/placeholder/300/200';

interface CampaignCard {
  id: string;
  name: string;
  description?: string;
  phase?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  targetAudience?: number;
  channels?: string[];
  content: {
    modalities: ContentModalityState;
    title: string;
    description: string;
    thumbnail: string;
  };
  extra?: Record<string, any>;
}

const staticPartners: CampaignCard[] = [
  {
    id: '1',
    name: 'TechCorp Solutions',
    phase: 'strategic',
    status: 'active',
    description: 'Strategic technology partner with integrated solutions',
    content: {
      modalities: { read: true, watch: true, listen: false, interact: false },
      title: 'TechCorp Partnership Profile',
      description: 'Strategic technology partner with integrated solutions',
      thumbnail: '/api/placeholder/300/200'
    },
    channels: ['email', 'web']
  },
  {
    id: '2',
    name: 'Growth Partners LLC',
    phase: 'affiliate',
    status: 'pending',
    description: 'Affiliate partnership program details and requirements',
    content: {
      modalities: { read: true, watch: false, listen: false, interact: true },
      title: 'Growth Partners Onboarding',
      description: 'Affiliate partnership program details and requirements',
      thumbnail: '/api/placeholder/300/200'
    },
    channels: ['social']
  }
];

const ensureNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const buildContentModalities = (campaignType = 'sequence', hasSequence = false): ContentModalityState => ({
  read: true,
  watch: campaignType === 'sequence' || hasSequence || campaignType === 'video',
  listen: campaignType === 'audio',
  interact: campaignType === 'custom'
});

const normalizeJoinedCampaign = (joined: any): CampaignCard => {
  const campaign = joined.marketa_campaigns || {};
  const sequenceItems = Array.isArray(campaign.marketa_sequence_items) ? campaign.marketa_sequence_items : [];
  const thumbnail = sequenceItems[0]?.thumbnail_url || campaign.metadata?.thumbnail_url || PLACEHOLDER_THUMBNAIL;

  return {
    id: campaign.id || joined.campaign_id || `joined-${Math.random().toString(36).slice(2)}`,
    name: campaign.name || 'Partner campaign',
    description: sequenceItems[0]?.description || campaign.description || '',
    phase: campaign.campaign_type || 'sequence',
    status: joined.status || campaign.status || 'active',
    startDate: joined.start_date || '',
    endDate: campaign.metadata?.end_date || '',
    budget: ensureNumber(campaign.metadata?.budget),
    targetAudience: ensureNumber(campaign.metadata?.estimated_reach),
    channels: Array.isArray(joined.channels) ? joined.channels : [],
    content: {
      modalities: buildContentModalities(campaign.campaign_type, sequenceItems.length > 0),
      title: sequenceItems[0]?.title || campaign.name || 'Live campaign',
      description: sequenceItems[0]?.description || campaign.description || '',
      thumbnail
    },
    extra: {
      sequenceItems,
      tenantConfig: joined
    }
  };
};

const normalizeAvailableCampaign = (campaign: any): CampaignCard => {
  const multiTenant = Array.isArray(campaign.marketa_multi_tenant_campaigns)
    ? campaign.marketa_multi_tenant_campaigns[0]
    : campaign.marketa_multi_tenant_campaigns;
  const deploymentConfig = multiTenant?.deployment_config || {};
  const thumbnail = campaign.metadata?.thumbnail_url || multiTenant?.thumbnail_url || PLACEHOLDER_THUMBNAIL;

  return {
    id: campaign.id || `available-${Math.random().toString(36).slice(2)}`,
    name: campaign.name || 'Partner opportunity',
    description: campaign.description || '',
    phase: campaign.campaign_type || 'sequence',
    status: campaign.status || 'active',
    startDate: campaign.metadata?.start_date || '',
    endDate: campaign.metadata?.end_date || '',
    budget: ensureNumber(campaign.metadata?.budget),
    targetAudience: ensureNumber(campaign.metadata?.estimated_reach),
    channels: Array.isArray(deploymentConfig.default_channels)
      ? deploymentConfig.default_channels
      : Array.isArray(multiTenant?.participating_tenants)
        ? multiTenant?.participating_tenants
        : [],
    content: {
      modalities: buildContentModalities(campaign.campaign_type, false),
      title: campaign.name || 'Live campaign',
      description: campaign.description || '',
      thumbnail
    },
    extra: {
      multiTenant,
      deploymentConfig
    }
  };
};

type CampaignCatalogPayload = {
  joined_campaigns?: unknown[];
  available_campaigns?: unknown[];
};

const normalizeCampaignList = (payload: CampaignCatalogPayload | null | undefined): CampaignCard[] => {
  const joinedCampaigns = Array.isArray(payload?.joined_campaigns) ? payload.joined_campaigns : [];
  const availableCampaigns = Array.isArray(payload?.available_campaigns) ? payload.available_campaigns : [];

  const joinedNormalized: CampaignCard[] = joinedCampaigns.map((joined) => normalizeJoinedCampaign(joined));
  const availableNormalized: CampaignCard[] = availableCampaigns
    .map((available) => normalizeAvailableCampaign(available))
    .filter((available: CampaignCard) => !joinedNormalized.some((joined: CampaignCard) => joined.id === available.id));

  return [...joinedNormalized, ...availableNormalized];
};

// Glass effect styling classes
const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";
const ROSE_GLOW = "shadow-rose-500/20 shadow-lg hover:shadow-rose-500/30";

export default function MarketaPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<CampaignCard[]>([]);
  const [partners] = useState(staticPartners);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [awakeningsCampaign, setAwakeningsCampaign] = useState<any>(null);
  const [awakeningsLoading, setAwakeningsLoading] = useState(true);
  const [awakeningsError, setAwakeningsError] = useState<string | null>(null);

  const loadCampaigns = async () => {
    setCampaignsError(null);
    setCampaignsLoading(true);

    try {
      const params = new URLSearchParams({ action: 'campaign_catalog' });
      const response = await fetch(`${BRIDGE_ENDPOINT}?${params.toString()}`, {
        headers: BRIDGE_HEADERS
      });

      if (!response.ok) {
        throw new Error(`Bridge catalog failed (${response.status})`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unable to fetch campaign catalog');
      }

      const normalized = normalizeCampaignList(data);
      setCampaigns(normalized);
    } catch (error: any) {
      console.error('Failed to load campaigns', error);
      setCampaignsError(error?.message || 'Unable to load campaigns');
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadAwakeningsDetail = async () => {
    setAwakeningsError(null);
    setAwakeningsLoading(true);

    try {
      const response = await fetch(BRIDGE_ENDPOINT, {
        method: 'POST',
        headers: {
          ...BRIDGE_HEADERS,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'campaign_detail', campaignId: AWAKENINGS_CAMPAIGN_ID })
      });

      if (!response.ok) {
        throw new Error(`Bridge detail failed (${response.status})`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Unable to fetch campaign detail');
      }

      setAwakeningsCampaign(data.campaign);
    } catch (error: any) {
      console.error('Failed to load 21 Awakenings details', error);
      setAwakeningsError(error?.message || 'Unable to load 21 Awakenings');
    } finally {
      setAwakeningsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadAwakeningsDetail();
  }, []);

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

  const activeCampaignsCount = campaigns.filter((campaign) => campaign.status === 'active').length;
  const totalAudienceReach = campaigns.reduce((sum, campaign) => sum + (campaign.targetAudience || 0), 0);
  const totalBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget || 0), 0);

  const awakeningsSequenceItems = Array.isArray(awakeningsCampaign?.marketa_sequence_items)
    ? awakeningsCampaign.marketa_sequence_items
    : [];
  const awakeningsTenantConfig = Array.isArray(awakeningsCampaign?.marketa_tenant_campaign_configs)
    ? awakeningsCampaign.marketa_tenant_campaign_configs[0]
    : awakeningsCampaign?.marketa_tenant_campaign_configs;
  const awakeningsCurrentDay = awakeningsTenantConfig?.current_day ?? 0;
  const totalSequenceDays = awakeningsCampaign?.sequence_length
    ?? (awakeningsSequenceItems.length > 0 ? awakeningsSequenceItems.length : 21);
  const awakeningsProgress = totalSequenceDays > 0
    ? Math.min(100, Math.round((awakeningsCurrentDay / totalSequenceDays) * 100))
    : 0;
  const nextDayNumber = Math.min(awakeningsCurrentDay + 1, totalSequenceDays);
  const nextSequenceItem = awakeningsSequenceItems.find((item: any) => item.day_number === nextDayNumber);
  const awakeningsStatus = awakeningsTenantConfig?.status || awakeningsCampaign?.status || 'ready';
  const awakeningsChannels = Array.isArray(awakeningsTenantConfig?.channels)
    ? awakeningsTenantConfig.channels.join(', ')
    : 'TBD';
  const awakeningsStartDate = awakeningsTenantConfig?.start_date
    ?? awakeningsCampaign?.metadata?.start_date
    ?? 'TBD';

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
            <div className="text-2xl font-bold text-white">{activeCampaignsCount}</div>
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
              {totalAudienceReach.toLocaleString()}
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
              ${totalBudget.toLocaleString()}
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
            {campaignsLoading ? (
              <GlassCard className="p-6 text-center">
                <p className="text-sm text-slate-400">Syncing live campaigns from Marketa bridge...</p>
              </GlassCard>
            ) : campaignsError ? (
              <GlassCard className="p-6 text-center bg-rose-950/30 border border-rose-400/20">
                <p className="text-sm text-rose-300">{campaignsError}</p>
              </GlassCard>
            ) : campaigns.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <p className="text-sm text-slate-400">No campaigns available for this tenant yet.</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map((campaign) => (
                  <ContentCard key={campaign.id} item={campaign} type="campaign" />
                ))}
              </div>
            )}
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
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Play className="w-5 h-5 text-purple-400" />
                    21 Awakenings
                  </h3>
                  <Badge className="mb-1 bg-purple-100 text-purple-800 border-purple-200 text-xs">
                    Sequence Campaign
                  </Badge>
                </div>
                <p className="text-slate-300 text-sm mb-4">
                  {awakeningsCampaign?.description ||
                    '21-day consciousness expansion journey featuring Qriptopian Shard content'}
                </p>
                {awakeningsLoading ? (
                  <p className="text-xs text-slate-400 mb-4">Syncing details from the thin client bridge…</p>
                ) : awakeningsError ? (
                  <p className="text-xs text-rose-400 mb-4">{awakeningsError}</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Start date:</span>
                      <span className="text-white">{awakeningsStartDate}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Duration:</span>
                      <span className="text-white">{totalSequenceDays} days</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Current day:</span>
                      <span className="text-white">
                        {awakeningsCurrentDay} / {totalSequenceDays}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Next shard:</span>
                      <span className="text-white">{nextSequenceItem?.title || 'Pending release'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Channels:</span>
                      <span className="text-white">{awakeningsChannels}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-[width] duration-300"
                        style={{ width: `${awakeningsProgress}%` }}
                      />
                    </div>
                    <div className="space-y-2 text-xs">
                      {awakeningsSequenceItems.slice(0, 3).map((item: any) => (
                        <div
                          key={`shard-${item.day_number}`}
                          className="flex justify-between text-slate-400"
                        >
                          <span>Day {item.day_number}</span>
                          <span className="text-white line-clamp-1">{item.title}</span>
                        </div>
                      ))}
                      {!awakeningsSequenceItems.length && (
                        <p className="text-slate-500">
                          Sequence details will populate once the campaign is active.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge
                    className={`text-xs ${
                      awakeningsStatus === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {awakeningsStatus === 'active' ? 'Live sequence' : awakeningsStatus}
                  </Badge>
                  <span className="text-xs text-slate-500">Awakenings partner bridge</span>
                </div>
                <Button asChild className="w-full bg-purple-500 hover:bg-purple-600 text-white mt-4">
                  <Link href="/marketa/campaigns">
                    <Eye className="w-4 h-4 mr-2" />
                    View Campaign
                  </Link>
                </Button>
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
