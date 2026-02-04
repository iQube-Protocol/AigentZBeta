/**
 * CodexManager - Admin page for managing Codex content
 * 
 * This page provides the admin interface for:
 * - Uploading KNYT Codex content (episodes, covers, characters, lore)
 * - Uploading Qriptopian Codex content (future)
 * - Viewing upload status and managing existing content
 * 
 * Only accessible to authorized admins.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAdminAA } from '@/hooks/useIsAdminAA';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodexUploadModal } from '@/components/admin/CodexUploadModal';
import {
  ArrowLeft,
  Upload,
  Library,
  BookOpen,
  Image,
  Users,
  FileText,
  Gamepad2,
  Share2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Database,
  FileJson
} from 'lucide-react';

interface CodexStats {
  totalEpisodes: number;
  episodesWithStill: number;
  episodesWithMotion: number;
  episodesWithCovers: number;
  episodesComplete: number;
  globalStats: {
    totalStillMasters: number;
    totalMotionMasters: number;
    totalPrintRare: number;
    totalPrintEpic: number;
    totalPrintLegendary: number;
    totalCovers: number;
    totalCharacters: number;
    totalLoreDocs: number;
    totalGameAssets: number;
    totalSocialAssets: number;
    totalAllAssets: number;
  };
}

export default function CodexManager() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useIsAdminAA();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'knyt' | 'qriptopian'>('knyt');
  const [stats, setStats] = useState<CodexStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  // DEV MODE: Skip authentication in local development
  const isDevelopment = import.meta.env.DEV;
  const skipAuth = isDevelopment;

  // Fetch Codex status
  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await fetch('/api/admin/codex/status');
      if (!response.ok) {
        throw new Error('Failed to fetch Codex status');
      }
      const data = await response.json();
      setStats({
        totalEpisodes: data.summary?.totalEpisodes || 0,
        episodesWithStill: data.summary?.episodesWithStill || 0,
        episodesWithMotion: data.summary?.episodesWithMotion || 0,
        episodesWithCovers: data.summary?.episodesWithCovers || 0,
        episodesComplete: data.summary?.episodesComplete || 0,
        globalStats: data.globalStats || {
          totalStillMasters: 0,
          totalMotionMasters: 0,
          totalPrintRare: 0,
          totalPrintEpic: 0,
          totalPrintLegendary: 0,
          totalCovers: 0,
          totalCharacters: 0,
          totalLoreDocs: 0,
          totalGameAssets: 0,
          totalSocialAssets: 0,
          totalAllAssets: 0,
        },
      });
    } catch (error) {
      console.error('[CodexManager] Failed to fetch stats:', error);
      // In dev mode, use empty stats so the UI still works
      if (isDevelopment) {
        setStats({
          totalEpisodes: 0,
          episodesWithStill: 0,
          episodesWithMotion: 0,
          episodesWithCovers: 0,
          episodesComplete: 0,
          globalStats: {
            totalStillMasters: 0,
            totalMotionMasters: 0,
            totalPrintRare: 0,
            totalPrintEpic: 0,
            totalPrintLegendary: 0,
            totalCovers: 0,
            totalCharacters: 0,
            totalLoreDocs: 0,
            totalGameAssets: 0,
            totalSocialAssets: 0,
            totalAllAssets: 0,
          },
        });
        setStatsError('Stats unavailable - backend may not be running');
      } else {
        setStatsError(error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      setStatsLoading(false);
    }
  };

  // Import metadata from JSON file
  const handleImportMetadata = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImportLoading(true);
      setImportResult(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/admin/codex/import', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (data.success) {
          setImportResult({
            success: true,
            message: `Successfully imported: ${data.results.characters.inserted} characters, ${data.results.knyt_cards.inserted} KNYT cards, ${data.results.episodes.inserted} episodes, ${data.results.episode_credits.inserted} credits`,
          });
          // Refresh stats after import
          fetchStats();
        } else {
          setImportResult({
            success: false,
            message: data.error || data.message || 'Import failed',
          });
        }
      } catch (error) {
        setImportResult({
          success: false,
          message: error instanceof Error ? error.message : 'Import failed',
        });
      } finally {
        setImportLoading(false);
      }
    };

    input.click();
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (authLoading && !skipAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !skipAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You need administrator privileges to access this area.
          </p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  const assetCategories = [
    { 
      id: 'masters', 
      label: 'Episode Masters', 
      icon: BookOpen, 
      count: (stats?.globalStats.totalStillMasters || 0) + (stats?.globalStats.totalMotionMasters || 0) + (stats?.globalStats.totalPrintRare || 0) + (stats?.globalStats.totalPrintEpic || 0) + (stats?.globalStats.totalPrintLegendary || 0),
      color: 'text-cyan-400'
    },
    { 
      id: 'covers', 
      label: 'Covers', 
      icon: Image, 
      count: stats?.globalStats.totalCovers || 0,
      color: 'text-purple-400'
    },
    { 
      id: 'characters', 
      label: 'Characters', 
      icon: Users, 
      count: stats?.globalStats.totalCharacters || 0,
      color: 'text-blue-400'
    },
    { 
      id: 'lore', 
      label: 'Lore Docs', 
      icon: FileText, 
      count: stats?.globalStats.totalLoreDocs || 0,
      color: 'text-amber-400'
    },
    { 
      id: 'game', 
      label: 'Game Assets', 
      icon: Gamepad2, 
      count: stats?.globalStats.totalGameAssets || 0,
      color: 'text-green-400'
    },
    { 
      id: 'social', 
      label: 'Social Media', 
      icon: Share2, 
      count: stats?.globalStats.totalSocialAssets || 0,
      color: 'text-pink-400'
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 pr-[72px]">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Library className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Codex Manager</h1>
                <p className="text-muted-foreground">
                  Manage Digital Scrolls & Collectibles for KNYT and Qriptopian
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={fetchStats}
                disabled={statsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleImportMetadata}
                disabled={importLoading}
              >
                {importLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4 mr-2" />
                )}
                Import Metadata
              </Button>
              <Button onClick={() => setIsUploadModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Content
              </Button>
            </div>
          </div>
        </div>

        {skipAuth && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              ⚠️ Development Mode: Authentication bypassed for local development
            </p>
          </div>
        )}

        {importResult && (
          <div className={`rounded-lg p-4 mb-6 ${
            importResult.success 
              ? 'bg-green-500/10 border border-green-500/50' 
              : 'bg-red-500/10 border border-red-500/50'
          }`}>
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <p className={`text-sm ${
                importResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
              }`}>
                {importResult.message}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setImportResult(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Tabs for KNYT vs Qriptopian Codex */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'knyt' | 'qriptopian')} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="knyt" className="gap-2">
              <BookOpen className="h-4 w-4" />
              KNYT Codex
            </TabsTrigger>
            <TabsTrigger value="qriptopian" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Qriptopian Codex
            </TabsTrigger>
          </TabsList>

          {/* KNYT Codex Tab Content */}
          <TabsContent value="knyt" className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Episodes</p>
                    <p className="text-2xl font-bold">{stats?.totalEpisodes || 0}</p>
                  </div>
                  {stats?.episodesComplete === stats?.totalEpisodes && stats?.totalEpisodes > 0 ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-amber-500" />
                  )}
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">With Print Editions</p>
                    <p className="text-2xl font-bold">{stats?.summary?.episodesWithPrint || stats?.episodes?.filter((e: any) => e.hasPrintRare || e.hasPrintEpic || e.hasPrintLegendary).length || 0}</p>
                  </div>
                  <Badge variant="secondary">{(stats?.globalStats.totalPrintRare || 0) + (stats?.globalStats.totalPrintEpic || 0) + (stats?.globalStats.totalPrintLegendary || 0)} files</Badge>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">With Motion Comics</p>
                    <p className="text-2xl font-bold">{stats?.episodesWithMotion || 0}</p>
                  </div>
                  <Badge variant="secondary">{stats?.globalStats.totalMotionMasters || 0} files</Badge>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">With Covers</p>
                    <p className="text-2xl font-bold">{stats?.episodesWithCovers || 0}</p>
                  </div>
                  <Badge variant="secondary">{stats?.globalStats.totalCovers || 0} variants</Badge>
                </div>
              </Card>
            </div>

            {/* Asset Categories */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Asset Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {assetCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <Card key={category.id} className="p-4 text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${category.color}`} />
                      <p className="text-sm font-medium">{category.label}</p>
                      <p className="text-2xl font-bold">{category.count}</p>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Total Assets */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Total Assets on Autonomys</h3>
                  <p className="text-muted-foreground">
                    All encrypted content stored on Autonomys Auto-Drive
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-primary">
                    {stats?.globalStats.totalAllAssets || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">files uploaded</p>
                </div>
              </div>
            </Card>

            {/* Error Display */}
            {statsError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                <p className="text-sm text-red-400">
                  ⚠️ Error loading stats: {statsError}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Qriptopian Codex Tab Content */}
          <TabsContent value="qriptopian" className="space-y-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-24 h-24 bg-purple-500/10 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-12 h-12 text-purple-400" />
              </div>
              <h3 className="text-2xl font-medium text-foreground mb-3">
                Qriptopian Codex Coming Soon
              </h3>
              <p className="text-muted-foreground max-w-lg mb-8">
                The Qriptopian Codex will feature exclusive Qriptopian content, 
                including world-building documents, character profiles, interactive 
                experiences, and collectibles from the Quantum-Ready Internet universe.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                <Card className="p-4 text-center bg-purple-500/5 border-purple-500/20">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                  <p className="text-sm font-medium">World Lore</p>
                  <p className="text-xs text-muted-foreground">Coming Soon</p>
                </Card>
                <Card className="p-4 text-center bg-purple-500/5 border-purple-500/20">
                  <Users className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                  <p className="text-sm font-medium">Character Profiles</p>
                  <p className="text-xs text-muted-foreground">Coming Soon</p>
                </Card>
                <Card className="p-4 text-center bg-purple-500/5 border-purple-500/20">
                  <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                  <p className="text-sm font-medium">Interactive Experiences</p>
                  <p className="text-xs text-muted-foreground">Coming Soon</p>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Modal */}
      <CodexUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={() => {
          fetchStats();
        }}
      />
    </div>
  );
}
