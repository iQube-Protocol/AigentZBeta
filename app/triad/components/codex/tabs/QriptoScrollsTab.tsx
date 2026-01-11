'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Crown, Loader2, Lock } from 'lucide-react';
import { useSmartTriad } from '@/app/components/content/SmartTriadProvider';
import { CodexActionRow } from '../CodexActionRow';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { isLockedContent, isPremiumContent } from '@/app/triad/components/codex/utils/contentFlags';
import { CodexBadge } from '../CodexBadge';
import { CacheManager } from '@/app/utils/cache';

interface QriptoScrollsTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
}

type ScrollItem = {
  id: string;
  title: string;
  cover_image_url?: string;
  image?: string;
  excerpt?: string;
  badge?: string;
  position?: number;
  tags?: string[];
  isPremium?: boolean;
  modalities?: any;
};

function getApiOrigin() {
  if (typeof window === 'undefined') return 'https://dev-beta.aigentz.me';
  return window.location.origin;
}

export function QriptoScrollsTab({ theme = 'dark', issueSlug }: QriptoScrollsTabProps) {
  const { actions } = useSmartTriad();
  const isOwnedItem = (item: { id: string }) => actions.checkOwnership(item.id);
  const [items, setItems] = useState<ScrollItem[]>([]);
  const [activeTab, setActiveTab] = useState<'metaknyts' | 'synthsims'>('metaknyts');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [snapCount, setSnapCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          source: 'QRIPTO_SCROLLS_TAB',
        }),
      });
    } catch {
      // Fail-open for UX; DVN is optional.
    }
  };

  const openViaTriad = async (item: ScrollItem, modality: 'read' | 'watch' | null) => {
    const eventType = modality === 'watch' ? 'content.watch' : modality === 'read' ? 'content.read' : 'content.view';
    const isOwned = actions.checkOwnership(item.id);
    await actions.loadContent(item.id);
    if (!isOwned) {
      actions.openWallet('full');
      await emitDvnReceipt(eventType, item.id);
      return;
    }
    actions.setViewerModality(modality);
    actions.setActiveDrawer('contentViewer');
    await emitDvnReceipt(eventType, item.id);
  };

  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const cardClass = isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200';

  const issueParam = useMemo(() => {
    return issueSlug ? `?issue=${encodeURIComponent(issueSlug)}` : '';
  }, [issueSlug]);

  useEffect(() => {
    const fetchScrolls = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const origin = getApiOrigin();
        const issue = issueSlug || 'issue-1';
        const cacheKey = CacheManager.generateKey('qripto:scrolls', { issue });
        const data = await CacheManager.getOrSet(
          cacheKey,
          async () => {
            const res = await fetch(`${origin}/api/content/section/scrolls${issueParam}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          },
          { ttl: 300, tags: [`qripto:scrolls:${issue}`] }
        );
        const content = data.content || data.data || [];
        setItems(Array.isArray(content) ? content : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load Scrolls');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScrolls();
  }, [issueParam]);

  const scrollItems = useMemo(() => {
    return items.map((item) => {
      const badge = (item.badge || '').toLowerCase();
      const tab =
        badge.includes('synth') ? 'synthsims' : badge.includes('meta') ? 'metaknyts' : 'metaknyts';
      return { ...item, tab };
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    return scrollItems
      .filter((item) => item.tab === activeTab)
      .sort((a, b) => (a.position || 999) - (b.position || 999));
  }, [scrollItems, activeTab]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [activeTab, filteredItems.length]);

  useEffect(() => {
    if (!carouselApi) return;
    const updateIndex = () => {
      setSelectedIndex(carouselApi.selectedScrollSnap());
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
      setSnapCount(carouselApi.scrollSnapList().length);
    };
    updateIndex();
    carouselApi.on('select', updateIndex);
    carouselApi.on('reInit', updateIndex);
    return () => {
      carouselApi.off('select', updateIndex);
      carouselApi.off('reInit', updateIndex);
    };
  }, [carouselApi]);

  const getPrimaryModality = (item: ScrollItem) => {
    if (item.modalities?.watch) return 'watch';
    if (item.modalities?.read) return 'read';
    return null;
  };

  const tabs = [
    { id: 'metaknyts', label: 'metaKnyts' },
    { id: 'synthsims', label: 'The SynthSims' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className={`text-xl font-bold ${textClass} flex items-center gap-2`}>
          <BookOpen className="w-5 h-5 text-indigo-400" />
          Scrolls
        </h3>
        <p className={`text-sm ${mutedClass} mt-1`}>
          Issue-scoped scrolls and archives
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'metaknyts' | 'synthsims')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                isActive
                  ? 'border-indigo-400/60 text-indigo-200 bg-indigo-500/20'
                  : 'border-slate-700/70 text-slate-300 hover:border-slate-500/70'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {filteredItems.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((offset) => {
              const idx = (selectedIndex + offset) % filteredItems.length;
              const item = filteredItems[idx];
              return (
                <button
                  key={`${item.id}-${offset}`}
                  onClick={() => openViaTriad(item, getPrimaryModality(item))}
                  className={`${cardClass} group relative aspect-video overflow-hidden rounded-lg border text-left hover:border-indigo-500/60 transition-colors`}
                >
                  {(item.cover_image_url || item.image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.cover_image_url || item.image}
                      alt={item.title}
                      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        isLockedContent(item, isOwnedItem) ? 'opacity-60' : ''
                      }`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                      <BookOpen className="w-10 h-10 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <CodexBadge tone="indigo">{item.badge || activeTab.toUpperCase()}</CodexBadge>
                    {isPremiumContent(item) && (
                      <CodexBadge tone="amber">
                        <Crown className="h-3 w-3" />
                        Premium
                      </CodexBadge>
                    )}
                  </div>
                  {isLockedContent(item, isOwnedItem) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-black/60 p-3">
                        <Lock className="h-5 w-5 text-amber-300" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                    <div className={`font-semibold ${textClass} line-clamp-2`}>{item.title}</div>
                    {item.excerpt && (
                      <div className={`text-sm ${mutedClass} line-clamp-2 mt-1`}>{item.excerpt}</div>
                    )}
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CodexActionRow
                      variant="indigo"
                      showRead={!!item.modalities?.read}
                      showWatch={!!item.modalities?.watch}
                      onRead={() => openViaTriad(item, 'read')}
                      onWatch={() => openViaTriad(item, 'watch')}
                      onView={() => openViaTriad(item, null)}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-800 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">More Scrolls</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => carouselApi?.scrollPrev()}
                  disabled={!canScrollPrev}
                  className="p-2 rounded-full bg-[#020b18]/80 border border-cyan-500/40 text-cyan-300 hover:bg-[#020b18] hover:text-cyan-200 hover:border-cyan-500/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => carouselApi?.scrollNext()}
                  disabled={!canScrollNext}
                  className="p-2 rounded-full bg-[#020b18]/80 border border-cyan-500/40 text-cyan-300 hover:bg-[#020b18] hover:text-cyan-200 hover:border-cyan-500/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <Carousel
              setApi={setCarouselApi}
              className="w-full overflow-hidden"
              opts={{ align: 'start', loop: true, dragFree: true }}
              plugins={[WheelGesturesPlugin()]}
            >
              <CarouselContent className="-ml-3">
                {filteredItems.map((item, index) => (
                  <CarouselItem key={item.id} className="pl-3 basis-[43%] md:basis-1/3 lg:basis-1/4">
                    <button
                      onClick={() => {
                        setSelectedIndex(index);
                        carouselApi?.scrollTo(index);
                      }}
                      className={`group relative h-24 w-full overflow-hidden rounded-lg border transition-all ${
                        selectedIndex === index
                          ? 'border-indigo-400 ring-2 ring-indigo-400/40'
                          : 'border-slate-800 hover:border-indigo-400/60'
                      }`}
                    >
                  {(item.cover_image_url || item.image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.cover_image_url || item.image}
                      alt={item.title}
                      className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        isLockedContent(item, isOwnedItem) ? 'opacity-60' : ''
                      }`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                      <BookOpen className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  {isPremiumContent(item) && (
                    <div className="absolute top-2 right-2">
                      <CodexBadge tone="amber" className="px-1.5 py-0.5">
                        <Crown className="h-3 w-3" />
                      </CodexBadge>
                    </div>
                  )}
                  {isLockedContent(item, isOwnedItem) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="h-4 w-4 text-amber-300" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2 text-left">
                    <p className="text-xs font-semibold text-white line-clamp-2">{item.title}</p>
                  </div>
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            {snapCount > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {Array.from({ length: snapCount }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => carouselApi?.scrollTo(index)}
                    className={`transition-all rounded-full ${
                      index === selectedIndex
                        ? 'w-6 h-1.5 bg-cyan-400'
                        : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {filteredItems.length === 0 && !error && (
        <div className={`text-sm ${mutedClass}`}>No Scrolls found for this issue.</div>
      )}
    </div>
  );
}
