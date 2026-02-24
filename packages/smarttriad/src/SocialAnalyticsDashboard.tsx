/**
 * Social Analytics Dashboard for SmartTriad
 * Smart Wallet CSS styling with lucide icons and glass effects
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  FileText, 
  Users, 
  Globe, 
  Twitter, 
  Linkedin, 
  Facebook, 
  MessageCircle, 
  Send, 
  Mail, 
  Smartphone, 
  Copy,
  TrendingUp,
  RefreshCw,
  BarChart3
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalShares: number;
    uniqueArticles: number;
    uniquePersonas: number;
    platforms: number;
    timeframe: string;
  };
  platformBreakdown: Array<{
    platform: string;
    shares: number;
    percentage: string;
  }>;
  topArticles: Array<{
    id: string;
    title: string;
    totalShares: number;
    uniquePersonas: number;
    platformsUsed: number;
    lastShared: string;
  }>;
  personaLeaderboard: Array<{
    rank: number;
    personaId: string;
    sharesMade: number;
    uniqueArticles: number;
    platformsUsed: number;
    lastShared: string;
  }>;
  dailyTrends: Array<{
    date: string;
    totalShares: number;
    platforms: Record<string, number>;
  }>;
}

interface SocialAnalyticsDashboardProps {
  className?: string;
}

export function SocialAnalyticsDashboard({ className = '' }: SocialAnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('7d');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'https://dev-beta.aigentz.me';
      const response = await fetch(`${apiUrl}/api/analytics/dashboard?timeframe=${timeframe}&limit=50`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }
      
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, React.ReactNode> = {
      'twitter': <Twitter className="h-5 w-5" />,
      'linkedin': <Linkedin className="h-5 w-5" />,
      'facebook': <Facebook className="h-5 w-5" />,
      'whatsapp': <MessageCircle className="h-5 w-5" />,
      'telegram': <Send className="h-5 w-5" />,
      'email': <Mail className="h-5 w-5" />,
      'native': <Smartphone className="h-5 w-5" />,
      'clipboard': <Copy className="h-5 w-5" />
    };
    return icons[platform] || <Globe className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#050f1f] p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 backdrop-blur-sm rounded-lg mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-white/10 backdrop-blur-sm rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-[#050f1f] p-6 ${className}`}>
        <div className="text-center p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
          <BarChart3 className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Analytics Error</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className={`min-h-screen bg-[#050f1f] p-6 ${className}`}><p className="text-white">No data available</p></div>;
  }

  return (
    <div className={`min-h-screen bg-[#050f1f] p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-cyan-400" />
            Social Analytics Dashboard
          </h1>
          <p className="text-gray-300 mt-2">Comprehensive sharing analytics and insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="7d" className="bg-[#071327]">Last 7 days</option>
            <option value="30d" className="bg-[#071327]">Last 30 days</option>
            <option value="90d" className="bg-[#071327]">Last 90 days</option>
          </select>
          <button 
            onClick={fetchAnalytics} 
            className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-cyan-500/20 rounded-lg mr-4">
              <Share2 className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Shares</p>
              <p className="text-2xl font-bold text-white">{data.overview.totalShares.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-purple-500/20 rounded-lg mr-4">
              <FileText className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Unique Articles</p>
              <p className="text-2xl font-bold text-white">{data.overview.uniqueArticles}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-green-500/20 rounded-lg mr-4">
              <Users className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Personas</p>
              <p className="text-2xl font-bold text-white">{data.overview.uniquePersonas}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
          <div className="flex items-center">
            <div className="p-3 bg-orange-500/20 rounded-lg mr-4">
              <Globe className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Platforms</p>
              <p className="text-2xl font-bold text-white">{data.overview.platforms}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-cyan-400" />
          Platform Performance
        </h2>
        <div className="space-y-3">
          {data.platformBreakdown.map((platform) => (
            <div key={platform.platform} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
                  {getPlatformIcon(platform.platform)}
                </div>
                <div>
                  <p className="font-medium text-white capitalize">{platform.platform}</p>
                  <p className="text-sm text-gray-400">{platform.shares} shares</p>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg text-sm font-medium">{platform.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Articles */}
      <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-cyan-400" />
          Most Shared Articles
        </h2>
        <div className="space-y-3">
          {data.topArticles.slice(0, 5).map((article, index) => (
            <div key={article.id} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg text-sm font-bold">#{index + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium text-white line-clamp-1">{article.title}</p>
                    <p className="text-sm text-gray-400">
                      {article.uniquePersonas} personas • {article.platformsUsed} platforms
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-white">{article.totalShares}</p>
                <p className="text-xs text-gray-400">shares</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
