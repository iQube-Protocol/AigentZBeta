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
 *     card locks to 16:9, Plate sizes from its own real width/height
 *     (`viewportAspectRatio`), matted/contained, never stretched or cropped.
 *
 *     Paper's featured state (refined 2026-08-11) is a document-GALLERY
 *     composition, not one portrait cover floating alone in a wide
 *     viewport: the selected cover, centred and visually primary, flanked
 *     by its real neighbours in the same Qriptopian Codex Polity Papers
 *     series (`services/artifact/polityPapersSeries.ts`) — series-COVER
 *     fallback (option B), since no interior-page-thumbnail pipeline exists
 *     in this codebase (see that file's header). Every cover keeps its
 *     real native portrait ratio; clicking a neighbour opens ITS OWN
 *     reader directly rather than reassigning "featured" state — no new
 *     navigation architecture. "Open Reader" on the selected cover launches
 *     the EXISTING PDFLiteReaderModal in its native overlay — never a
 *     forked inline reader.
 *     The lower strip reads as an editorial BOOK EXCERPT, not a status
 *     panel (editorial polish pass, 2026-08-11): a small "The Constitutional
 *     Internet" source line, the proposition as a quiet chapter reference,
 *     the verbatim excerpt set as the dominant quotation (flowing PROSE —
 *     the manuscript quote's own line breaks are joined with spaces for
 *     display, words unchanged, only the "one clause per line" bullet-like
 *     stacking removed), then citation + Listen on one row. The active
 *     artifact type is a small secondary tag, not the dominant label — the
 *     excerpt is the SAME grounding quotation regardless of which rail card
 *     is selected. Moving between vignettes is real horizontal swipe/paging
 *     via components/ui/carousel.tsx. Geometry is content-driven (see
 *     BridgeContentCapsule) — this component must NOT wrap the capsule in a
 *     fixed height. Rail cards carry a small caption (kicker + real title —
 *     the plate/paper's own title, or the block's `shortTitle` for Video)
 *     so the rail reads as curated, not bare thumbnails.
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
import { ArtifactMattedFrame } from '@/components/journey/ArtifactMattedFrame';
import { ListenButton } from '@/components/shared/ListenButton';
import { PDFLiteReaderModal } from '@/app/triad/components/content/PDFLiteReaderModal';
import {
  CI_BRIDGE_VIEW_CONTENT,
  type ViewContentBlock,
} from '@/services/journey/constitutionalInternetBridgeViewContent';
import { canonicalPlateImage } from '@/services/artifact/canonicalPlateImages';
import { polityPapersNeighbors, type PolityPaperSeriesEntry } from '@/services/artifact/polityPapersSeries';
import { KnytCommunityContentTab } from '@/app/triad/components/codex/tabs/KnytCommunityContentTab';
import type { KnytsBridgeEditorialSection } from '@/services/journey/knytsBridgeEditorialConfig';
import { CI_BRIDGE_CAMPAIGN_ID } from '@/services/journey/constitutionalInternetBridgeJourney';
import { stashCiBridgeRemixIntent } from '@/services/journey/ciBridgeRemixIntent';

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

/** The constant lower strip — an editorial BOOK EXCERPT, not a status
 *  panel: source line, proposition as a quiet chapter reference, the
 *  excerpt set as the dominant quotation, citation on its own row.
 *  The active artifact type is a small secondary tag (top-right), never
 *  the dominant label — this is the same grounding quotation regardless
 *  of which rail card (Video/Plate/Paper) is active.
 *
 * Listen relocated to the top metadata row (targeted correction pass,
 * 2026-08-11) — it now sits immediately beside the artifact-kind label
 * (CANONICAL PLATE / VIDEO / POLITY PAPER), matching the operator's desired
 * header shape, instead of the lower citation row. No change to TTS
 * behavior — same `ListenButton`, same `getText`. */
function BookInsertStrip({ block, activeKind }: { block: ViewContentBlock; activeKind: ArtifactKind }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400/80">The Constitutional Internet</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.15em] text-slate-600">
            {ARTIFACT_KICKER[activeKind]}
          </span>
          <ListenButton compact getText={() => asProse(block.excerpt)} />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">{block.proposition}</p>
      <p className="mt-2 font-serif text-[15px] italic leading-[1.55] text-slate-200">
        &ldquo;{asProse(block.excerpt)}&rdquo;
      </p>
      <p className="mt-2.5 truncate text-[10px] text-slate-600">{block.excerptSource}</p>
    </div>
  );
}

/** A tiny curated caption band over a rail thumbnail — kicker + real title
 *  (never a bare, uncaptioned image). Legible over both dark (video) and
 *  ivory (plate/paper) thumbnails via the gradient's own darkening. */
function RailCaption({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2 pb-1 pt-5">
      <p className="text-[9px] uppercase tracking-[0.15em] text-amber-200/90">{kicker}</p>
      <p className="truncate text-[11px] font-medium text-white">{title}</p>
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
          <RailCaption kicker="Video" title={block.shortTitle} />
        </div>
      ),
    });
  }
  if (plateImage) {
    const plateNumber = plateImage.id.match(/CIP-(\d+)/)?.[1];
    const plateKicker = plateNumber ? `Plate ${String(parseInt(plateNumber, 10)).padStart(2, '0')}` : 'Plate';
    cards.push({
      id: 'plate',
      label: 'Plate',
      aspect: 'landscape',
      renderThumb: () => (
        <div className="relative h-full w-full">
          <div className="flex h-full w-full items-center justify-center bg-[#faf7f0]">
            <img src={plateImage.url} alt={plateImage.title} className="max-h-full max-w-full object-contain" />
          </div>
          <RailCaption kicker={plateKicker} title={plateImage.title} />
        </div>
      ),
    });
  }
  if (block.paperRef) {
    const paperRef = block.paperRef;
    cards.push({
      id: 'paper',
      label: 'Paper',
      // Uniform landscape rail slot (integration pass, 2026-08-11) — was
      // 'portrait' (matching the real 1055x1491 cover un-cropped), which
      // made this slot a different shape than Video/Plate. The rail is a
      // NAVIGATION PREVIEW, so a landscape crop derivative is fine here;
      // the real cover stays untouched and full/selected Paper presentation
      // (PaperLaunchSurface, below) remains portrait-aware/uncropped.
      aspect: 'landscape',
      renderThumb: () => (
        <div className="relative h-full w-full overflow-hidden bg-[#faf7f0]">
          {/* object-cover + a top-biased object-position crops toward the
              cover's title/identity area (conventionally near the top of a
              book cover) rather than stretching or distorting the source
              image. Pure CSS derivative — services/artifact/
              polityPapersSeries.ts's coverImageUrl/coverWidth/coverHeight
              are never altered. */}
          <img
            src={paperRef.coverImageUrl}
            alt={paperRef.title}
            className="h-full w-full object-cover"
            style={{ objectPosition: 'center 18%' }}
          />
          <RailCaption kicker="Polity Paper" title={paperRef.title} />
        </div>
      ),
    });
  }
  return cards;
}

/** @deprecated moved to the shared `ArtifactMattedFrame.tsx` (targeted
 *  correction pass, 2026-08-11) — Passport and Choose now need the same
 *  treatment, so the mat is defined once and imported everywhere. This
 *  local alias is kept only so the (many) call sites below don't all need
 *  a mechanical rename in the same diff; new call sites should import
 *  `ArtifactMattedFrame` directly instead of this alias. */
function MattedFrame({ children }: { children: ReactNode }) {
  return <ArtifactMattedFrame>{children}</ArtifactMattedFrame>;
}

/** A smaller, dimmer neighbouring series cover — clicking it opens ITS OWN
 *  reader directly (never reassigns which paper is "featured", per the
 *  operator's instruction not to invent new navigation architecture). */
function AdjacentPaperCover({ entry, side }: { entry: PolityPaperSeriesEntry; side: 'previous' | 'next' }) {
  const [readerOpen, setReaderOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setReaderOpen(true)}
        title={`Open "${entry.title}"`}
        className="hidden h-full shrink-0 flex-col items-center justify-center gap-1.5 opacity-55 transition hover:opacity-90 sm:flex"
      >
        <img
          src={entry.coverImageUrl}
          alt={entry.title}
          className="max-h-[62%] w-auto rounded-sm object-contain shadow-md shadow-black/15"
        />
        <span className="max-w-[6.5rem] truncate text-[10px] text-[#6b6255]">
          {side === 'previous' ? '← ' : ''}
          {entry.title}
          {side === 'next' ? ' →' : ''}
        </span>
      </button>
      <PDFLiteReaderModal open={readerOpen} pdfUrl={entry.url} title={entry.title} onClose={() => setReaderOpen(false)} />
    </>
  );
}

/** Paper's featured viewport: a document-GALLERY composition — the
 *  selected cover, centred and visually primary, flanked by its real
 *  neighbours in the same Polity Papers series (series-cover fallback,
 *  option B — no interior-page thumbnails exist in this codebase). Every
 *  cover keeps its real native portrait ratio via object-contain; nothing
 *  is cropped or stretched. "Open Reader" launches the EXISTING
 *  PDFLiteReaderModal in its native overlay — never a forked inline
 *  reader, never a bare link-out card. */
function PaperLaunchSurface({ paperRef }: { paperRef: NonNullable<ViewContentBlock['paperRef']> }) {
  const [readerOpen, setReaderOpen] = useState(false);
  const { previous, next } = polityPapersNeighbors(paperRef.codexRef);

  return (
    <MattedFrame>
      <div className="flex h-full w-full items-center justify-center gap-3 sm:gap-6">
        {previous && <AdjacentPaperCover entry={previous} side="previous" />}
        <div className="flex h-full min-w-0 flex-col items-center justify-center gap-2">
          <img
            src={paperRef.coverImageUrl}
            alt={paperRef.title}
            className="max-h-[calc(100%-2.25rem)] w-auto rounded-sm object-contain shadow-[0_10px_28px_rgba(0,0,0,0.25)]"
          />
          <button
            type="button"
            onClick={() => setReaderOpen(true)}
            className="inline-block shrink-0 rounded-lg border border-[#a08444]/50 bg-[#a08444]/10 px-4 py-1.5 text-xs font-medium text-[#1e3a5f] transition hover:bg-[#a08444]/20"
          >
            Open Reader ↗
          </button>
        </div>
        {next && <AdjacentPaperCover entry={next} side="next" />}
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
    <div className="p-1">
      <BridgeContentCapsule
        railCards={railCards}
        allowFullscreen
        viewportAspectRatio={(activeId) => {
          if (activeId === 'video') return 16 / 9;
          // Paper's featured state is a wide gallery (cover + neighbours),
          // not a single portrait cover — the viewport uses a landscape
          // ratio; the covers inside still keep their own real ratio via
          // object-contain (PaperLaunchSurface).
          if (activeId === 'paper') return 16 / 10;
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
      {/* One top row (editorial polish, 2026-08-11): Ethos/Crossings
          left-aligned, capsule prev/dots/next centered in the remaining
          width — so multiple capsules are discoverable immediately,
          without needing a second nav row beneath the gallery. */}
      <div className="grid grid-cols-3 items-center">
        <div className="flex items-center justify-start gap-1">
          <button
            type="button"
            onClick={() => setTab('ethos')}
            className={`rounded-full border px-3.5 py-1 text-xs font-medium transition ${
              tab === 'ethos'
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
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
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Crossings
          </button>
        </div>
        <div className="flex items-center justify-center gap-3">
          {tab === 'ethos' && (
            <>
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
                    className={`h-1.5 w-1.5 rounded-full transition ${i === index ? 'bg-amber-400' : 'bg-slate-700'}`}
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
            </>
          )}
        </div>
        <div />
      </div>

      {tab === 'ethos' ? (
        <Carousel setApi={setApi} opts={{ align: 'start' }}>
          <CarouselContent>
            {CI_BRIDGE_VIEW_CONTENT.map((block) => (
              <CarouselItem key={block.id}>
                <EthosVignetteCapsule block={block} videoOverride={overrides[block.id]} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      ) : (
        <div className="h-[32rem] rounded-2xl border border-white/10 overflow-hidden">
          <KnytCommunityContentTab
            personaId={personaId}
            cartridge="qripto"
            campaignTag={CI_BRIDGE_CAMPAIGN_ID}
            hideCrossingsFilter
            onRemixIntent={(payload) => {
              stashCiBridgeRemixIntent(payload);
              try {
                window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId: 'personify' } }));
              } catch {
                /* non-fatal */
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ConstitutionalInternetBridgeViewSequence;
