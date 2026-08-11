'use client';

/**
 * ConstitutionalInternetBridgeViewSequence — the Constitutional Internet
 * Bridge's VIEW stage, evolved (2026-08-11) into Ethos | Crossings.
 *
 *   ETHOS — the existing, citation-checked Video→Plate→Excerpt content
 *     (CI_BRIDGE_VIEW_CONTENT), reorganized from a vertically stacked
 *     document into a horizontal vignette carousel so a visitor moves
 *     laterally through the core propositions rather than scrolling a long
 *     page. Hierarchy per vignette: hero (video + plate) → supporting
 *     context (excerpt) → optional deep dive (Polity Paper, only when one
 *     genuinely exists — CLAUDE.md's No-Guessing rule, never a fabricated
 *     reference to fill the tier). Each vignette's video is admin-
 *     overridable via the SAME editorial-config table/route KNYTS Bridge
 *     uses (section=`ci-view-<blockId>`) — order, plate, excerpt and paper
 *     reference stay code-defined in constitutionalInternetBridgeViewContent
 *     .ts for this pass (operator instruction, 2026-08-11: narrow reuse now,
 *     full vignette CRUD is an explicit later follow-up, not this build).
 *
 *   CROSSINGS — a thin projection over the EXISTING, canonical Qriptopian
 *     Pulse infrastructure (community_generated_content via
 *     KnytCommunityContentTab, cartridge='qripto'), filtered to this
 *     journey's own campaign tag. No new feed, table, moderation queue or
 *     approval workflow — a published Personify Article/Story lands here
 *     through the exact same myCanvas → Pulse pipeline KNYTS already uses,
 *     just pointed at Qriptopian instead of KNYT (see
 *     ConstitutionalInternetBridgePersonifyMyCanvas). Ethos carries no
 *     All/Mine split (it is official, canonical content); Crossings does,
 *     via KnytCommunityContentTab's own All/Mine chips — its own
 *     self-service "Crossings" chip is suppressed here (hideCrossingsFilter)
 *     so it can never override this projection back to KNYTS' own campaign.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

function EthosVignette({ block, videoOverride }: { block: ViewContentBlock; videoOverride?: string | null }) {
  const plate = plateByNumber(block.plateNumber);
  const videoUrl = videoOverride ?? block.videoUrl;
  return (
    <div className="w-full shrink-0 px-1">
      <div className="h-full rounded-2xl border border-white/10 bg-slate-900/40 overflow-hidden">
        {/* Hero tier — video (admin-overridable) + plate */}
        {videoUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video className="w-full" controls src={videoUrl} />
        )}
        <div className="p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-indigo-400 mb-3">{block.proposition}</p>
          {plate && (
            <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
              <CanonicalPlateFigure plate={plate} />
            </div>
          )}
          {/* Supporting-context tier — the excerpt, visually secondary to the hero */}
          <blockquote className="whitespace-pre-line border-l-2 border-indigo-400/40 pl-4 text-sm italic leading-relaxed text-slate-300">
            {block.excerpt}
          </blockquote>
          <p className="mt-2 text-[10px] text-slate-600">The Constitutional Internet — {block.excerptSource}</p>
          {/* Deep-dive tier — optional Polity Paper, visually tertiary, only when real */}
          {block.paperRef && (
            <a
              href={block.paperRef.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[11px] text-indigo-300/80 underline underline-offset-2 hover:text-indigo-200"
            >
              Deep dive — {block.paperRef.title}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EthosCarousel() {
  const [index, setIndex] = useState(0);
  const overrides = useVignetteVideoOverrides();
  const total = CI_BRIDGE_VIEW_CONTENT.length;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden">
        <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {CI_BRIDGE_VIEW_CONTENT.map((block) => (
            <EthosVignette key={block.id} block={block} videoOverride={overrides[block.id]} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
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
              onClick={() => setIndex(i)}
              aria-label={`Go to ${block.proposition}`}
              className={`h-1.5 w-1.5 rounded-full transition ${i === index ? 'bg-indigo-400' : 'bg-slate-700'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
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
        <EthosCarousel />
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
