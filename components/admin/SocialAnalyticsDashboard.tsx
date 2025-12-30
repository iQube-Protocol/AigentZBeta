/**
 * Social Analytics Dashboard Component
 * Comprehensive analytics for social sharing data
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Share2, 
  Users, 
  TrendingUp, 
  Calendar, 
  Trophy,
  BarChart3,
  PieChart,
  Activity,
  ExternalLink
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    totalShares: number;
    uniqueArticles: number;
    uniquePersonas: number;
    platforms: number;
    timeframe: string;
    dateRange: {
      start: string;
      end: string;
    };
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

export function SocialAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('7d');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = import.meta.env.VITE_API_URL || 'https://dev-beta.aigentz.me';
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
      'reddit': '🤖',
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
      <div className="p-6">
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
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Error</h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <Button onClick={fetchAnalytics}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6">No data available</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Social Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive sharing analytics and insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Share2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Shares</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.totalShares.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unique Articles</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.uniqueArticles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Personas</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.uniquePersonas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <PieChart className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Platforms</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.platforms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
          <TabsTrigger value="articles">Top Articles</TabsTrigger>
          <TabsTrigger value="personas">Persona Leaderboard</TabsTrigger>
          <TabsTrigger value="trends">Daily Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms">
          <Card>
            <CardHeader>
              <CardTitle>Platform Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.platformBreakdown.map((platform) => (
                  <div key={platform.platform} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getPlatformIcon(platform.platform)}</span>
                      <div>
                        <p className="font-medium capitalize">{platform.platform}</p>
                        <p className="text-sm text-gray-600">{platform.shares} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{platform.percentage}%</Badge>
                      <div className="w-24 bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${platform.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="articles">
          <Card>
            <CardHeader>
              <CardTitle>Most Shared Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.topArticles.map((article, index) => (
                  <div key={article.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">#{index + 1}</Badge>
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
                      <p className="text-xs text-gray-500">
                        {formatDate(article.lastShared)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personas">
          <Card>
            <CardHeader>
              <CardTitle>Persona Sharing Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.personaLeaderboard.map((persona) => (
                  <div key={persona.personaId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100">
                        {persona.rank <= 3 ? (
                          <Trophy className={`h-4 w-4 ${
                            persona.rank === 1 ? 'text-yellow-600' : 
                            persona.rank === 2 ? 'text-gray-400' : 'text-orange-600'
                          }`} />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">#{persona.rank}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{persona.personaId}</p>
                        <p className="text-sm text-gray-600">
                          {persona.uniqueArticles} articles • {persona.platformsUsed} platforms
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{persona.sharesMade}</p>
                      <p className="text-xs text-gray-500">shares</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(persona.lastShared)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Daily Sharing Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.dailyTrends.map((trend) => (
                  <div key={trend.date} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium">{formatDate(trend.date)}</p>
                      <Badge variant="outline">{trend.totalShares} shares</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(trend.platforms).map(([platform, count]) => (
                        <div key={platform} className="flex items-center space-x-1 text-sm">
                          <span>{getPlatformIcon(platform)}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
