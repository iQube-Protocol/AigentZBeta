'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Brain, Check, Coins, Crown, Loader2, Lock, Sparkles } from 'lucide-react';
import { useSmartTriad } from '@/app/components/content/SmartTriadProvider';
import { CodexActionRow } from '../CodexActionRow';
import { QriptopianFeatureSections } from '../QriptopianFeatureSections';
import { isLockedContent, isPremiumContent, getContentPrice } from '@/app/triad/components/codex/utils/contentFlags';
import { CodexBadge } from '../CodexBadge';
import { CacheManager } from '@/app/utils/cache';

type SectionItem = {
  id: string;
  title: string;
  excerpt?: string;
  badge?: string;
  image?: string;
  tags?: string[];
  isPremium?: boolean;
  price?: { amount: number; currency?: string };
  modalities?: any;
};

type QriptoHomePayload = {
  issue: string;
  sections: {
    homeHero?: SectionItem[];
    latestNews?: SectionItem[];
    secondHero?: SectionItem[];
    pennydrops?: SectionItem[];
    scrolls?: SectionItem[];
    knowdz?: SectionItem[];
  };
};

interface QriptoLiquidCodexTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
  dataSource?: string;
}

function getApiOrigin() {
  if (typeof window === 'undefined') return 'https://dev-beta.aigentz.me';
  return window.location.origin;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function buildPayloadFromSections(origin: string, issue: string): Promise<QriptoHomePayload> {
  const issueParam = `issue=${encodeURIComponent(issue)}&scope=codex`;
  const [homeHero, latestNews, secondHero, pennydrops, scrolls, knowdz] = await Promise.all([
    fetchJson<any>(`${origin}/api/content/section/home-hero?${issueParam}`),
    fetchJson<any>(`${origin}/api/content/section/latest-news?${issueParam}`),
    fetchJson<any>(`${origin}/api/content/section/second-hero?${issueParam}`),
    fetchJson<any>(`${origin}/api/content/section/pennydrops?${issueParam}`),
    fetchJson<any>(`${origin}/api/content/section/scrolls?${issueParam}`),
    fetchJson<any>(`${origin}/api/content/section/21knowdz?${issueParam}`),
  ]);

  return {
    issue,
    sections: {
      homeHero: homeHero.content || [],
      latestNews: latestNews.content || [],
      secondHero: secondHero.content || [],
      pennydrops: pennydrops.content || [],
      scrolls: scrolls.content || [],
      knowdz: knowdz.content || [],
    },
  };
}

export function QriptoLiquidCodexTab({ theme = 'dark', personaId, issueSlug, dataSource }: QriptoLiquidCodexTabProps) {
  const { actions } = useSmartTriad();
  const isOwnedItem = (item: { id: string }) => actions.checkOwnership(item.id);

  const [payload, setPayload] = useState<QriptoHomePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const cardClass = isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200';

  const issueParam = useMemo(() => {
    const params = new URLSearchParams();
    if (issueSlug) params.set('issue', issueSlug);
    params.set('scope', 'codex');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [issueSlug]);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const origin = getApiOrigin();
        const primary = dataSource ? `${origin}${dataSource}${issueParam}` : null;
        const issue = issueSlug || 'issue-1';
        const cacheKey = CacheManager.generateKey('qripto:home', { issue, source: primary ? 'api' : 'fallback' });

        const data = await CacheManager.getOrSet(
          cacheKey,
          async () => {
            if (primary) {
              const primaryData = await fetchJson<QriptoHomePayload>(primary);
              const hasContent = Object.values(primaryData.sections || {}).some(
                (items) => Array.isArray(items) && items.length > 0
              );
              if (hasContent) {
                return primaryData;
              }
              return await buildPayloadFromSections(origin, issue);
            }

            return await buildPayloadFromSections(origin, issue);
          },
          { ttl: 300, tags: [`qripto:home:${issue}`] }
        );

        setPayload(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load Codex');
        setPayload(null);
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [dataSource, issueParam, issueSlug]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const heroArticles = payload?.sections.homeHero || [];
  const latest = payload?.sections.latestNews || [];
  const secondHeroArticles = payload?.sections.secondHero || [];
  const drops = payload?.sections.pennydrops || [];
  const scrolls = payload?.sections.scrolls || [];
  const knowdz = payload?.sections.knowdz || [];

  const emitDvnReceipt = async (eventType: string, item: SectionItem) => {
    try {
      await fetch('/api/ops/dvn/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          contentId: item.id,
          personaId: null,
          issue: issueSlug || payload?.issue || 'issue-1',
          source: 'QRIPTO_CODEX',
        }),
      });
    } catch {
      // Fail-open: DVN is optional for UX; server logs capture failures.
    }
  };

  const openInViewer = async (
    item: SectionItem,
    eventType: 'content.view' | 'content.read' | 'content.watch' = 'content.view'
  ) => {
    try {
      const isLocked = isLockedContent(item, isOwnedItem);
      await actions.loadContent(item.id);

      if (isLocked) {
        actions.openWallet('full', 'payments');
        return;
      }

      actions.setContentAccessGranted(true);
      actions.setViewerModality(
        eventType === 'content.read' ? 'read' : eventType === 'content.watch' ? 'watch' : null
      );
      actions.setActiveDrawer('contentViewer');
    } finally {
      await emitDvnReceipt(eventType, item);
    }
  };

  const openShareModal = (item: SectionItem) => {
    actions.openShare({
      id: item.id,
      title: item.title,
      description: item.excerpt,
      section: item.badge || 'Qriptopian',
      type: item.modalities?.watch ? 'video' : 'text',
      url: item.modalities?.link?.url,
    });
  };

  const openInviteModal = (item: SectionItem) => {
    actions.openInvite({
      id: item.id,
      title: item.title,
      description: item.excerpt,
      section: item.badge || 'Qriptopian',
      type: item.modalities?.watch ? 'video' : 'text',
      url: item.modalities?.link?.url,
    });
  };

  return (
    <div className="p-4 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <QriptopianFeatureSections
        theme={theme}
        heroArticles={heroArticles}
        latestNews={latest}
        secondHeroArticles={secondHeroArticles}
        onOpen={(item, preferred) => {
          const eventType =
            preferred === 'watch' ? 'content.watch' : preferred === 'read' ? 'content.read' : 'content.view';
          return openInViewer(item, eventType);
        }}
        onShare={openShareModal}
        onInvite={openInviteModal}
        isOwned={(id) => actions.checkOwnership(id)}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-300" />
            <div className={`text-sm font-semibold ${textClass}`}>PennyDrops</div>
          </div>
          {drops.slice(0, 4).map((item) => (
            <div key={item.id} className={`${cardClass} w-full rounded-lg border p-3 text-left`}>
              <div className="flex gap-3">
                <div className="relative w-16 h-12 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center flex-shrink-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.title}
                      className={`h-full w-full object-cover ${isLockedContent(item, isOwnedItem) ? 'opacity-60' : ''}`}
                    />
                  ) : (
                    <Coins className="w-5 h-5 text-slate-600" />
                  )}
                  {isPremiumContent(item) && (
                    <div className="absolute top-1 right-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-1 py-0.5 text-[8px] text-amber-200">
                      <Crown className="h-3 w-3" />
                    </div>
                  )}
                  {isLockedContent(item, isOwnedItem) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="h-3.5 w-3.5 text-amber-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isOwnedItem(item) ? (
                      <CodexBadge tone="cyan">
                        <Check className="h-3 w-3" />
                        Owned
                      </CodexBadge>
                    ) : (
                      <>
                        {isPremiumContent(item) && (
                          <CodexBadge tone="amber">
                            <Crown className="h-3 w-3" />
                            Premium
                          </CodexBadge>
                        )}
                        {(() => { const p = getContentPrice(item as any); return p !== null ? <CodexBadge tone="amber">Q¢ {p}</CodexBadge> : null; })()}
                      </>
                    )}
                  </div>
                  <div className={`font-medium ${textClass} mt-1 line-clamp-2`}>{item.title}</div>
                </div>
              </div>
              <div className="mt-3">
                <CodexActionRow
                  item={item}
                  isOwned={isOwnedItem(item)}
                  variant="amber"
                  showRead={!!item.modalities?.read}
                  showWatch={!!item.modalities?.watch}
                  onRead={() => openInViewer(item, 'content.read')}
                  onWatch={() => openInViewer(item, 'content.watch')}
                  onView={() => openInViewer(item, 'content.view')}
                  onShare={() => openShareModal(item)}
                  onInvite={() => openInviteModal(item)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-300" />
            <div className={`text-sm font-semibold ${textClass}`}>Scrolls</div>
          </div>
          {scrolls.slice(0, 3).map((item) => (
            <div key={item.id} className={`${cardClass} w-full rounded-lg border p-3 text-left`}>
              <div className="flex gap-3">
                <div className="relative w-16 h-12 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center flex-shrink-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.title}
                      className={`h-full w-full object-cover ${isLockedContent(item, isOwnedItem) ? 'opacity-60' : ''}`}
                    />
                  ) : (
                    <BookOpen className="w-5 h-5 text-slate-600" />
                  )}
                  {isPremiumContent(item) && (
                    <div className="absolute top-1 right-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-1 py-0.5 text-[8px] text-amber-200">
                      <Crown className="h-3 w-3" />
                    </div>
                  )}
                  {isLockedContent(item, isOwnedItem) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="h-3.5 w-3.5 text-amber-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <CodexBadge tone="indigo">{item.badge || 'SCROLL'}</CodexBadge>
                  </div>
                  <div className={`font-medium ${textClass} mt-1 line-clamp-2`}>{item.title}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <CodexActionRow
                  item={item}
                  variant="indigo"
                  showRead={!!item.modalities?.read}
                  showWatch={!!item.modalities?.watch}
                  onRead={() => openInViewer(item, 'content.read')}
                  onWatch={() => openInViewer(item, 'content.watch')}
                  onView={() => openInViewer(item, 'content.view')}
                  onShare={() => openShareModal(item)}
                  onInvite={() => openInviteModal(item)}
                />
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isLocked = isLockedContent(item, isOwnedItem);
                    if (isLocked) {
                      await actions.loadContent(item.id);
                      actions.openWallet('full', 'payments');
                      await emitDvnReceipt('content.view', item);
                      return;
                    }
                    await openInViewer(item, 'content.view');
                  }}
                  className="flex items-center justify-center rounded-md border border-slate-600 bg-slate-700/30 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700/60 transition-colors"
                >
                  <Coins className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-300" />
            <div className={`text-sm font-semibold ${textClass}`}>Kn0wdZ</div>
          </div>
          {knowdz.slice(0, 3).map((item) => (
            <div key={item.id} className={`${cardClass} w-full rounded-lg border p-3 text-left`}>
              <div className="flex gap-3">
                <div className="relative w-16 h-12 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center flex-shrink-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.title}
                      className={`h-full w-full object-cover ${isLockedContent(item, isOwnedItem) ? 'opacity-60' : ''}`}
                    />
                  ) : (
                    <Brain className="w-5 h-5 text-slate-600" />
                  )}
                  {isPremiumContent(item) && (
                    <div className="absolute top-1 right-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-1 py-0.5 text-[8px] text-amber-200">
                      <Crown className="h-3 w-3" />
                    </div>
                  )}
                  {isLockedContent(item, isOwnedItem) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="h-3.5 w-3.5 text-amber-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <CodexBadge tone="indigo">{item.badge || 'KB'}</CodexBadge>
                  </div>
                  <div className={`font-medium ${textClass} mt-1 line-clamp-2`}>{item.title}</div>
                </div>
              </div>
              <div className="mt-3">
                <CodexActionRow
                  item={item}
                  variant="indigo"
                  showRead={!!item.modalities?.read}
                  showWatch={!!item.modalities?.watch}
                  onRead={() => openInViewer(item, 'content.read')}
                  onWatch={() => openInViewer(item, 'content.watch')}
                  onView={() => openInViewer(item, 'content.view')}
                  onShare={() => openShareModal(item)}
                  onInvite={() => openInviteModal(item)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
