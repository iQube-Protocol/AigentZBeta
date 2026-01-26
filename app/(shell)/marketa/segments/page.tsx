'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Target, TrendingUp, Eye, Edit, BarChart3, Filter } from 'lucide-react';

// Mock data - replace with real API calls
const mockSegments = [
  {
    id: '1',
    name: 'Tech Enthusiasts',
    description: 'Users interested in technology and innovation',
    type: 'interest',
    status: 'active',
    size: 12500,
    criteria: {
      interests: ['technology', 'innovation', 'gadgets'],
      age_range: [25, 45],
      engagement_score: 0.8
    },
    performance: {
      conversion_rate: 3.2,
      avg_revenue_per_user: 150,
      campaign_participation: 8
    }
  },
  {
    id: '2',
    name: 'High-Value Customers',
    description: 'Customers with high lifetime value',
    type: 'value',
    status: 'active',
    size: 3200,
    criteria: {
      total_purchases: { min: 5 },
      avg_order_value: { min: 200 },
      loyalty_score: 0.9
    },
    performance: {
      conversion_rate: 5.8,
      avg_revenue_per_user: 450,
      campaign_participation: 12
    }
  },
  {
    id: '3',
    name: 'New Subscribers',
    description: 'Recently acquired subscribers',
    type: 'behavioral',
    status: 'active',
    size: 8900,
    criteria: {
      subscription_date: { days_ago: { max: 30 } },
      first_purchase: false,
      email_engagement: { min: 0.6 }
    },
    performance: {
      conversion_rate: 1.8,
      avg_revenue_per_user: 85,
      campaign_participation: 3
    }
  },
  {
    id: '4',
    name: 'Inactive Users',
    description: 'Users who haven\'t engaged recently',
    type: 'engagement',
    status: 'paused',
    size: 5600,
    criteria: {
      last_activity: { days_ago: { min: 90 } },
      email_open_rate: { max: 0.1 },
      purchase_frequency: { max: 1 }
    },
    performance: {
      conversion_rate: 0.8,
      avg_revenue_per_user: 25,
      campaign_participation: 1
    }
  }
];

export default function SegmentsPage() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'paused':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'interest':
        return <Target className="w-4 h-4" />;
      case 'value':
        return <TrendingUp className="w-4 h-4" />;
      case 'behavioral':
        return <Users className="w-4 h-4" />;
      case 'engagement':
        return <BarChart3 className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <Users className="w-8 h-8" />
              Audience Segments
            </h1>
            <p className="text-slate-300">
              Create and manage audience segments for targeted marketing campaigns
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
              <Filter className="w-4 h-4 mr-2" />
              Advanced Filters
            </Button>
            <Button className="bg-rose-500 hover:bg-rose-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Segment
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Segments</p>
              <p className="text-2xl font-bold text-white">{mockSegments.length}</p>
            </div>
            <Users className="w-8 h-8 text-rose-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Active Users</p>
              <p className="text-2xl font-bold text-green-400">
                {formatNumber(mockSegments.filter(s => s.status === 'active').reduce((sum, s) => sum + s.size, 0))}
              </p>
            </div>
            <Target className="w-8 h-8 text-green-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Avg Conversion</p>
              <p className="text-2xl font-bold text-blue-400">
                {(mockSegments.reduce((sum, s) => sum + s.performance.conversion_rate, 0) / mockSegments.length).toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-purple-400">
                {formatCurrency(mockSegments.reduce((sum, s) => sum + (s.performance.avg_revenue_per_user * s.size), 0))}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-400/50" />
          </div>
        </div>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mockSegments.map((segment) => (
          <div key={segment.id} className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6 hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getTypeIcon(segment.type)}
                <Badge className={getStatusColor(segment.status)}>
                  {segment.status}
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
            
            <h3 className="text-xl font-semibold text-white mb-2">{segment.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{segment.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-white capitalize">{segment.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Size:</span>
                  <span className="text-white">{formatNumber(segment.size)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Conversion:</span>
                  <span className="text-green-400">{segment.performance.conversion_rate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Revenue/User:</span>
                  <span className="text-purple-400">{formatCurrency(segment.performance.avg_revenue_per_user)}</span>
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-4">
              <div className="text-sm text-slate-400 mb-2">Key Criteria</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(segment.criteria).slice(0, 3).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </Badge>
                ))}
                {Object.keys(segment.criteria).length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{Object.keys(segment.criteria).length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
