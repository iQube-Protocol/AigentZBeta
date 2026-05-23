'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Crown, Lock, RefreshCw, User } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { CodexActionRow } from './CodexActionRow';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { isLockedContent, isPremiumContent } from '@/app/triad/components/codex/utils/contentFlags';
import { CodexBadge } from './CodexBadge';

export type QriptopianFeatureItem = {
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
  badge?: string;
  tags?: string[];
  isPremium?: boolean;
  price?: { amount: number; currency?: string };
  modalities?: {
    read?: { available?: boolean };
    watch?: { available?: boolean };
  };
};

interface QriptopianFeatureSectionsProps {
  theme?: 'light' | 'dark';
  heroArticles: QriptopianFeatureItem[];
  latestNews: QriptopianFeatureItem[];
  secondHeroArticles: QriptopianFeatureItem[];
  onOpen: (item: QriptopianFeatureItem, preferred?: 'read' | 'watch' | 'view') => void;
  onShare?: (item: QriptopianFeatureItem) => void;
  onInvite?: (item: QriptopianFeatureItem) => void;
  isOwned?: (id: string) => boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function QriptopianFeatureSections({
  theme = 'dark',
  heroArticles,
  latestNews,
  secondHeroArticles,
  onOpen,
  onShare,
  onInvite,
  isOwned,
  onRefresh,
  isRefreshing = false,
}: QriptopianFeatureSectionsProps) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [secondHeroIndex, setSecondHeroIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [newsIndex, setNewsIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  const heroTouchStart = useRef<number | null>(null);
  const heroTouchEnd = useRef<number | null>(null);
  const secondTouchStart = useRef<number | null>(null);
  const secondTouchEnd = useRef<number | null>(null);

  useEffect(() => {
    if (!carouselApi) return;
    const updateButtons = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
      setNewsIndex(carouselApi.selectedScrollSnap());
      setSnapCount(carouselApi.scrollSnapList().length);
    };
    updateButtons();
    carouselApi.on('select', updateButtons);
    carouselApi.on('reInit', updateButtons);
    return () => {
      carouselApi.off('select', updateButtons);
      carouselApi.off('reInit', updateButtons);
    };
  }, [carouselApi]);

  useEffect(() => {
    setHeroIndex(0);
  }, [heroArticles.length]);

  useEffect(() => {
    setSecondHeroIndex(0);
  }, [secondHeroArticles.length]);

  useEffect(() => {
    if (heroArticles.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroArticles.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroArticles.length]);

  useEffect(() => {
    if (secondHeroArticles.length <= 1) return;
    const interval = setInterval(() => {
      setSecondHeroIndex((prev) => (prev + 1) % secondHeroArticles.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [secondHeroArticles.length]);

  const activeHero = heroArticles[heroIndex];
  const activeSecondHero = secondHeroArticles[secondHeroIndex];

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-[#050f1f]' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-[#8fb3c0]' : 'text-slate-600';
  const borderClass = isDark ? 'border-[#1e2b40]' : 'border-slate-200';

  const renderActionRow = (item: QriptopianFeatureItem) => (
    <CodexActionRow
      item={item}
      variant="indigo"
      showRead={!!item.modalities?.read}
      showWatch={!!item.modalities?.watch}
      onRead={() => onOpen(item, 'read')}
      onWatch={() => onOpen(item, 'watch')}
      onView={() => onOpen(item, 'view')}
      onShare={() => onShare?.(item)}
      onInvite={() => onInvite?.(item)}
    />
  );

  const isItemPremium = (item: QriptopianFeatureItem) => isPremiumContent(item);
  const isOwnedItem = (item: { id: string }) => (isOwned ? isOwned(item.id) : false);
  const isItemLocked = (item: QriptopianFeatureItem) => isLockedContent(item, isOwnedItem);

  return (
    <div className="space-y-10">
      {activeHero && (
        <div
          className="relative w-full h-[360px] md:h-[420px] overflow-hidden rounded-2xl cursor-pointer"
          onClick={() => onOpen(activeHero)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onOpen(activeHero);
          }}
          onTouchStart={(event) => {
            heroTouchEnd.current = null;
            heroTouchStart.current = event.targetTouches[0].clientX;
          }}
          onTouchMove={(event) => {
            heroTouchEnd.current = event.targetTouches[0].clientX;
          }}
          onTouchEnd={() => {
            if (heroTouchStart.current === null || heroTouchEnd.current === null) return;
            const distance = heroTouchStart.current - heroTouchEnd.current;
            if (Math.abs(distance) < 50) return;
            if (distance > 0) {
              setHeroIndex((prev) => (prev + 1) % heroArticles.length);
            } else {
              setHeroIndex((prev) => (prev - 1 + heroArticles.length) % heroArticles.length);
            }
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${activeHero.image || activeHero.cover_image_url || ''})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${activeHero.imageScale || 100}%`,
              backgroundPosition: `${activeHero.imageX || 50}% ${activeHero.imageY || 50}%`,
              opacity: isItemLocked(activeHero) ? 0.6 : 1,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050f1f]" />

          {isItemLocked(activeHero) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 p-4">
                <Lock className="w-6 h-6 text-amber-300" />
              </div>
            </div>
          )}

          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
            <CodexBadge tone="cyan">{activeHero.badge || 'FEATURE'}</CodexBadge>
            {isItemPremium(activeHero) && (
              <CodexBadge tone="amber">
                <Crown className="h-3 w-3" />
                Premium
              </CodexBadge>
            )}
          </div>

          <div className="absolute top-4 right-4 flex gap-2">{renderActionRow(activeHero)}</div>

          <div className="absolute inset-x-0 bottom-0">
            <div className="bg-gradient-to-t from-black/80 to-transparent px-6 pb-8">
              <div className="max-w-2xl">
                {heroArticles.length > 1 && (
                  <div className="flex gap-2 mb-4">
                    {heroArticles.map((_, index) => (
                      <button
                        key={index}
                        onClick={(event) => {
                          event.stopPropagation();
                          setHeroIndex(index);
                        }}
                        className={`transition-all ${
                          index === heroIndex
                            ? 'w-8 h-2 bg-cyan-400 rounded-full'
                            : 'w-2 h-2 bg-white/30 hover:bg-white/50 rounded-full'
                        }`}
                        aria-label={`Article ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
                <h2 className="font-bold text-[#d0f6ff] mb-3 text-2xl md:text-4xl leading-tight">
                  {activeHero.title}
                </h2>
                {activeHero.excerpt && (
                  <p className="text-sm md:text-lg text-[#8fb3c0] line-clamp-2 md:line-clamp-none">
                    {activeHero.excerpt}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-[#8fb3c0]">
                  {activeHero.author && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {activeHero.author}
                    </span>
                  )}
                  {activeHero.published_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(activeHero.published_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {latestNews.length > 0 && (
        <section className={`${bgClass} rounded-2xl border ${borderClass} py-8`}>
          <div className="flex items-center justify-between mb-6 px-6">
            <div className="flex items-center gap-3">
              <h4 className="text-[#d0f6ff] text-2xl font-medium">Latest News</h4>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
                  aria-label="Refresh content"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => carouselApi?.scrollPrev()}
                disabled={!canScrollPrev}
                className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => carouselApi?.scrollNext()}
                disabled={!canScrollNext}
                className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <Carousel
            setApi={setCarouselApi}
            className="w-full overflow-hidden"
            opts={{ align: 'start', loop: true, dragFree: true }}
            plugins={[WheelGesturesPlugin()]}
          >
            <CarouselContent className="-ml-2">
              {latestNews.map((article) => {
                const isPremium = isItemPremium(article);
                const isLocked = isItemLocked(article);
                return (
                  <CarouselItem key={article.id} className="pl-2 basis-[43%] md:basis-1/3 lg:basis-1/4">
                    <div
                      className={`bg-[#020b18] border rounded-lg overflow-hidden transition-colors cursor-pointer ${
                        isPremium ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-[#1e2b40] hover:border-cyan-500/30'
                      }`}
                      onClick={() => onOpen(article)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') onOpen(article);
                      }}
                    >
                      {isPremium && (
                        <div className="absolute top-3 right-3 z-10">
                          <CodexBadge tone="amber">
                            <Crown className="h-3 w-3" />
                            Premium
                          </CodexBadge>
                        </div>
                      )}
                      <div className="relative">
                        {(article.cover_image_url || article.image) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={article.cover_image_url || article.image}
                            alt={article.title}
                            className={`w-full aspect-video object-cover ${isLocked ? 'opacity-60' : ''}`}
                          />
                        ) : (
                          <div className="w-full aspect-video bg-[#071327]" />
                        )}
                        {isLocked && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Lock className="h-10 w-10 text-amber-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <CodexBadge tone="cyan">{article.badge || 'NEWS'}</CodexBadge>
                          </div>
                          {renderActionRow(article)}
                        </div>
                        <h5 className="text-[#d0f6ff] text-base font-semibold line-clamp-2">
                          {article.title}
                        </h5>
                        {article.excerpt && (
                          <p className="text-[#8fb3c0] text-xs line-clamp-2">{article.excerpt}</p>
                        )}
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>

          {snapCount > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: snapCount }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => carouselApi?.scrollTo(index)}
                  className={`transition-all rounded-full ${
                    index === newsIndex
                      ? 'w-6 h-1.5 bg-cyan-400'
                      : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeSecondHero && (
        <div
          className="relative w-full h-[320px] md:h-[380px] overflow-hidden rounded-2xl bg-[#050f1f] cursor-pointer"
          onClick={() => onOpen(activeSecondHero)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onOpen(activeSecondHero);
          }}
          onTouchStart={(event) => {
            secondTouchEnd.current = null;
            secondTouchStart.current = event.targetTouches[0].clientX;
          }}
          onTouchMove={(event) => {
            secondTouchEnd.current = event.targetTouches[0].clientX;
          }}
          onTouchEnd={() => {
            if (secondTouchStart.current === null || secondTouchEnd.current === null) return;
            const distance = secondTouchStart.current - secondTouchEnd.current;
            if (Math.abs(distance) < 50) return;
            if (distance > 0) {
              setSecondHeroIndex((prev) => (prev + 1) % secondHeroArticles.length);
            } else {
              setSecondHeroIndex((prev) => (prev - 1 + secondHeroArticles.length) % secondHeroArticles.length);
            }
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${activeSecondHero.image || activeSecondHero.cover_image_url || ''})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${activeSecondHero.imageScale || 100}%`,
              backgroundPosition: `${activeSecondHero.imageX || 50}% ${activeSecondHero.imageY || 50}%`,
              opacity: isItemLocked(activeSecondHero) ? 0.6 : 1,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050f1f] via-transparent to-transparent" />

          {isItemLocked(activeSecondHero) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 p-4">
                <Lock className="w-6 h-6 text-amber-300" />
              </div>
            </div>
          )}

          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
            <CodexBadge tone="cyan">{activeSecondHero.badge || 'FEATURE'}</CodexBadge>
            {isItemPremium(activeSecondHero) && (
              <CodexBadge tone="amber">
                <Crown className="h-3 w-3" />
                Premium
              </CodexBadge>
            )}
          </div>

          <div className="absolute top-4 right-4 flex gap-2">{renderActionRow(activeSecondHero)}</div>

          <div className="absolute inset-x-0 bottom-0">
            <div className="bg-gradient-to-t from-black/80 to-transparent px-6 pb-8">
              <div className="text-left max-w-2xl">
                {secondHeroArticles.length > 1 && (
                  <div className="flex gap-2 mb-4">
                    {secondHeroArticles.map((_, index) => (
                      <button
                        key={index}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSecondHeroIndex(index);
                        }}
                        className={`transition-all ${
                          index === secondHeroIndex
                            ? 'w-8 h-2 bg-cyan-400 rounded-full'
                            : 'w-2 h-2 bg-white/30 hover:bg-white/50 rounded-full'
                        }`}
                        aria-label={`Article ${index + 1}`}
                      />
                    ))}
                  </div>
                )}

                <h2 className="text-2xl md:text-4xl font-bold text-[#d0f6ff] mb-3 leading-tight">
                  {activeSecondHero.title}
                </h2>
                {activeSecondHero.excerpt && (
                  <p className="text-sm md:text-lg text-[#8fb3c0] line-clamp-2 md:line-clamp-none">
                    {activeSecondHero.excerpt}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {heroArticles.length === 0 && latestNews.length === 0 && secondHeroArticles.length === 0 && (
        <div className="rounded-lg border border-slate-800 p-12 text-center bg-slate-900/40">
          <h4 className={`text-lg font-semibold ${textClass} mb-2`}>No Content Available</h4>
          <p className={`text-sm ${mutedClass}`}>
            Featured content will appear here once published
          </p>
        </div>
      )}
    </div>
  );
}
