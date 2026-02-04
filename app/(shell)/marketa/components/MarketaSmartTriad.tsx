'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
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
  ArrowRight
} from 'lucide-react';

// Types for SmartTriad integration
interface MarketaDrawerData {
  campaigns: any[];
  partners: any[];
  kpiStats: any;
  recentActivity: any[];
}

interface MarketaSmartTriadProps {
  data?: MarketaDrawerData;
  onAction?: (action: string, item: any) => void;
  compact?: boolean;
}

export default function MarketaSmartTriad({ data, onAction, compact = false }: MarketaSmartTriadProps) {
  const mockData: MarketaDrawerData = data || {
    campaigns: [
      {
        id: '1',
        name: 'Q1 Product Launch',
        status: 'active',
        budget: 50000,
        performance: { revenue: 25600 }
      }
    ],
    partners: [
      {
        id: '1',
        name: 'Tech Influencer Co',
        type: 'creator',
        status: 'active',
        campaigns_count: 3
      }
    ],
    kpiStats: {
      packsPendingApproval: 3,
      packsApproved: 12,
      packsSent: 45,
      rewardsKnyt: 125000,
      rewardsQc: 8500
    },
    recentActivity: [
      {
        type: 'campaign_created',
        message: 'New campaign "Q1 Product Launch" created',
        timestamp: new Date().toISOString()
      }
    ]
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

  const handleAction = (action: string, item: any) => {
    if (onAction) {
      onAction(action, item);
    } else {
      console.log(`Marketa SmartTriad action: ${action}`, item);
    }
  };

  if (compact) {
    // Compact view for drawer integration
    return (
      <div className="space-y-4 p-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Active Campaigns</p>
                <p className="text-lg font-bold text-rose-400">{mockData.campaigns.filter(c => c.status === 'active').length}</p>
              </div>
              <Target className="w-5 h-5 text-rose-400/50" />
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Active Partners</p>
                <p className="text-lg font-bold text-green-400">{mockData.partners.filter(p => p.status === 'active').length}</p>
              </div>
              <Users className="w-5 h-5 text-green-400/50" />
            </div>
          </div>
        </div>

        {/* Recent Campaigns */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Recent Campaigns
          </h4>
          <div className="space-y-2">
            {mockData.campaigns.slice(0, 2).map((campaign) => (
              <div key={campaign.id} className="bg-slate-800/30 rounded-lg p-2 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium">{campaign.name}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0"
                    onClick={() => handleAction('view_campaign', campaign)}
                  >
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                    {campaign.status}
                  </Badge>
                  <span className="text-xs text-slate-400">{formatCurrency(campaign.budget)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs"
            onClick={() => handleAction('create_campaign', null)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Campaign
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50 text-xs"
            onClick={() => handleAction('view_all', null)}
          >
            <Eye className="w-3 h-3 mr-1" />
            View All
          </Button>
        </div>
      </div>
    );
  }

  // Full view for standalone integration
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-rose-400 mb-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Marketa SmartTriad
          </h3>
          <p className="text-slate-400 text-sm">Marketing automation and campaign management</p>
        </div>
        <Button 
          className="bg-rose-500 hover:bg-rose-600 text-white"
          onClick={() => handleAction('open_full', null)}
        >
          <Package className="w-4 h-4 mr-2" />
          Open Full Console
        </Button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Pending</p>
              <p className="text-lg font-bold text-yellow-400">{mockData.kpiStats.packsPendingApproval}</p>
            </div>
            <div className="w-6 h-6 bg-yellow-400/20 rounded flex items-center justify-center">
              <span className="text-yellow-400 text-xs">!</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Approved</p>
              <p className="text-lg font-bold text-green-400">{mockData.kpiStats.packsApproved}</p>
            </div>
            <div className="w-6 h-6 bg-green-400/20 rounded flex items-center justify-center">
              <span className="text-green-400 text-xs">✓</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">KNYT</p>
              <p className="text-lg font-bold text-purple-400">{formatNumber(mockData.kpiStats.rewardsKnyt)}</p>
            </div>
            <div className="w-6 h-6 bg-purple-400/20 rounded flex items-center justify-center">
              <span className="text-purple-400 text-xs">KN</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">QC</p>
              <p className="text-lg font-bold text-rose-400">{formatNumber(mockData.kpiStats.rewardsQc)}</p>
            </div>
            <div className="w-6 h-6 bg-rose-400/20 rounded flex items-center justify-center">
              <span className="text-rose-400 text-xs">QC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Recent Activity
        </h4>
        <div className="space-y-2">
          {mockData.recentActivity.slice(0, 3).map((activity, index) => (
            <div key={index} className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
              <p className="text-sm text-slate-300">{activity.message}</p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(activity.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          className="bg-rose-500 hover:bg-rose-600 text-white"
          onClick={() => handleAction('create_campaign', null)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
        <Button 
          variant="outline" 
          className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
          onClick={() => handleAction('qubetalk', null)}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          QubeTalk
        </Button>
      </div>
    </div>
  );
}
