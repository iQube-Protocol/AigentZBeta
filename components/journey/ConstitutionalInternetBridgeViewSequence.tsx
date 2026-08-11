'use client';

/**
 * ConstitutionalInternetBridgeViewSequence — the Constitutional Internet
 * Bridge's VIEW stage: Ethos | Crossings.
 *
 *   ETHOS — the existing, citation-checked content (CI_BRIDGE_VIEW_CONTENT),
 *     one BridgeContentCapsule per vignette (capsule = block), rendered as a
 *     canonical artifact gallery — not a generic asset viewer. Each block's
 *     rail offers whichever artifact genuinely exists for it — Video
 *     (admin-overridable, section=`ci-view-<blockId>`), Plate (always — one
 *     of the seven REAL canonical CIP plate images, never a code-generated
 *     schematic — see services/artifact/canonicalPlateImages.ts and its own
 *     header for why the SVG schematics are off-limits here), Paper (only
 *     once a real Polity Papers cover exists — CLAUDE.md's No-Guessing rule
 *     forbids fabricating one to fill the tier; none of the seven supplied
 *     plates is a cover, so this tier stays dormant for now). Every artifact
 *     renders inside a strict 16:9 hero viewport (`viewportAspect="video"`),
 *     contained/matted — never stretched, squashed, or arbitrarily cropped.
 *     The lower strip is a constant "Book Insert" — a kicker naming the
 *     active artifact, the verbatim excerpt as flowing PROSE (the manuscript
 *     quote's own line breaks are joined with spaces for display — the
 *     words are unchanged, only the "one clause per line" bullet-like
 *     stacking is removed), the citation, and a ListenButton — regardless of
 *     which rail card is active. Moving between vignettes is real
 *     horizontal swipe/paging via components/ui/carousel.tsx.
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

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { BridgeContentCapsule, type BridgeCapsuleRailCard } from '@/components/journey/BridgeContentCapsule';
import { ListenButton } from '@/components/shared/ListenButton';
import {
  CI_BRIDGE_VIEW_CONTENT,
  type ViewContentBlock,
} from '@/services/journey/constitutionalInternetBridgeViewContent';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { KnytCommunityContentTab } from '@/app/triad/components/codex/tabs/KnytCommunityContentTab';
import type { KnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';

type ViewTab = 'ethos' | 'crossings';
type ArtifactKind = 'video' | 'plate' | 'paper';

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

/** Same verbatim words as block.excerpt — joined into flowing prose instead
 *  of one clause per line, which reads as a bulleted list even with no
 *  literal bullet characters. Never paraphrased; only the line breaks used
 *  purely for display are removed. */
function asProse(excerpt: string): string {
  return excerpt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

const ARTIFACT_KICKER: Record<ArtifactKind, string> = {
  video: 'Video',
  plate: 'Canonical Plate',
  paper: 'Polity Paper',
};

/** The constant lower strip — a kicker naming the active artifact, the
 *  excerpt as prose (the grounding text), and its citation. Stays visible
 *  no matter which rail card (Video/Plate/Paper) is active. */
function BookInsertStrip({ block, activeKind }: { block: ViewContentBlock; activeKind: ArtifactKind }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400">{ARTIFACT_KICKER[activeKind]}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-200">{asProse(block.excerpt)}</p>
        <p className="mt-1.5 text-[10px] text-slate-600">The Constitutional Internet — {block.excerptSource}</p>
      </div>
      <ListenButton compact getText={() => asProse(block.excerpt)} className="mt-0.5 shrink-0" />
    </div>
  );
}

function ethosRailCards(
  block: ViewContentBlock,
  videoUrl: string | undefined,
  plateImage: ReturnType<typeof canonicalPlateImage>,
): BridgeCapsuleRailCard[] {
  const cards: BridgeCapsuleRailCard[] = [];
  if (videoUrl) {
    cards.push({
      id: 'video',
      label: 'Video',
      aspect: 'landscape',
      renderThumb: () => (
        <div className="relative h-full w-full bg-black">
          <video muted preload="metadata" className="h-full w-full object-cover" src={videoUrl} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-6 w-6 text-white/80" fill="currentColor" />
          </div>
        </div>
      ),
    });
  }
  cards.push({
    id: 'plate',
    label: 'Plate',
    aspect: 'landscape',
    renderThumb: plateImage
      ? () => (
          <div className="flex h-full w-full items-center justify-center bg-[#faf7f0]">
            <img src={plateImage.url} alt={plateImage.title} className="max-h-full max-w-full object-contain" />
          </div>
        )
      : undefined,
  });
  if (block.paperRef) cards.push({ id: 'paper', label: 'Paper', aspect: 'portrait' });
  return cards;
}

/** Matted, contained media frame — never stretches/crops the asset; any
 *  leftover space is the matte, not a distortion of the artifact. */
function MattedFrame({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full items-center justify-center bg-[#faf7f0] p-3">{children}</div>;
}

function EthosVignetteCapsule({ block, videoOverride }: { block: ViewContentBlock; videoOverride?: string | null }) {
  const plateImage = canonicalPlateImage(block.plateImageId);
  const videoUrl = videoOverride ?? block.videoUrl;
  const railCards = ethosRailCards(block, videoUrl, plateImage);

  return (
    <div className="h-[30rem] rounded-2xl border border-white/10 bg-slate-950/20 p-3">
      <BridgeContentCapsule
        railCards={railCards}
        allowFullscreen
        viewportAspect="video"
        renderViewport={(activeId) => {
          if (activeId === 'video' && videoUrl) {
            return (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video className="h-full w-full bg-black object-contain" controls src={videoUrl} />
            );
          }
          if (activeId === 'paper' && block.paperRef) {
            return (
              <MattedFrame>
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-lg font-semibold text-[#1e3a5f]">{block.paperRef.title}</p>
                  <a
                    href={block.paperRef.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-lg border border-[#a08444]/50 bg-[#a08444]/10 px-4 py-2 text-sm text-[#1e3a5f] transition hover:bg-[#a08444]/20"
                  >
                    Read the paper ↗
                  </a>
                </div>
              </MattedFrame>
            );
          }
          return (
            <MattedFrame>
              {plateImage && (
                // Real canonical plate — contain-fit, native aspect ratio preserved exactly.
                <img
                  src={plateImage.url}
                  alt={plateImage.title}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </MattedFrame>
          );
        }}
        renderStrip={(activeId) => <BookInsertStrip block={block} activeKind={activeId as ArtifactKind} />}
      />
    </div>
  );
}

export function ConstitutionalInternetBridgeViewSequence({ personaId }: Props) {
  const [tab, setTab] = useState<ViewTab>('ethos');
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
