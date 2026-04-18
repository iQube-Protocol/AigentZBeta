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
  MessageSquare,
  Package,
  Bot,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCcw,
  Mail,
  ArrowRight,
  Zap,
} from 'lucide-react';

import MarketaQubeTalk from './MarketaQubeTalk';
import MarketaSmartTriad from './MarketaSmartTriad';
import CRMIntegration from './CRMIntegration';

const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPIStats {
  packsPendingApproval: number;
  packsApproved: number;
  packsSent: number;
  rewardsKnyt: number;
  rewardsQc: number;
}

interface KsProspectsCampaign {
  id: 'ks_prospects';
  name: string;
  description: string;
  status: string;
  cohort_size: number;
  active: number;
  suppressed: number;
  emails_sent: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  current_email: number;
  next_email: number;
  next_action: string;
  send_command: string;
}

interface KnytSubCohort {
  cohort: string;
  size: number;
  sent: number;
  unsent: number;
  opened: number;
  clicked: number;
  backed: number;
  open_rate: number;
  status: string;
}

interface KnytCampaign {
  id: 'knyt_codex';
  name: string;
  description: string;
  status: string;
  cohort_size: number;
  unassigned: number;
  sub_cohorts: KnytSubCohort[];
  next_action: string;
  send_command: string | null;
}

interface PartnerCampaign {
  id: 'knyt_partners';
  name: string;
  description: string;
  status: string;
  total: number;
  wave_1: { total: number; contacted: number; responded: number };
  wave_2: { total: number; contacted: number };
  next_action: string;
  send_command: null;
}

interface AvlPartner {
  id: string;
  name: string;
  org: string;
  wave: number;
  contact_email: string | null;
  contact_name: string | null;
  outreach_status: string;
  bd_stage: string;
  response_signal: string | null;
}

type LiveCampaign = KsProspectsCampaign | KnytCampaign | PartnerCampaign;

export default function MarketaCartridge() {
  const [activeTab, setActiveTab]           = useState('dashboard');
  const [liveCampaigns, setLiveCampaigns]   = useState<LiveCampaign[]>([]);
  const [avlPartners, setAvlPartners]       = useState<AvlPartner[]>([]);
  const [kpiStats, setKpiStats]             = useState<KPIStats>({
    packsPendingApproval: 0, packsApproved: 0, packsSent: 0, rewardsKnyt: 0, rewardsQc: 0,
  });
  const [isLoading, setIsLoading]           = useState(false);
  const [asOf, setAsOf]                     = useState<string | null>(null);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [campaignRes, partnerRes, kpiRes] = await Promise.all([
        fetch('/api/marketa/campaigns'),
        fetch('/api/avl/partners'),
        fetch('/api/marketa/kpi').catch(() => null),
      ]);
      if (campaignRes.ok) {
        const d = await campaignRes.json();
        if (d.ok) { setLiveCampaigns(d.campaigns); setAsOf(d.as_of); }
      }
      if (partnerRes.ok) {
        const d = await partnerRes.json();
        if (d.ok) setAvlPartners(d.data?.partners ?? []);
      }
      if (kpiRes?.ok) {
        const d = await kpiRes.json();
        setKpiStats(d);
      }
    } catch (error) {
      console.error('Failed to load Marketa data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Derived helpers
  const ksCampaign      = liveCampaigns.find((c) => c.id === 'ks_prospects') as KsProspectsCampaign | undefined;
  const knytCampaign    = liveCampaigns.find((c) => c.id === 'knyt_codex')   as KnytCampaign | undefined;
  const partnerCampaign = liveCampaigns.find((c) => c.id === 'knyt_partners') as PartnerCampaign | undefined;

  // Keep legacy props for SmartTriad (it expects old shape — leave unchanged)
  const legacyCampaigns = liveCampaigns.map((c) => ({
    id: c.id, name: c.name, description: c.description,
    status: c.status as 'active' | 'paused' | 'completed',
    budget: 0, channels: ['email'], created_at: new Date().toISOString(),
  }));

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
            {asOf && <p className="text-[10px] text-slate-600">Live data as of {new Date(asOf).toLocaleTimeString()}</p>}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* KS Prospects summary */}
              {ksCampaign && (
                <GlassCard className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-white text-sm">{ksCampaign.name}</span>
                    <Badge className={getStatusColor(ksCampaign.status)}>{ksCampaign.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center text-xs pt-1">
                    <div><p className="text-lg font-bold text-amber-300">{ksCampaign.emails_sent.toLocaleString()}</p><p className="text-slate-500">sent</p></div>
                    <div><p className="text-lg font-bold text-sky-300">{ksCampaign.open_rate}%</p><p className="text-slate-500">open rate</p></div>
                    <div><p className="text-lg font-bold text-emerald-300">{ksCampaign.click_rate}%</p><p className="text-slate-500">click rate</p></div>
                  </div>
                  <p className="text-[10px] text-amber-400/80 border-t border-white/10 pt-2">{ksCampaign.next_action}</p>
                </GlassCard>
              )}
              {/* KNYT Codex summary */}
              {knytCampaign && (
                <GlassCard className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-rose-400" />
                    <span className="font-semibold text-white text-sm">{knytCampaign.name}</span>
                  </div>
                  <div className="space-y-1">
                    {knytCampaign.sub_cohorts.map((sc) => (
                      <div key={sc.cohort} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 capitalize">{sc.cohort.replace('_', ' ')}</span>
                        <span className={sc.status === 'pending' ? 'text-slate-500' : sc.status === 'complete' ? 'text-emerald-400' : 'text-amber-300'}>
                          {sc.sent}/{sc.size} sent
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-400/80 border-t border-white/10 pt-2">{knytCampaign.next_action}</p>
                </GlassCard>
              )}
              {/* Partners summary */}
              {partnerCampaign && (
                <GlassCard className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-400" />
                    <span className="font-semibold text-white text-sm">{partnerCampaign.name}</span>
                    <Badge className="bg-slate-700/50 text-slate-400 border-slate-600">pending</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-center pt-1">
                    <div><p className="text-lg font-bold text-violet-300">{partnerCampaign.wave_1.contacted}</p><p className="text-slate-500">Wave 1 contacted</p></div>
                    <div><p className="text-lg font-bold text-violet-300">{partnerCampaign.wave_1.responded}</p><p className="text-slate-500">responded</p></div>
                  </div>
                  <p className="text-[10px] text-amber-400/80 border-t border-white/10 pt-2">{partnerCampaign.next_action}</p>
                </GlassCard>
              )}
            </div>
          </TabsContent>

          {/* Campaigns Tab — live three-campaign command view */}
          <TabsContent value="campaigns" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Campaign Command Centre</h3>
                {asOf && <p className="text-[10px] text-slate-500 mt-0.5">Live · {new Date(asOf).toLocaleString()}</p>}
              </div>
            </div>

            {/* KS Prospects */}
            {ksCampaign && (
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="font-semibold text-white">{ksCampaign.name}</h4>
                      <p className="text-xs text-slate-400">{ksCampaign.description}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(ksCampaign.status)}>{ksCampaign.status}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: ksCampaign.cohort_size.toLocaleString(), color: 'text-white' },
                    { label: 'Active', value: ksCampaign.active.toLocaleString(), color: 'text-amber-300' },
                    { label: 'Open rate', value: `${ksCampaign.open_rate}%`, color: 'text-sky-300' },
                    { label: 'Click rate', value: `${ksCampaign.click_rate}%`, color: 'text-emerald-300' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-slate-900/60 p-3 text-center">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-amber-300">Next: Email {ksCampaign.next_email}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{ksCampaign.send_command}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
              </GlassCard>
            )}

            {/* KNYT Codex */}
            {knytCampaign && (
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-rose-400" />
                    <div>
                      <h4 className="font-semibold text-white">{knytCampaign.name}</h4>
                      <p className="text-xs text-slate-400">{knytCampaign.description}</p>
                    </div>
                  </div>
                  {knytCampaign.unassigned > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                      {knytCampaign.unassigned} unassigned
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {knytCampaign.sub_cohorts.map((sc) => (
                    <div key={sc.cohort} className="rounded-lg bg-slate-900/60 p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-200 capitalize">{sc.cohort.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-500">{sc.sent}/{sc.size}</span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-800">
                          <div className={`h-full rounded-full ${sc.status === 'complete' ? 'bg-emerald-500' : sc.status === 'partial' ? 'bg-amber-500' : 'bg-slate-700'}`}
                            style={{ width: sc.size > 0 ? `${Math.round((sc.sent / sc.size) * 100)}%` : '0%' }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {sc.backed > 0 && <p className="text-[10px] text-emerald-400">{sc.backed} backed</p>}
                        {sc.open_rate > 0 && <p className="text-[10px] text-sky-400">{sc.open_rate}% open</p>}
                      </div>
                      <Badge className={sc.status === 'pending' ? 'bg-slate-700/50 text-slate-400 border-slate-600 text-[9px]' : sc.status === 'complete' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px]' : 'bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px]'}>
                        {sc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                {knytCampaign.send_command && (
                  <div className="flex items-center justify-between rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-rose-300">{knytCampaign.next_action}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{knytCampaign.send_command}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-rose-400 shrink-0" />
                  </div>
                )}
              </GlassCard>
            )}

            {/* Partners */}
            {partnerCampaign && (
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-violet-400" />
                    <div>
                      <h4 className="font-semibold text-white">{partnerCampaign.name}</h4>
                      <p className="text-xs text-slate-400">{partnerCampaign.description}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Wave 1 total', value: partnerCampaign.wave_1.total },
                    { label: 'Wave 1 contacted', value: partnerCampaign.wave_1.contacted },
                    { label: 'Wave 1 responded', value: partnerCampaign.wave_1.responded },
                    { label: 'Wave 2 total', value: partnerCampaign.wave_2.total },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-slate-900/60 p-3 text-center">
                      <p className="text-xl font-bold text-violet-300">{value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-4 py-2.5">
                  <p className="text-xs font-semibold text-violet-300">{partnerCampaign.next_action}</p>
                </div>
              </GlassCard>
            )}
          </TabsContent>

          {/* Partners Tab — live AVL partner list */}
          <TabsContent value="partners" className="space-y-4 mt-6">
            <h3 className="text-lg font-semibold text-white">AVL Partners — Wave Activation</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {avlPartners.map((partner) => (
                <GlassCard key={partner.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{partner.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{partner.org}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge className="text-[9px] bg-violet-500/10 text-violet-300 border-violet-500/20">Wave {partner.wave}</Badge>
                      <Badge className={`text-[9px] ${partner.outreach_status === 'pending' ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                        {partner.outreach_status}
                      </Badge>
                    </div>
                  </div>
                  {partner.contact_email && (
                    <p className="text-[10px] text-slate-500 truncate">{partner.contact_name ? `${partner.contact_name} · ` : ''}{partner.contact_email}</p>
                  )}
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
                    data={{ campaigns: legacyCampaigns, partners: avlPartners, kpiStats, recentActivity: [] }}
                    onAction={(action) => {
                      switch (action) {
                        case 'view_campaign':
                        case 'create_campaign':
                          setActiveTab('campaigns');
                          break;
                        case 'open_full':
                          window.open('/marketa', '_blank');
                          break;
                        case 'qubetalk':
                          setActiveTab('qubetalk');
                          break;
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
                      data={{ campaigns: legacyCampaigns, partners: avlPartners, kpiStats, recentActivity: [] }}
                      onAction={() => {}}
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
