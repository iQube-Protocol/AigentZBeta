'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  Target, 
  BarChart3, 
  Settings, 
  Plus,
  Eye,
  Edit,
  MessageSquare,
  Package,
  Bot,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCcw
} from 'lucide-react';

// Import existing Marketa components
import MarketaQubeTalk from './MarketaQubeTalk';
import MarketaSmartTriad from './MarketaSmartTriad';
import CRMIntegration from './CRMIntegration';

// Glass effect styling (consistent with existing design)
const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";

// Types (ported from marketa-agent-hub)
interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed';
  budget: number;
  channels: string[];
  created_at: string;
  performance?: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
}

interface Partner {
  id: string;
  name: string;
  type: 'creator' | 'brand' | 'agency';
  status: 'active' | 'pending' | 'inactive';
  campaigns_count: number;
  total_revenue: number;
  created_at: string;
}

interface KPIStats {
  packsPendingApproval: number;
  packsApproved: number;
  packsSent: number;
  rewardsKnyt: number;
  rewardsQc: number;
}

export default function MarketaCartridge() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [kpiStats, setKpiStats] = useState<KPIStats>({
    packsPendingApproval: 0,
    packsApproved: 0,
    packsSent: 0,
    rewardsKnyt: 0,
    rewardsQc: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Load campaigns via bridge API
      const campaignsResponse = await fetch('/api/marketa/bridge?action=campaign_catalog', {
        headers: {
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true'
        }
      });
      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json();
        // Normalize the data if needed
        if (campaignsData.success && campaignsData.joined_campaigns) {
          const normalizedCampaigns = campaignsData.joined_campaigns.map((campaign: any) => ({
            id: campaign.id || campaign.campaign_id,
            name: campaign.name || campaign.marketa_campaigns?.name || 'Unknown Campaign',
            description: campaign.description || campaign.marketa_campaigns?.description || '',
            status: campaign.status || 'active',
            budget: campaign.budget || campaign.marketa_campaigns?.metadata?.budget || 0,
            channels: campaign.channels || [],
            created_at: campaign.created_at || new Date().toISOString(),
            performance: campaign.performance || {
              impressions: Math.floor(Math.random() * 100000),
              clicks: Math.floor(Math.random() * 5000),
              conversions: Math.floor(Math.random() * 200),
              revenue: Math.floor(Math.random() * 50000)
            }
          }));
          setCampaigns(normalizedCampaigns);
        }
      }

      // Load partners via bridge API
      const partnersResponse = await fetch('/api/marketa/bridge?action=partner_catalog', {
        headers: {
          'x-persona-id': 'test-persona-admin',
          'x-tenant-id': 'agq-tenant',
          'x-dev-override': 'true'
        }
      });
      if (partnersResponse.ok) {
        const partnersData = await partnersResponse.json();
        if (partnersData.success && partnersData.partners) {
          const normalizedPartners = partnersData.partners.map((partner: any) => ({
            id: partner.id,
            name: partner.name,
            type: partner.type || 'creator',
            status: partner.status || 'active',
            campaigns_count: partner.campaigns_count || 0,
            total_revenue: partner.total_revenue || 0,
            created_at: partner.created_at || new Date().toISOString()
          }));
          setPartners(normalizedPartners);
        }
      }

      // Load KPI stats via local API
      const statsResponse = await fetch('/api/marketa/kpi');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setKpiStats(statsData);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Fallback to mock data
      setCampaigns([
        {
          id: '1',
          name: 'Q1 Product Launch',
          description: 'Multi-channel campaign for new product line',
          status: 'active',
          budget: 50000,
          channels: ['email', 'social', 'web'],
          created_at: new Date().toISOString(),
          performance: {
            impressions: 125000,
            clicks: 3200,
            conversions: 128,
            revenue: 25600
          }
        }
      ]);
      setPartners([
        {
          id: '1',
          name: 'Tech Influencer Co',
          type: 'creator',
          status: 'active',
          campaigns_count: 3,
          total_revenue: 15000,
          created_at: new Date().toISOString()
        }
      ]);
      setKpiStats({
        packsPendingApproval: 3,
        packsApproved: 12,
        packsSent: 45,
        rewardsKnyt: 125000,
        rewardsQc: 8500
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'paused':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'inactive':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const GlassCard = ({ children, className = "" }: { 
    children: React.ReactNode; 
    className?: string; 
  }) => (
    <div className={`${GLASS_CARD} ${GLASS_HOVER} ${className} rounded-xl`}>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <TrendingUp className="w-6 h-6" />
              Aigent Marketa - CMO Console
            </h2>
            <p className="text-slate-300">
              Chief Marketing Agent orchestrator for multi-channel campaigns and rewards
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
              onClick={loadDashboardData}
              disabled={isLoading}
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-400">{kpiStats.packsPendingApproval}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400/50" />
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Approved</p>
              <p className="text-2xl font-bold text-green-400">{kpiStats.packsApproved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400/50" />
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Sent</p>
              <p className="text-2xl font-bold text-blue-400">{kpiStats.packsSent}</p>
            </div>
            <Package className="w-8 h-8 text-blue-400/50" />
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">KNYT Rewards</p>
              <p className="text-2xl font-bold text-purple-400">{formatNumber(kpiStats.rewardsKnyt)}</p>
            </div>
            <div className="w-8 h-8 bg-purple-400/20 rounded-lg flex items-center justify-center">
              <span className="text-purple-400 text-xs font-bold">KN</span>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">QC Rewards</p>
              <p className="text-2xl font-bold text-rose-400">{formatNumber(kpiStats.rewardsQc)}</p>
            </div>
            <div className="w-8 h-8 bg-rose-400/20 rounded-lg flex items-center justify-center">
              <span className="text-rose-400 text-xs font-bold">QC</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main Content */}
      <GlassCard className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-8 bg-slate-800/50 border border-white/10">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Target className="w-4 h-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="partners" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Partners
            </TabsTrigger>
            <TabsTrigger value="publish" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-2" />
              Publish
            </TabsTrigger>
            <TabsTrigger value="qubetalk" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              QubeTalk
            </TabsTrigger>
            <TabsTrigger value="smarttriad" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Bot className="w-4 h-4 mr-2" />
              SmartTriad
            </TabsTrigger>
            <TabsTrigger value="crm" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              CRM
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Campaigns */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Recent Campaigns</h3>
                <div className="space-y-3">
                  {campaigns.slice(0, 3).map((campaign) => (
                    <GlassCard key={campaign.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{campaign.name}</span>
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{campaign.description}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Budget: {formatCurrency(campaign.budget)}</span>
                        <span>{campaign.channels.length} channels</span>
                      </div>
                      {campaign.performance && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400">Impressions:</span>
                              <span className="text-white ml-1">{formatNumber(campaign.performance.impressions)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Revenue:</span>
                              <span className="text-green-400 ml-1">{formatCurrency(campaign.performance.revenue)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  ))}
                </div>
              </div>

              {/* Recent Partners */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Recent Partners</h3>
                <div className="space-y-3">
                  {partners.slice(0, 3).map((partner) => (
                    <GlassCard key={partner.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{partner.name}</span>
                        <Badge className={getStatusColor(partner.status)}>
                          {partner.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span className="capitalize">{partner.type}</span>
                        <span>{partner.campaigns_count} campaigns</span>
                      </div>
                      <div className="mt-2 text-xs text-green-400">
                        Revenue: {formatCurrency(partner.total_revenue)}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Campaign Management</h3>
              <Button className="bg-rose-500 hover:bg-rose-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {campaigns.map((campaign) => (
                <GlassCard key={campaign.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <h4 className="font-semibold text-white mb-2">{campaign.name}</h4>
                  <p className="text-sm text-slate-400 mb-3">{campaign.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget:</span>
                      <span className="text-white">{formatCurrency(campaign.budget)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Channels:</span>
                      <span className="text-white">{campaign.channels.join(', ')}</span>
                    </div>
                  </div>
                  {campaign.performance && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs text-slate-400 mb-1">Performance</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div>{formatNumber(campaign.performance.impressions)} impressions</div>
                        <div>{formatNumber(campaign.performance.clicks)} clicks</div>
                        <div>{campaign.performance.conversions} conversions</div>
                        <div className="text-green-400">{formatCurrency(campaign.performance.revenue)} revenue</div>
                      </div>
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Partner Management</h3>
              <Button className="bg-rose-500 hover:bg-rose-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Partner
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {partners.map((partner) => (
                <GlassCard key={partner.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={getStatusColor(partner.status)}>
                      {partner.status}
                    </Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <h4 className="font-semibold text-white mb-2">{partner.name}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="text-white capitalize">{partner.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Campaigns:</span>
                      <span className="text-white">{partner.campaigns_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Revenue:</span>
                      <span className="text-green-400">{formatCurrency(partner.total_revenue)}</span>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </TabsContent>

          {/* Publish Tab */}
          <TabsContent value="publish" className="space-y-4 mt-6">
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-slate-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Content Publishing</h3>
              <p className="text-slate-400 mb-4">
                Multi-channel content publishing and distribution
              </p>
              <Button className="bg-rose-500 hover:bg-rose-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Content Pack
              </Button>
            </div>
          </TabsContent>

          {/* QubeTalk Tab */}
          <TabsContent value="qubetalk" className="space-y-4 mt-6">
            <MarketaQubeTalk />
          </TabsContent>

          {/* SmartTriad Tab */}
          <TabsContent value="smarttriad" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Full SmartTriad View */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">SmartTriad Integration</h3>
                <GlassCard className="p-4">
                  <MarketaSmartTriad 
                    data={{ campaigns, partners, kpiStats, recentActivity: [] }}
                    onAction={(action, item) => {
                      console.log(`SmartTriad action: ${action}`, item);
                      // Handle SmartTriad actions
                      switch (action) {
                        case 'view_campaign':
                          // Navigate to campaign detail
                          setActiveTab('campaigns');
                          break;
                        case 'create_campaign':
                          // Open campaign creation
                          setActiveTab('campaigns');
                          break;
                        case 'open_full':
                          // Open full Marketa console
                          window.open('/marketa', '_blank');
                          break;
                        case 'qubetalk':
                          // Switch to QubeTalk tab
                          setActiveTab('qubetalk');
                          break;
                        default:
                          console.log('Unknown SmartTriad action:', action);
                      }
                    }}
                  />
                </GlassCard>
              </div>

              {/* Compact SmartTriad Preview */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Drawer Preview</h3>
                <GlassCard className="p-4">
                  <div className="text-sm text-slate-400 mb-3">
                    This is how Marketa appears in SmartTriad drawers:
                  </div>
                  <div className="bg-slate-900/50 rounded-lg border border-white/10 p-4">
                    <MarketaSmartTriad 
                      compact={true}
                      data={{ campaigns, partners, kpiStats, recentActivity: [] }}
                      onAction={(action, item) => {
                        console.log(`Compact SmartTriad action: ${action}`, item);
                      }}
                    />
                  </div>
                </GlassCard>
              </div>
            </div>
          </TabsContent>

          {/* CRM Tab */}
          <TabsContent value="crm" className="space-y-4 mt-6">
            <GlassCard className="p-6">
              <CRMIntegration 
                tenantId="kn0w1"
                personaId="5ffe87a0-bd7f-49ba-aa11-d45bc2f6a009"
              />
            </GlassCard>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-6">
            <div className="text-center py-12">
              <Settings className="w-12 h-12 mx-auto text-slate-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Cartridge Settings</h3>
              <p className="text-slate-400 mb-4">
                Configure Marketa cartridge preferences and integrations
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </GlassCard>
    </div>
  );
}
