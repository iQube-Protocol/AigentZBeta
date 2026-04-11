'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useSmartTriad } from '@/app/components/content/SmartTriadProvider';
import { QriptopianFeatureSections } from '../QriptopianFeatureSections';
import { CacheManager } from '@/app/utils/cache';
import { isLockedContent } from '@/app/triad/components/codex/utils/contentFlags';

interface ContentModalities {
  read?: { available?: boolean; text?: string; cid?: string };
  watch?: { available?: boolean; video_url?: string; duration?: string };
  listen?: { available?: boolean; audio_url?: string };
  link?: { available?: boolean; url?: string };
  view?: { available?: boolean; image_url?: string };
}

interface ContentItem {
  id: string;
  title: string;
  excerpt?: string;
  author?: string;
  published_at?: string;
  cover_image_url?: string;
  image?: string;
  imageScale?: number;
  imageX?: number;
  imageY?: number;
  section?: string;
  badge?: string;
  tags?: string[];
  isPremium?: boolean;
  modalities?: ContentModalities;
  content_blocks?: Array<{ type: string; text: string }>;
}

interface FeaturesTabProps {
  theme?: 'light' | 'dark';
  issueSlug?: string;
}

export function FeaturesTab({ theme = 'dark', issueSlug }: FeaturesTabProps) {
  const { actions } = useSmartTriad();
  const [heroArticles, setHeroArticles] = useState<ContentItem[]>([]);
  const [latestNews, setLatestNews] = useState<ContentItem[]>([]);
  const [secondHeroArticles, setSecondHeroArticles] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const emitDvnReceipt = async (eventType: string, contentId: string) => {
    try {
      await fetch('/api/ops/dvn/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          contentId,
          personaId: null,
          issue: issueSlug || 'issue-1',
          source: 'QRIPTO_FEATURES_TAB',
        }),
      });
    } catch {
      // Fail-open for UX; DVN is optional.
    }
  };

  const resolveEventType = (item: ContentItem, preferred?: 'read' | 'watch' | 'view') => {
    if (preferred === 'watch') return 'content.watch';
    if (preferred === 'read') return 'content.read';
    if (preferred === 'view') return 'content.view';
    if (item.modalities?.watch) return 'content.watch';
    if (item.modalities?.read) return 'content.read';
    return 'content.view';
  };

  const openViaTriad = async (item: ContentItem, preferred?: 'read' | 'watch' | 'view') => {
    const eventType = resolveEventType(item, preferred);
    const isLocked = isLockedContent(item, ({ id }) => actions.checkOwnership(id));
    await actions.loadContent(item.id);
    if (isLocked) {
      actions.openWallet('full', 'payments');
      await emitDvnReceipt(eventType, item.id);
      return;
    }
    actions.setContentAccessGranted(true);
    actions.setViewerModality(
      eventType === 'content.watch' ? 'watch' : eventType === 'content.read' ? 'read' : null
    );
    actions.setActiveDrawer('contentViewer');
    await emitDvnReceipt(eventType, item.id);
  };

  const openShareModal = (item: ContentItem) => {
    actions.openShare({
      id: item.id,
      title: item.title,
      description: item.excerpt,
      section: item.badge || item.section || 'Features',
      type: item.modalities?.watch ? 'video' : 'text',
    });
  };

  const issueParam = useMemo(() => {
    const params = new URLSearchParams();
    if (issueSlug) params.set('issue', issueSlug);
    params.set('scope', 'codex');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [issueSlug]);

  const cacheTag = useMemo(() => `qripto:features:${issueSlug || 'issue-1'}`, [issueSlug]);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        const apiUrl = typeof window !== 'undefined' ? window.location.origin : 'https://dev-beta.aigentz.me';
        const issue = issueSlug || 'issue-1';

        const [heroData, newsData, secondData] = await Promise.all([
          CacheManager.getOrSet(
            CacheManager.generateKey('qripto:home-hero', { issue }),
            async () => {
              const res = await fetch(`${apiUrl}/api/content/section/home-hero${issueParam}`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            },
            { ttl: 300, tags: [cacheTag] }
          ),
          CacheManager.getOrSet(
            CacheManager.generateKey('qripto:latest-news', { issue }),
            async () => {
              const res = await fetch(`${apiUrl}/api/content/section/latest-news${issueParam}`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            },
            { ttl: 300, tags: [cacheTag] }
          ),
          CacheManager.getOrSet(
            CacheManager.generateKey('qripto:second-hero', { issue }),
            async () => {
              const res = await fetch(`${apiUrl}/api/content/section/second-hero${issueParam}`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            },
            { ttl: 300, tags: [cacheTag] }
          ),
        ]);

        setHeroArticles(heroData.content || []);
        setLatestNews(newsData.content || []);
        setSecondHeroArticles(secondData.content || []);
      } catch (error) {
        console.error('Error fetching features content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [issueParam, refreshKey]);

  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-[#8fb3c0]' : 'text-slate-600';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h3 className={`text-xl font-bold ${textClass} flex items-center gap-2`}>
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Featured Content
        </h3>
        <p className={`text-sm ${mutedClass} mt-1`}>
          Explore the latest articles, insights, and stories from The Qriptopian
        </p>
      </div>

      <QriptopianFeatureSections
        theme={theme}
        heroArticles={heroArticles}
        latestNews={latestNews}
        secondHeroArticles={secondHeroArticles}
        onOpen={openViaTriad}
        onShare={openShareModal}
        isOwned={(id) => actions.checkOwnership(id)}
        onRefresh={() => {
          CacheManager.invalidate(cacheTag);
          setRefreshKey(Date.now());
        }}
        isRefreshing={false}
      />
    </div>
  );
}
