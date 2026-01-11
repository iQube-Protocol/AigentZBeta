'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Coins, Crown, Loader2, Lock } from 'lucide-react';
import { useSmartTriad } from '@/app/components/content/SmartTriadProvider';
import { CodexActionRow } from '../CodexActionRow';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { isLockedContent, isPremiumContent } from '@/app/triad/components/codex/utils/contentFlags';
import { CodexBadge } from '../CodexBadge';

interface PennyDropsTabProps {
  theme?: 'light' | 'dark';
  personaId?: string;
  issueSlug?: string;
  dataSource?: string;
}

type PennyDropItem = {
  id: string;
  title: string;
  excerpt?: string;
  published_at?: string;
  author?: string;
  image?: string;
  cover_image_url?: string;
  badge?: string;
  tags?: string[];
  isPremium?: boolean;
  modalities?: any;
};

function getApiOrigin() {
  if (typeof window === 'undefined') return 'https://dev-beta.aigentz.me';
  return window.location.origin;
}

export function PennyDropsTab({ theme = 'dark', issueSlug, dataSource }: PennyDropsTabProps) {
  const { actions } = useSmartTriad();
  const isOwnedItem = (item: PennyDropItem) => actions.checkOwnership(item.id);
  const [items, setItems] = useState<PennyDropItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [snapCount, setSnapCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const cardClass = isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200';

  const issueParam = useMemo(() => {
    return issueSlug ? `?issue=${encodeURIComponent(issueSlug)}` : '';
  }, [issueSlug]);


  useEffect(() => {
    const fetchDrops = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const origin = getApiOrigin();
        const primary = dataSource ? `${origin}${dataSource}${issueParam}` : null;
        const fallback = `${origin}/api/content/section/pennydrops${issueParam}`;

        const urls = [primary, fallback].filter(Boolean) as string[];

        let lastErr: any = null;
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (!res.ok) {
              lastErr = new Error(`HTTP ${res.status}`);
              continue;
            }
            const data = await res.json();
            const content = data.content || data.data || [];
            setItems(Array.isArray(content) ? content : []);
            return;
          } catch (e) {
            lastErr = e;
          }
        }

        throw lastErr || new Error('Failed to load PennyDrops');
      } catch (e: any) {
        setError(e?.message || 'Failed to load PennyDrops');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrops();
  }, [dataSource, issueParam]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [issueSlug, items.length]);

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

  const selectedItem = items[selectedIndex] || items[0];
  const isSelectedPremium = selectedItem ? isPremiumContent(selectedItem) : false;
  const isSelectedLocked = selectedItem ? isLockedContent(selectedItem, isOwnedItem) : false;

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
          source: 'QRIPTO_PENNYDROPS_TAB',
        }),
      });
    } catch {
      // Fail-open for UX; DVN is optional.
    }
  };

  const openItem = async (item: PennyDropItem, modality: string | null) => {
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

  const getImage = (item: PennyDropItem) => item.image || item.cover_image_url;
  const getPrimaryModality = (item: PennyDropItem) => {
    if (item.modalities?.read) return 'read';
    if (item.modalities?.watch) return 'watch';
    return null;
  };

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
          <Coins className="w-5 h-5 text-amber-400" />
          PennyDrops
        </h3>
        <p className={`text-sm ${mutedClass} mt-1`}>
          Issue-scoped insights and drops
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {selectedItem ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <button
              onClick={() => openItem(selectedItem, getPrimaryModality(selectedItem))}
              className={`${cardClass} group relative w-full overflow-hidden rounded-xl border transition-colors hover:border-amber-500/60`}
            >
              <div className="relative aspect-[16/9] w-full">
                {getImage(selectedItem) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImage(selectedItem)}
                    alt={selectedItem.title}
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                      isSelectedLocked ? 'opacity-60' : ''
                    }`}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <Coins className="h-10 w-10 text-slate-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                {isSelectedLocked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-black/60 p-3">
                      <Lock className="h-5 w-5 text-amber-300" />
                    </div>
                  </div>
                )}
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <CodexBadge tone="amber">{selectedItem.badge || 'Q¢'}</CodexBadge>
                  {isSelectedPremium && (
                    <CodexBadge tone="amber">
                      <Crown className="h-3 w-3" />
                      Premium
                    </CodexBadge>
                  )}
                </div>
                <div className="absolute bottom-4 left-4 right-4 space-y-2 text-left">
                  <h4 className="text-xl font-semibold text-white">{selectedItem.title}</h4>
                  {selectedItem.excerpt && (
                    <p className="text-sm text-slate-200 line-clamp-2">{selectedItem.excerpt}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <CodexActionRow
                      variant="amber"
                      showRead={!!selectedItem.modalities?.read}
                      showWatch={!!selectedItem.modalities?.watch}
                      onRead={() => openItem(selectedItem, 'read')}
                      onWatch={() => openItem(selectedItem, 'watch')}
                      onView={() => openItem(selectedItem, null)}
                    />
                  </div>
                </div>
              </div>
            </button>
          </div>
          <div className="hidden md:block">
            <div className="flex h-full items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/40 text-xs uppercase tracking-[0.2em] text-slate-500">
              MetaVatar
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-800 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">More Drops</div>
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
            {items.map((item, index) => (
              <CarouselItem key={item.id} className="pl-3 basis-[43%] md:basis-1/3 lg:basis-1/4">
                <button
                  onClick={() => {
                    setSelectedIndex(index);
                    carouselApi?.scrollTo(index);
                  }}
                  className={`group relative h-24 w-full overflow-hidden rounded-lg border transition-all ${
                    selectedIndex === index
                      ? 'border-amber-400 ring-2 ring-amber-400/40'
                      : 'border-slate-800 hover:border-amber-400/60'
                  }`}
                >
                  {isPremiumContent(item) && (
                    <div className="absolute top-2 right-2 z-10">
                      <CodexBadge tone="amber" className="px-1.5 py-0.5">
                        <Crown className="h-3 w-3" />
                      </CodexBadge>
                    </div>
                  )}
                  {getImage(item) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImage(item)}
                      alt={item.title}
                      className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        isLockedContent(item, isOwnedItem) ? 'opacity-60' : ''
                      }`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                      <Coins className="h-6 w-6 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
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

      {items.length === 0 && !error && (
        <div className={`text-sm ${mutedClass}`}>No PennyDrops found for this issue.</div>
      )}
    </div>
  );
}
