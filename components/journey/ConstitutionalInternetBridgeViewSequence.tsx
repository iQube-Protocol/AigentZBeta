'use client';

/**
 * ConstitutionalInternetBridgeViewSequence — the Constitutional Internet
 * Bridge's VIEW stage: Ethos | Crossings.
 *
 *   ETHOS — the existing, citation-checked content (CI_BRIDGE_VIEW_CONTENT),
 *     one BridgeContentCapsule per vignette (capsule = block). Each
 *     capsule's rail offers whichever media genuinely exists for that
 *     block — Video (admin-overridable, section=`ci-view-<blockId>`), Plate
 *     (always — every block carries a real CANONICAL_PLATES_V1 plate), and
 *     Paper (only once a real `paperRef` exists — CLAUDE.md's No-Guessing
 *     rule forbids fabricating a reference to fill the tier). The lower
 *     strip is a constant "Book Insert" — the verbatim excerpt + citation +
 *     a ListenButton — regardless of which rail card is active, so the
 *     grounding text never disappears while browsing media. Moving between
 *     vignettes is real horizontal swipe/paging via components/ui/carousel
 *     .tsx (replacing the earlier hand-rolled translateX carousel, which had
 *     no touch/swipe handling).
 *
 *   CROSSINGS — unchanged: a thin projection over the EXISTING, canonical
 *     Qriptopian Pulse infrastructure (community_generated_content via
 *     KnytCommunityContentTab, cartridge='qripto'), filtered to this
 *     journey's own campaign tag. No new feed, table, moderation queue or
 *     approval workflow — a published Personify Article/Story lands here
 *     through the exact same myCanvas → Pulse pipeline KNYTS already uses,
 *     just pointed at Qriptopian instead of KNYT (see
 *     ConstitutionalInternetBridgePersonifyMyCanvas).
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { BridgeContentCapsule, type BridgeCapsuleRailCard } from '@/components/journey/BridgeContentCapsule';
import { ListenButton } from '@/components/shared/ListenButton';
import {
  CI_BRIDGE_VIEW_CONTENT,
  type ViewContentBlock,
} from '@/services/journey/constitutionalInternetBridgeViewContent';
import { plateByNumber } from '@/services/artifact/canonicalPlates';
import { KnytCommunityContentTab } from '@/app/triad/components/codex/tabs/KnytCommunityContentTab';
import type { KnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

const CanonicalPlateFigure = dynamic(() => import('@/components/publishing/CanonicalPlateFigure'), { ssr: false });

type ViewTab = 'ethos' | 'crossings';

interface Props {
  personaId?: string;
}

/** One fetch per vignette, in parallel, on mount — three blocks today, so
 *  this stays cheap; a much larger Ethos would want a batched endpoint, not
 *  needed yet. Returns null (no override) for any section with no admin row
 *  or a failed fetch — the vignette's own static videoUrl is the fallback,
 *  never a blank/broken player. */
function useVignetteVideoOverrides(): Record<string, string | null> {
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      CI_BRIDGE_VIEW_CONTENT.map((block) =>
        fetch(`/api/journey/knyts-bridge/editorial-config?section=ci-view-${block.id}`, { cache: 'no-store' })
          .then((res) => res.json())
          .then(
            (json: { ok?: boolean; config?: KnytsBridgeEditorialSection }) =>
              [block.id, json?.ok ? json.config?.videoUrl ?? null : null] as const,
          )
          .catch(() => [block.id, null] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setOverrides(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return overrides;
}

/** The constant lower strip — the excerpt is the grounding text and stays
 *  visible no matter which rail card (Video/Plate/Paper) is active. */
function BookInsertStrip({ block }: { block: ViewContentBlock }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <blockquote className="whitespace-pre-line border-l-2 border-indigo-400/40 pl-3 text-xs italic leading-relaxed text-slate-300">
          {block.excerpt}
        </blockquote>
        <p className="mt-1 text-[10px] text-slate-600">The Constitutional Internet — {block.excerptSource}</p>
      </div>
      <ListenButton compact getText={() => block.excerpt} className="mt-0.5 shrink-0" />
    </div>
  );
}

function ethosRailCards(block: ViewContentBlock, videoUrl: string | undefined): BridgeCapsuleRailCard[] {
  const cards: BridgeCapsuleRailCard[] = [];
  if (videoUrl) cards.push({ id: 'video', label: 'Video', aspect: 'landscape' });
  cards.push({ id: 'plate', label: 'Plate', aspect: 'portrait' });
  if (block.paperRef) cards.push({ id: 'paper', label: 'Paper', aspect: 'portrait' });
  return cards;
}

function EthosVignetteCapsule({ block, videoOverride }: { block: ViewContentBlock; videoOverride?: string | null }) {
  const plate = plateByNumber(block.plateNumber);
  const videoUrl = videoOverride ?? block.videoUrl;
  const railCards = ethosRailCards(block, videoUrl);

  return (
    <div className="h-[28rem] rounded-2xl border border-white/10 bg-slate-950/20 p-3">
      <BridgeContentCapsule
        railCards={railCards}
        allowFullscreen
        renderViewport={(activeId) => {
          if (activeId === 'video' && videoUrl) {
            return (
              <div className="flex h-full flex-col">
                <p className="px-4 pt-4 text-[11px] uppercase tracking-[0.25em] text-indigo-400">{block.proposition}</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video className="mt-3 w-full flex-1 bg-black object-contain" controls src={videoUrl} />
              </div>
            );
          }
          if (activeId === 'paper' && block.paperRef) {
            return (
              <div className="flex h-full flex-col items-start justify-center gap-3 p-6">
                <p className="text-[11px] uppercase tracking-[0.25em] text-indigo-400">{block.proposition}</p>
                <p className="text-lg font-semibold text-white">{block.paperRef.title}</p>
                <a
                  href={block.paperRef.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 transition hover:bg-indigo-500/20"
                >
                  Read the paper ↗
                </a>
              </div>
            );
          }
          return (
            <div className="flex h-full flex-col overflow-y-auto p-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-indigo-400">{block.proposition}</p>
              {plate && <CanonicalPlateFigure plate={plate} />}
            </div>
          );
        }}
        renderStrip={() => <BookInsertStrip block={block} />}
      />
    </div>
  );
}

function EthosSequence() {
  const overrides = useVignetteVideoOverrides();
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const total = CI_BRIDGE_VIEW_CONTENT.length;

  useEffect(() => {
    if (!api) return;
    setIndex(api.selectedScrollSnap());
    const onSelect = () => setIndex(api.selectedScrollSnap());
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  return (
    <div className="space-y-3">
      <Carousel setApi={setApi} opts={{ align: 'start' }}>
        <CarouselContent>
          {CI_BRIDGE_VIEW_CONTENT.map((block) => (
            <CarouselItem key={block.id}>
              <EthosVignetteCapsule block={block} videoOverride={overrides[block.id]} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => api?.scrollPrev()}
          disabled={index === 0}
          className="rounded-full border border-white/10 p-1.5 text-slate-400 transition disabled:opacity-30 hover:text-white"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {CI_BRIDGE_VIEW_CONTENT.map((block, i) => (
            <button
              key={block.id}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Go to ${block.proposition}`}
              className={`h-1.5 w-1.5 rounded-full transition ${i === index ? 'bg-indigo-400' : 'bg-slate-700'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => api?.scrollNext()}
          disabled={index === total - 1}
          className="rounded-full border border-white/10 p-1.5 text-slate-400 transition disabled:opacity-30 hover:text-white"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ConstitutionalInternetBridgeViewSequence({ personaId }: Props) {
  const [tab, setTab] = useState<ViewTab>('ethos');

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-1">
        <button
          type="button"
          onClick={() => setTab('ethos')}
          className={`rounded-full border px-3.5 py-1 text-xs font-medium transition ${
            tab === 'ethos'
              ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200'
              : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          Ethos
        </button>
        <button
          type="button"
          onClick={() => setTab('crossings')}
          className={`rounded-full border px-3.5 py-1 text-xs font-medium transition ${
            tab === 'crossings'
              ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200'
              : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          Crossings
        </button>
      </div>

      {tab === 'ethos' ? (
        <EthosSequence />
      ) : (
        <div className="h-[32rem] rounded-2xl border border-white/10 overflow-hidden">
          <KnytCommunityContentTab
            personaId={personaId}
            cartridge="qripto"
            campaignTag={CI_BRIDGE_CAMPAIGN_ID}
            hideCrossingsFilter
          />
        </div>
      )}
    </div>
  );
}

export default ConstitutionalInternetBridgeViewSequence;
