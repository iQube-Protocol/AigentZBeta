/**
 * Simple Social Analytics Dashboard for SmartTriad
 * Minimal dependencies version for package compatibility
 */

'use client';

import React, { useState, useEffect } from 'react';

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
    const icons: Record<string, string> = {
      'twitter': '🐦',
      'linkedin': '💼',
      'facebook': '📘',
      'whatsapp': '💬',
      'telegram': '✈️',
      'email': '📧',
      'native': '📱',
      'clipboard': '📋'
    };
    return icons[platform] || '🔗';
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center p-6 border rounded-lg">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium mb-2">Analytics Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchAnalytics}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className={`p-6 ${className}`}>No data available</div>;
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Social Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive sharing analytics and insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button 
            onClick={fetchAnalytics} 
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 border rounded-lg">
          <div className="flex items-center">
            <div className="text-3xl mr-4">📤</div>
            <div>
              <p className="text-sm text-gray-600">Total Shares</p>
              <p className="text-2xl font-bold">{data.overview.totalShares.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-6 border rounded-lg">
          <div className="flex items-center">
            <div className="text-3xl mr-4">📈</div>
            <div>
              <p className="text-sm text-gray-600">Unique Articles</p>
              <p className="text-2xl font-bold">{data.overview.uniqueArticles}</p>
            </div>
          </div>
        </div>

        <div className="p-6 border rounded-lg">
          <div className="flex items-center">
            <div className="text-3xl mr-4">👥</div>
            <div>
              <p className="text-sm text-gray-600">Active Personas</p>
              <p className="text-2xl font-bold">{data.overview.uniquePersonas}</p>
            </div>
          </div>
        </div>

        <div className="p-6 border rounded-lg">
          <div className="flex items-center">
            <div className="text-3xl mr-4">🌐</div>
            <div>
              <p className="text-sm text-gray-600">Platforms</p>
              <p className="text-2xl font-bold">{data.overview.platforms}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="p-6 border rounded-lg">
        <h2 className="text-xl font-bold mb-4">Platform Performance</h2>
        <div className="space-y-4">
          {data.platformBreakdown.map((platform) => (
            <div key={platform.platform} className="flex items-center justify-between p-4 border rounded">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getPlatformIcon(platform.platform)}</span>
                <div>
                  <p className="font-medium capitalize">{platform.platform}</p>
                  <p className="text-sm text-gray-600">{platform.shares} shares</p>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">{platform.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Articles */}
      <div className="p-6 border rounded-lg">
        <h2 className="text-xl font-bold mb-4">Most Shared Articles</h2>
        <div className="space-y-4">
          {data.topArticles.slice(0, 5).map((article, index) => (
            <div key={article.id} className="flex items-center justify-between p-4 border rounded">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className="bg-gray-100 px-2 py-1 rounded text-sm">#{index + 1}</span>
                  <div>
                    <p className="font-medium line-clamp-1">{article.title}</p>
                    <p className="text-sm text-gray-600">
                      {article.uniquePersonas} personas • {article.platformsUsed} platforms
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{article.totalShares}</p>
                <p className="text-xs text-gray-500">shares</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
