'use client';

/**
 * Campaign Detail Page
 * 
 * Shows detailed view of a Marketa campaign including:
 * - Overview
 * - Participants 
 * - Sequence (for sequence campaigns)
 * - Delivery logs
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  ExternalLink, 
  PlayCircle,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Target,
  TrendingUp,
  Eye,
  BarChart3
} from 'lucide-react';

// Marketa styling constants
const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";
const ROSE_GLOW = "shadow-rose-500/20 shadow-lg hover:shadow-rose-500/30";

const GlassCard = ({ children, className = "", hover = true }: { 
  children: React.ReactNode; 
  className?: string; 
  hover?: boolean;
}) => {
  const classes = `${GLASS_CARD} ${hover ? GLASS_HOVER : ""} ${className} rounded-xl`;
  return (
    <div className={classes}>
      {children}
    </div>
  );
};

interface Campaign {
  id: string;
  name: string;
  description: string;
  campaign_type: 'wpp' | 'custom' | 'sequence';
  phase: string;
  status: string;
  created_at: string;
  sequence_length?: number;
  helix_thread?: string;
  primary_cta?: string;
  metadata?: any;
}

interface Participant {
  id?: string;
  tenant_id: string;
  status: string;
  created_at?: string;
  joined_at: string;
  publishing_mode?: string;
  channels?: string[];
  make_webhook_present?: boolean;
  current_day?: number;
}

interface SequenceItem {
  id?: string;
  day_number: number;
  title: string;
  description: string;
  asset_ref: string;
  cta_url?: string;
  explainer?: boolean;
  thumbnail_url?: string;
  duration_seconds?: number;
  tags?: string[];
  status: string;
  // Resolved asset fields
  asset_title?: string;
  asset_description?: string;
  asset_app?: string;
  content_type?: string;
  resolved_thumbnail_url?: string;
  resolved_duration_seconds?: number;
  external_url?: string;
  modalities?: any;
  asset_status?: string;
}

interface DeliveryLog {
  id: string;
  tenant_id: string;
  platform: string;
  status: string;
  created_at: string;
  external_post_url?: string;
  metrics?: any;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sequenceItems, setSequenceItems] = useState<SequenceItem[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  useEffect(() => {
    if (id) {
      loadCampaignData();
    }
  }, [id]);

  const loadCampaignData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading campaign data for ID:', id);
      
      const response = await fetch(`/api/marketa/admin/campaigns?action=detail&campaignId=${id}`, {
        headers: {
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true', // Developer override
        },
      });

      const campaignData = await response.json();
      console.log('Campaign data response:', campaignData);
      if (campaignData.success) {
        setCampaign(campaignData.campaign);
        // Set sequence items from the campaign response
        if (campaignData.campaign.marketa_sequence_items) {
          const sortedItems = [...campaignData.campaign.marketa_sequence_items]
            .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
          setSequenceItems(sortedItems);
        }
      } else {
        console.error('Campaign API error:', campaignData);
      }

      // Load participants
      const participantsResponse = await fetch(
        `/api/marketa/admin/campaigns?action=participants&campaign_id=${id}`,
        {
          headers: {
            'x-persona-id': 'test-persona-admin',
            'x-tenant-id': 'agq-tenant',
            'x-dev-override': 'true', // Developer override
          },
        }
      );

      const participantsData = await participantsResponse.json();
      if (participantsData.success) {
        setParticipants(participantsData.participants || []);
      }

      // Load delivery logs
      const deliveryResponse = await fetch(
        `/api/marketa/admin/campaigns?action=delivery&campaign_id=${id}`,
        {
          headers: {
            'x-persona-id': 'test-persona-admin',
            'x-tenant-id': 'agq-tenant',
            'x-dev-override': 'true', // Developer override
          },
        }
      );

      const deliveryData = await deliveryResponse.json();
      if (deliveryData.success) {
        setDeliveryLogs(deliveryData.delivery_logs || []);
      }

    } catch (err) {
      setError('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const getCampaignTypeColor = (type: string) => {
    switch (type) {
      case 'sequence': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-blue-100 text-blue-800';
      case 'wpp': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeliveryStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const extractAssetId = (assetRef: string) => {
    const parts = assetRef.split(':');
    return parts.length > 1 ? parts[1] : assetRef;
  };

  const buildQriptopianUrl = (assetRef: string) => {
    const assetId = extractAssetId(assetRef);
    return `https://theqriptopian.netlify.app/article?id=${assetId}&type=video&title=Awakening&persona=d7b0738a-4080-4a4d-9b26-a214742c94aa&shareId=7f28023c-9ce3-4931-a041-5c445ca54a44&utm_source=marketa&utm_medium=email&utm_campaign=21-awakenings`;
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

  if (!campaign) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Campaign not found</h1>
          <Button asChild>
            <Link href="/marketa/campaigns">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaigns
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
              <Link href="/marketa/campaigns">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              <p className="text-slate-400">{campaign.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={getCampaignTypeColor(campaign.campaign_type)}>
              {campaign.campaign_type}
            </Badge>
            <Badge className={getStatusColor(campaign.status)}>
              {campaign.status}
            </Badge>
          </div>
        </div>
      </GlassCard>

      {/* Campaign Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Type</h3>
            <Target className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{campaign.campaign_type}</div>
            <p className="text-xs text-slate-500">
              {campaign.campaign_type === 'sequence' && `${campaign.sequence_length} days`}
            </p>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Status</h3>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{campaign.status}</div>
            <p className="text-xs text-slate-500">Phase: {campaign.phase}</p>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Participants</h3>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{participants.length}</div>
            <p className="text-xs text-slate-500">Active partners</p>
          </div>
        </GlassCard>
        
        <GlassCard className="p-4">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-slate-300">Created</h3>
            <Calendar className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {new Date(campaign.created_at).toLocaleDateString()}
            </div>
            <p className="text-xs text-slate-500">
              {new Date(campaign.created_at).toLocaleTimeString()}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Campaign Details */}
      <GlassCard className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-white/10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="participants" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Participants ({participants.length})
            </TabsTrigger>
            {campaign.campaign_type === 'sequence' && (
              <TabsTrigger value="sequence" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
                Sequence ({sequenceItems.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="delivery" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              Delivery ({deliveryLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Campaign Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Campaign Type:</span>
                    <Badge className={getCampaignTypeColor(campaign.campaign_type)}>
                      {campaign.campaign_type}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phase:</span>
                    <span className="text-white">{campaign.phase}</span>
                  </div>
                  {campaign.sequence_length && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="text-white">{campaign.sequence_length} days</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Timeline</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Created:</span>
                    <span className="text-white">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Created Time:</span>
                    <span className="text-white">
                      {new Date(campaign.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
              <p className="text-slate-300 leading-relaxed">
                {campaign.description}
              </p>
            </div>
          </TabsContent>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Campaign Participants</h3>
              <span className="text-sm text-slate-400">{participants.length} partners</span>
            </div>
            
            {participants.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Partner</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Joined</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant) => (
                      <TableRow key={participant.id} className="border-slate-700">
                        <TableCell className="text-white">{participant.tenant_id}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(participant.status)}>
                            {participant.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {participant.created_at
                            ? new Date(participant.created_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400">No participants have joined this campaign yet.</p>
              </div>
            )}
          </TabsContent>

          {/* Sequence Tab */}
          {campaign.campaign_type === 'sequence' && (
            <TabsContent value="sequence" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Campaign Sequence</h3>
                <span className="text-sm text-slate-400">{sequenceItems.length} items</span>
              </div>
              
              {sequenceItems.length > 0 ? (
                <div className="space-y-4">
                  {sequenceItems.map((item) => (
                    <GlassCard key={item.id} className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0">
                          {item.thumbnail_url ? (
                            <img 
                              src={item.thumbnail_url} 
                              alt={item.title}
                              className="w-24 h-16 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-24 h-16 bg-slate-700 rounded-lg flex items-center justify-center">
                              <Play className="h-6 w-6 text-slate-400" />
                            </div>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className="border-rose-500 text-rose-400">
                              Day {item.day_number}
                              {item.explainer && (
                                <span className="ml-1 text-xs">• Explainer</span>
                              )}
                            </Badge>
                            <h4 className="text-lg font-semibold text-white">{item.title}</h4>
                          </div>
                          <p className="text-slate-300 mb-3">{item.description}</p>
                          
                          {item.asset_ref && (
                            <div className="mb-3">
                              <span className="text-sm text-slate-400">Asset Reference:</span>
                              <code className="ml-2 px-2 py-1 bg-slate-800 rounded text-slate-300">
                                {item.asset_ref}
                              </code>
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="ml-2 text-rose-400 hover:text-rose-300"
                                onClick={() => window.open(buildQriptopianUrl(item.asset_ref), '_blank')}
                              >
                                View Asset
                              </Button>
                            </div>
                          )}
                          
                          {item.cta_url && (
                            <div className="mb-3">
                              <span className="text-sm text-slate-400">CTA URL:</span>
                              <a 
                                href={item.cta_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-2 text-rose-400 hover:text-rose-300 text-sm"
                              >
                                {item.cta_url}
                              </a>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            {item.duration_seconds && (
                              <span>Duration: {item.duration_seconds}s</span>
                            )}
                            {item.explainer && (
                              <Badge variant="outline" className="border-green-500 text-green-400">
                                Explainer
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400">No sequence items have been created for this campaign.</p>
                </div>
              )}
            </TabsContent>
          )}

          {/* Delivery Tab */}
          <TabsContent value="delivery" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Delivery Logs</h3>
              <span className="text-sm text-slate-400">{deliveryLogs.length} deliveries</span>
            </div>
            
            {deliveryLogs.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Platform</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Delivered</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryLogs.map((log) => (
                      <TableRow key={log.id} className="border-slate-700">
                        <TableCell className="text-white">{log.platform}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeliveryStatusIcon(log.status)}
                            <span className="text-white">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {new Date(log.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {log.external_post_url && (
                            <Button 
                              variant="link" 
                              size="sm"
                              onClick={() => window.open(log.external_post_url, '_blank')}
                            >
                              View Post
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400">No delivery logs available for this campaign.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </GlassCard>
    </div>
  );
}
