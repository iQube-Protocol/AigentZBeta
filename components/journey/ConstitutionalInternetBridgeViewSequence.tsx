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
 *     schematic — see services/artifact/canonicalPlateImages.ts), Paper
 *     (only for the one block that carries a real `paperRef` — the live
 *     Qriptopian Codex "Polity Papers" record "The Constitution of the
 *     Agentic Polity", cover + PDF both real, dev-beta `codex_media_assets`
 *     row `f7342afc-...`). Every artifact keeps ITS OWN native aspect ratio
 *     — the viewport is NOT forced to 16:9 for everything; only the Video
 *     card locks to 16:9, Plate/Paper size the viewport from their own real
 *     width/height (`viewportAspectRatio`), matted/contained, never
 *     stretched or cropped. Selecting Paper shows a portrait cover-fronted
 *     reading launch surface with an "Open Reader" action that launches the
 *     EXISTING PDFLiteReaderModal in its native overlay — never a forked
 *     inline reader, never a bare "Read the paper" link.
 *     The lower strip is a constant "Book Insert" — a kicker naming the
 *     active artifact, the verbatim excerpt as flowing PROSE (the manuscript
 *     quote's own line breaks are joined with spaces for display — the
 *     words are unchanged, only the "one clause per line" bullet-like
 *     stacking is removed), the citation, and a ListenButton — regardless of
 *     which rail card is active. Moving between vignettes is real
 *     horizontal swipe/paging via components/ui/carousel.tsx. Geometry is
 *     content-driven (see BridgeContentCapsule) — this component must NOT
 *     wrap the capsule in a fixed height.
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
import { PDFLiteReaderModal } from '@/app/triad/components/content/PDFLiteReaderModal';
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
  if (block.paperRef) {
    const paperRef = block.paperRef;
    cards.push({
      id: 'paper',
      label: 'Paper',
      aspect: 'portrait',
      renderThumb: () => (
        <div className="flex h-full w-full items-center justify-center bg-[#faf7f0]">
          <img
            src={paperRef.coverImageUrl}
            alt={paperRef.title}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ),
    });
  }
  return cards;
}

/** Matted, contained media frame — never stretches/crops the asset; any
 *  leftover space is the matte, not a distortion of the artifact. */
function MattedFrame({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full items-center justify-center bg-[#faf7f0] p-3">{children}</div>;
}

/** Paper's viewport: a portrait cover-fronted reading launch surface — the
 *  real cover, the real title, an "Open Reader" action. Opens the EXISTING
 *  PDFLiteReaderModal in its native overlay; never a forked inline reader,
 *  never a bare link-out card. */
function PaperLaunchSurface({ paperRef }: { paperRef: NonNullable<ViewContentBlock['paperRef']> }) {
  const [readerOpen, setReaderOpen] = useState(false);
  return (
    <MattedFrame>
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <img
          src={paperRef.coverImageUrl}
          alt={paperRef.title}
          className="max-h-[calc(100%-3rem)] max-w-[70%] rounded-sm object-contain shadow-lg"
        />
        <button
          type="button"
          onClick={() => setReaderOpen(true)}
          className="inline-block rounded-lg border border-[#a08444]/50 bg-[#a08444]/10 px-4 py-2 text-sm text-[#1e3a5f] transition hover:bg-[#a08444]/20"
        >
          Open Reader ↗
        </button>
      </div>
      <PDFLiteReaderModal
        open={readerOpen}
        pdfUrl={paperRef.url}
        title={paperRef.title}
        onClose={() => setReaderOpen(false)}
      />
    </MattedFrame>
  );
}

function EthosVignetteCapsule({ block, videoOverride }: { block: ViewContentBlock; videoOverride?: string | null }) {
  const plateImage = canonicalPlateImage(block.plateImageId);
  const videoUrl = videoOverride ?? block.videoUrl;
  const railCards = ethosRailCards(block, videoUrl, plateImage);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-3">
      <BridgeContentCapsule
        railCards={railCards}
        allowFullscreen
        viewportAspectRatio={(activeId) => {
          if (activeId === 'video') return 16 / 9;
          if (activeId === 'paper' && block.paperRef) return block.paperRef.coverWidth / block.paperRef.coverHeight;
          if (activeId === 'plate' && plateImage) return plateImage.width / plateImage.height;
          return 16 / 9;
        }}
        renderViewport={(activeId) => {
          if (activeId === 'video' && videoUrl) {
            return (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video className="h-full w-full bg-black object-contain" controls src={videoUrl} />
            );
          }
          if (activeId === 'paper' && block.paperRef) {
            return <PaperLaunchSurface paperRef={block.paperRef} />;
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
