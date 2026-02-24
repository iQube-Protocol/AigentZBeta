'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Users, DollarSign, Download, Calendar, Filter, Eye } from 'lucide-react';

// Mock data - replace with real API calls
const mockReports = [
  {
    id: '1',
    name: 'Q1 2024 Performance Report',
    description: 'Comprehensive Q1 performance analysis across all campaigns',
    type: 'quarterly',
    status: 'completed',
    generated_at: new Date('2024-03-31').toISOString(),
    metrics: {
      total_revenue: 125000,
      total_impressions: 2500000,
      total_conversions: 1250,
      avg_conversion_rate: 5.0,
      roi: 3.2
    },
    file_url: '/reports/q1-2024-performance.pdf'
  },
  {
    id: '2',
    name: 'Campaign Effectiveness Analysis',
    description: 'Analysis of campaign performance by channel and segment',
    type: 'analysis',
    status: 'completed',
    generated_at: new Date('2024-04-15').toISOString(),
    metrics: {
      total_revenue: 85000,
      total_impressions: 1800000,
      total_conversions: 920,
      avg_conversion_rate: 5.1,
      roi: 2.8
    },
    file_url: '/reports/campaign-effectiveness.pdf'
  },
  {
    id: '3',
    name: 'Partner Performance Report',
    description: 'Monthly performance metrics for all active partners',
    type: 'partner',
    status: 'generating',
    generated_at: new Date().toISOString(),
    metrics: null,
    file_url: null
  },
  {
    id: '4',
    name: 'Audience Segmentation Insights',
    description: 'Detailed analysis of audience segment behavior and preferences',
    type: 'audience',
    status: 'scheduled',
    generated_at: null,
    metrics: null,
    file_url: null
  }
];

export default function ReportsPage() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'generating':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quarterly':
        return <Calendar className="w-4 h-4" />;
      case 'analysis':
        return <BarChart3 className="w-4 h-4" />;
      case 'partner':
        return <Users className="w-4 h-4" />;
      case 'audience':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <BarChart3 className="w-4 h-4" />;
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              Analytics & Reports
            </h1>
            <p className="text-slate-300">
              Generate and analyze performance reports for campaigns and partners
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50">
              <Filter className="w-4 h-4 mr-2" />
              Filter Reports
            </Button>
            <Button className="bg-rose-500 hover:bg-rose-600 text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Reports</p>
              <p className="text-2xl font-bold text-white">{mockReports.length}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-rose-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Completed</p>
              <p className="text-2xl font-bold text-green-400">
                {mockReports.filter(r => r.status === 'completed').length}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Avg ROI</p>
              <p className="text-2xl font-bold text-blue-400">
                {mockReports
                  .filter(r => r.metrics?.roi)
                  .reduce((sum, r) => sum + r.metrics!.roi, 0) / 
                  mockReports.filter(r => r.metrics?.roi).length}x
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-400/50" />
          </div>
        </div>
        <div className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-purple-400">
                {formatCurrency(mockReports.reduce((sum, r) => sum + (r.metrics?.total_revenue || 0), 0))}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-400/50" />
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {mockReports.map((report) => (
          <div key={report.id} className="bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl rounded-xl p-6 hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getTypeIcon(report.type)}
                <div>
                  <h3 className="text-xl font-semibold text-white">{report.name}</h3>
                  <p className="text-slate-400 text-sm">{report.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={getStatusColor(report.status)}>
                  {report.status}
                </Badge>
                <div className="flex gap-2">
                  {report.file_url && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-white capitalize">{report.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Generated:</span>
                  <span className="text-white">{formatDate(report.generated_at)}</span>
                </div>
              </div>
              
              {report.metrics && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Revenue:</span>
                      <span className="text-green-400 ml-2">{formatCurrency(report.metrics.total_revenue)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Conversions:</span>
                      <span className="text-white ml-2">{formatNumber(report.metrics.total_conversions)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Conversion Rate:</span>
                      <span className="text-blue-400 ml-2">{report.metrics.avg_conversion_rate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">ROI:</span>
                      <span className="text-purple-400 ml-2">{report.metrics.roi}x</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
