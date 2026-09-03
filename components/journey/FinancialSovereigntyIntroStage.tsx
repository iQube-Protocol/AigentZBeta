'use client';

/**
 * FinancialSovereigntyIntroStage — the DISCOVER/LEARN/EXPLORE segment of the
 * KNYTS/CI → Financial Services main spine (AEE-XP-001 §4.2). Bridge-neutral
 * (KNYTS passes accent="amber", CI passes accent="indigo") — ONE
 * implementation composed by both, never forked.
 *
 * Production learning pattern (2026-09-03, "lesson composition system" pass)
 * — each stage is now a locked split viewport:
 *   - LEFT: `BridgeMediaCarouselPane` (via `BridgeMediaInteractionSection`) —
 *     the placeholder video first, then the stage's REAL canonical
 *     infographic(s) (`services/journey/fsCanonicalMedia.ts`, resolved
 *     from `codex_media_assets` — the same production asset catalog
 *     KNYT/Qriptopian canonical plates already use). Spatially fixed; never
 *     scrolls, never disappears while the lesson is read.
 *   - RIGHT: the "Learning Rail" — intro copy plus `BridgeActivityGroupRail`,
 *     a stack of horizontally-scrollable `BridgeActivityCarousel` groups
 *     (`services/journey/bridgeActivity.ts`). Vertical position = progress
 *     through the lesson; horizontal position within a group = alternative
 *     activities at that lesson moment. Every activity capsule stays
 *     mounted for the group's lifetime (see BridgeActivityCarousel's own
 *     header), so scrolling never resets a slider, a selected answer, or an
 *     acknowledged concept.
 * EXPLORE additionally projects the REAL canonical Financial Services
 * catalogue (`services/financialServices/serviceCatalog.ts`) as its own
 * capability activity group — never a second, hand-authored service list.
 *
 * AEE-XP-001 §10/XP-6 (2026-09-01) — the first live DCIR adopter on the
 * generic experience-evidence loop. `useDcirSeam` observes the "Continue"
 * interaction (the SAME generic DCIR constructor every other adopter uses,
 * `aigentMeCapsuleEngagedEvent` — no new DCIR event kind), then
 * `promoteExperienceObservation`'s HTTP boundary
 * (`POST /api/journey/experience-observation`) writes ONE durable
 * `experience_interaction_observed` receipt, then the SAME
 * `journey:select-stage` event this file already dispatches now also
 * carries `trigger: 'stage-satisfaction-evidence-change'` — the existing,
 * previously-unfired re-evaluation trigger
 * (services/adaptive/journeyReEvaluationTrigger.ts) — so
 * JourneyRunSurface's existing listener refetches authoritative state
 * immediately. DCIR observation itself is NEVER durable constitutional
 * truth on its own; only the explicit promotion call below writes evidence.
 *
 * LEARN/EXPLORE evidence (2026-09-01) — DISCOVER's bar (any observed
 * Continue) stays deliberately weak. LEARN and EXPLORE reuse the SAME
 * generic promotion mechanism but require a STRONGER, kind-discriminated
 * basis (`hasQualifyingExperienceInteraction`, never plain presence):
 *   - LEARN requires all three FS concept cards (Advisor/Architect/Runtime)
 *     to be individually acknowledged before Continue is even clickable.
 *   - EXPLORE requires at least one REAL MoneyPenny capability from the
 *     canonical `serviceCatalog` to be interacted with (clicked open).
 * Both gate the primary CTA client-side AND are re-checked server-side by
 * the Journey Spine's own `completionEvidence` — the client gate is a UX
 * convenience, never the actual authority.
 *
 * AEE-Next (2026-09-01) — "Try it — Compute your Financial Profile" calls
 * the real `POST /api/moneypenny/financial-profile/compute` (MPY2-2/3,
 * already deployed) and records its REAL result as `outcome` on the
 * observation receipt — never a fabricated success.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { BridgeMediaInteractionSection } from '@/components/journey/BridgeMediaInteractionSection';
import type { BridgeMediaCarouselItem } from '@/components/journey/BridgeMediaCarouselPane';
import { BridgeActivityGroupRail } from '@/components/journey/BridgeActivityGroupRail';
import type { BridgeActivityGroup } from '@/services/journey/bridgeActivity';
import { FinancialSovereigntyCheckGroup } from '@/components/journey/FinancialSovereigntyCheckGroup';
import { FinancialSovereigntyCostExample } from '@/components/journey/FinancialSovereigntyCostExample';
import {
  FS_PLACEHOLDER_VIDEO_URL,
  FS_PLACEHOLDER_VIDEO_POSTER_URL,
  FS_PLACEHOLDER_VIDEO_LABEL,
} from '@/services/journey/fsPlaceholderVideo';
import { resolveFsCanonicalInfographicUrl } from '@/services/journey/fsCanonicalMedia';
import { listFinancialServiceDefinitions } from '@/services/financialServices/serviceCatalog';
import { useDcirSeam } from '@/services/dcir/useDcirSeam';
import { aigentMeCapsuleEngagedEvent } from '@/services/dcir/eventStream';
import { personaFetch } from '@/utils/personaSpine';
import { personaFetchDeadline } from '@/utils/personaSpine';
import {
  FS_STAGE_CONTENT,
  FS_LEARN_PLATES,
  resolveFsSectionContent,
  resolveFsLearnPlateContent,
  type FsBridge,
  type FsStructuredContent,
} from '@/services/journey/financialSovereigntyContent';
import { useFsBridgeSection, useFsLearnPlateSection } from '@/services/journey/useFsBridgeSection';

/** Discover's starting-point interaction — purely local UI state (N7: never
 *  computes a profile, submits a transaction, or changes journey evidence
 *  on its own). Distinct ids from every other FS interaction set. */
const DISCOVER_STARTING_POINTS: { id: string; label: string }[] = [
  { id: 'spending', label: 'Get a clearer view of my spending' },
  { id: 'fiat-crypto', label: 'Understand fiat vs crypto' },
  { id: 'big-decision', label: 'Prepare for a bigger financial decision' },
  { id: 'exploring', label: 'Just exploring' },
];

/**
 * LEARN's qualifying concept set — mirrors the Advisor/Architect/Runtime
 * axis the FS spec and serviceCatalog already use. Stable ids only (never
 * derived from display copy), since they are written as `capabilityId` on
 * the durable receipt and read back by `hasQualifyingExperienceInteraction`.
 */
const LEARN_CONCEPTS: { id: string; label: string; body: string }[] = [
  { id: 'advisor', label: 'Advisor', body: 'An advisor explains — informational only, never a commitment.' },
  { id: 'architect', label: 'Architect', body: 'An architect proposes — a concrete plan you review, not yet executed.' },
  { id: 'runtime', label: 'Runtime', body: 'Only a runtime action — one you authorize — actually changes anything, and only after a governed consequence check. Every consequential act is recorded as a receipt.' },
];

const LEARN_INTERACTION_KIND = 'learn-concept-acknowledged';
const EXPLORE_INTERACTION_KIND = 'moneypenny-capability-interacted';

export type FinancialSovereigntyIntroStageKey = 'discover' | 'learn' | 'explore';

function selectStage(stageId: string, trigger?: 'stage-satisfaction-evidence-change') {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId, trigger } }));
  } catch {
    /* non-fatal */
  }
}

/**
 * Fire-and-forget promotion call — never blocks navigation. A failed
 * observation write means the Journey Spine simply doesn't see this
 * evidence yet; it does not block the operator from continuing, exactly
 * like the AEE `aee` projection's own fall-open contract.
 *
 * `/api/journey/experience-observation` resolves the caller through
 * `getActivePersona` — a spine endpoint (CLAUDE.md "Client-side spine
 * fetches") — so this MUST go through `personaFetch`, never raw `fetch`.
 */
function observeExperienceInteraction(
  journeyId: string,
  stageId: string,
  surfaceRef: string,
  personaIdHint?: string,
  interactionKind?: string,
  capabilityId?: string,
  outcome?: Record<string, unknown> | null,
) {
  try {
    void personaFetch('/api/journey/experience-observation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journeyId, stageId, surfaceRef, interactionKind, capabilityId, outcome }),
      personaIdHint,
    }).catch(() => {
      /* non-fatal — fall-open, see header comment */
    });
  } catch {
    /* non-fatal */
  }
}

/** AEE-Next (2026-09-01) — the one live capability EXPLORE actually
 *  triggers. See file header. Distinct id from `serviceCatalog`'s four
 *  entries (never collides with a real `FinancialServiceDefinition.id`). */
const LIVE_TRY_CAPABILITY_ID = 'financial-profile-live';

type TryFinancialProfileStatus = 'idle' | 'loading' | 'produced' | 'no-data' | 'error';

function resolveCopy(
  stageKey: FinancialSovereigntyIntroStageKey,
  config: { headline: string | null; shortCopy: string | null } | null,
): { eyebrow: string; headline: string; paragraphs: string[] } {
  const fallback = FS_STAGE_CONTENT[stageKey];
  return {
    eyebrow: fallback.eyebrow,
    headline: config?.headline || fallback.headline,
    paragraphs: [config?.shortCopy || fallback.lead],
  };
}

/** Video-first item, then the stage's real canonical infographic(s) — the
 *  order the operator's own acceptance criteria specify ("see the
 *  placeholder video... horizontally advance to the real infographic(s)").
 *  An admin-published `infographicUrl` (per fsConfig) still overrides the
 *  canonical fallback; the placeholder video is unconditionally real and
 *  labeled — never swapped for a fabricated "final" video. */
function buildMediaItems(
  fsConfig: { videoUrl?: string | null; posterUrl?: string | null; infographicUrl?: string | null } | null | undefined,
  placeholderVideoOverlay: ReactNode,
  infographics: { assetRef: string; title: string }[],
): BridgeMediaCarouselItem[] {
  const usingPlaceholderVideo = !fsConfig?.videoUrl;
  const items: BridgeMediaCarouselItem[] = [
    {
      kind: 'video',
      videoUrl: fsConfig?.videoUrl || FS_PLACEHOLDER_VIDEO_URL,
      posterUrl: (fsConfig?.videoUrl ? fsConfig?.posterUrl : FS_PLACEHOLDER_VIDEO_POSTER_URL) ?? undefined,
      overlay: usingPlaceholderVideo ? placeholderVideoOverlay : undefined,
    },
  ];
  infographics.forEach(({ assetRef, title }, i) => {
    // Admin override (fsConfig.infographicUrl) only applies to the FIRST
    // infographic slot — every stage's own admin-editable section has
    // exactly one infographicUrl field; Learn's extra plates (2/3) are
    // resolved by the caller via their own per-plate fsConfig instead (see
    // the 'learn' branch below), never guessed here.
    const url = (i === 0 ? fsConfig?.infographicUrl : null) || resolveFsCanonicalInfographicUrl(assetRef);
    if (url) items.push({ kind: 'plate', url, title });
  });
  return items;
}

export function FinancialSovereigntyIntroStage({
  stageKey,
  accent,
  nextStageId,
  journeyId,
  personaId,
}: {
  stageKey: FinancialSovereigntyIntroStageKey;
  accent: BridgeAccent;
  nextStageId: string;
  journeyId?: string;
  personaId?: string | null;
}) {
  const bridge: FsBridge = accent === 'indigo' ? 'ci' : 'knyts';
  const fsConfig = useFsBridgeSection(bridge, stageKey);
  // Unconditional per rules-of-hooks; only consumed when stageKey === 'learn'.
  const learnPlate2Config = useFsLearnPlateSection(bridge, 1);
  const learnPlate3Config = useFsLearnPlateSection(bridge, 2);
  const copy = resolveCopy(stageKey, fsConfig);
  const services = stageKey === 'explore' ? listFinancialServiceDefinitions() : [];
  const stageId = `fs-${stageKey}`;

  const { observe } = useDcirSeam({ surface: 'financial-sovereignty-intro', workflowStage: stageKey });

  const [acknowledgedConcepts, setAcknowledgedConcepts] = useState<Set<string>>(new Set());
  const [interactedCapabilities, setInteractedCapabilities] = useState<Set<string>>(new Set());
  const [tryStatus, setTryStatus] = useState<TryFinancialProfileStatus>('idle');
  const [tryDetail, setTryDetail] = useState<string | null>(null);
  const [discoverStartingPoint, setDiscoverStartingPoint] = useState<string | null>(null);

  const handleConceptAcknowledge = useCallback(
    (conceptId: string) => {
      setAcknowledgedConcepts((prev) => (prev.has(conceptId) ? prev : new Set(prev).add(conceptId)));
      observe(aigentMeCapsuleEngagedEvent(`${stageId}:${conceptId}`));
      if (journeyId) {
        observeExperienceInteraction(
          journeyId,
          stageId,
          `financial-sovereignty-intro:learn:${conceptId}`,
          personaId ?? undefined,
          LEARN_INTERACTION_KIND,
          conceptId,
        );
      }
    },
    [observe, stageId, journeyId, personaId],
  );

  const handleCapabilityInteract = useCallback(
    (capabilityId: string) => {
      setInteractedCapabilities((prev) => (prev.has(capabilityId) ? prev : new Set(prev).add(capabilityId)));
      observe(aigentMeCapsuleEngagedEvent(`${stageId}:${capabilityId}`));
      if (journeyId) {
        observeExperienceInteraction(
          journeyId,
          stageId,
          `financial-sovereignty-intro:explore:${capabilityId}`,
          personaId ?? undefined,
          EXPLORE_INTERACTION_KIND,
          capabilityId,
        );
      }
    },
    [observe, stageId, journeyId, personaId],
  );

  const handleTryFinancialProfile = useCallback(async () => {
    setTryStatus('loading');
    setTryDetail(null);
    setInteractedCapabilities((prev) => (prev.has(LIVE_TRY_CAPABILITY_ID) ? prev : new Set(prev).add(LIVE_TRY_CAPABILITY_ID)));
    observe(aigentMeCapsuleEngagedEvent(`${stageId}:${LIVE_TRY_CAPABILITY_ID}`));

    let outcome: Record<string, unknown>;
    try {
      const res = await personaFetchDeadline(
        '/api/moneypenny/financial-profile/compute',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          personaIdHint: personaId ?? undefined,
        },
        20000,
      );
      const json = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (json?.ok) {
        setTryStatus('produced');
        setTryDetail(
          `Computed from ${json.readableUploadCount ?? 0} statement(s)` +
            (json.riskAssessment ? ' — risk factors assessed.' : '.'),
        );
        outcome = {
          status: 'produced',
          readableUploadCount: json.readableUploadCount ?? null,
          unreadableUploadCount: json.unreadableUploadCount ?? null,
          hasRiskAssessment: Boolean(json.riskAssessment),
        };
      } else if (json?.error === 'no-financial-documents') {
        setTryStatus('no-data');
        setTryDetail(json.detail ?? 'No bank statements uploaded yet.');
        outcome = { status: 'no-data', reason: json.error };
      } else {
        setTryStatus('error');
        setTryDetail('The compute call did not complete.');
        outcome = { status: 'failed', reason: typeof json?.error === 'string' ? json.error : 'unknown' };
      }
    } catch {
      setTryStatus('error');
      setTryDetail('The compute call did not complete.');
      outcome = { status: 'failed', reason: 'network-or-runtime-error' };
    }

    if (journeyId) {
      observeExperienceInteraction(
        journeyId,
        stageId,
        `financial-sovereignty-intro:explore:${LIVE_TRY_CAPABILITY_ID}`,
        personaId ?? undefined,
        EXPLORE_INTERACTION_KIND,
        LIVE_TRY_CAPABILITY_ID,
        outcome,
      );
    }
  }, [observe, stageId, journeyId, personaId]);

  const learnSatisfied = useMemo(
    () => LEARN_CONCEPTS.every((c) => acknowledgedConcepts.has(c.id)),
    [acknowledgedConcepts],
  );
  const exploreSatisfied = interactedCapabilities.size > 0;

  const handlePrimaryCta = useCallback(() => {
    observe(aigentMeCapsuleEngagedEvent(stageId));
    if (journeyId) {
      observeExperienceInteraction(journeyId, stageId, `financial-sovereignty-intro:${stageKey}`, personaId ?? undefined);
    }
    selectStage(nextStageId, 'stage-satisfaction-evidence-change');
  }, [observe, stageId, journeyId, stageKey, personaId, nextStageId]);

  const primaryCtaDisabled =
    (stageKey === 'learn' && !learnSatisfied) || (stageKey === 'explore' && !exploreSatisfied);

  const accentButtonClass =
    accent === 'indigo' ? 'bg-indigo-500 hover:bg-indigo-400 text-slate-950' : 'bg-amber-500 hover:bg-amber-400 text-slate-950';

  const continueFooter = (
    <div className="flex shrink-0 justify-end pt-3">
      <button
        type="button"
        onClick={handlePrimaryCta}
        disabled={primaryCtaDisabled}
        className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${accentButtonClass} ${
          primaryCtaDisabled ? 'cursor-not-allowed opacity-40' : ''
        }`}
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  const placeholderVideoOverlay = (
    <span className="pointer-events-none absolute left-2 top-2 max-w-[85%] rounded-md border border-amber-400/40 bg-slate-950/85 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-200">
      {FS_PLACEHOLDER_VIDEO_LABEL}
    </span>
  );

  if (stageKey === 'discover') {
    const resolved = resolveFsSectionContent('discover', bridge, fsConfig?.structuredContent as FsStructuredContent | null | undefined);
    const items = buildMediaItems(fsConfig, placeholderVideoOverlay, [
      { assetRef: 'D-I01', title: FS_STAGE_CONTENT.discover.asset.title },
    ]);

    const groups: BridgeActivityGroup[] = [
      {
        id: 'starting-point',
        activities: [
          {
            id: 'starting-point',
            type: 'reflection',
            title: 'What brings you here today?',
            content: (
              <div className="flex flex-wrap gap-1.5">
                {DISCOVER_STARTING_POINTS.map((opt) => {
                  const active = discoverStartingPoint === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDiscoverStartingPoint(opt.id)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        active
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ),
            completion: discoverStartingPoint ? 'complete' : 'incomplete',
          },
        ],
      },
      {
        id: 'basics',
        title: 'The financial landscape',
        activities: resolved.topics.map((topic) => ({
          id: topic.id,
          type: 'example',
          title: topic.title,
          content: <p className="text-xs text-slate-400">{topic.body}</p>,
        })),
      },
      {
        id: 'checks',
        title: 'Check your understanding',
        activities: [
          {
            id: 'checks',
            type: 'knowledge-check',
            title: 'Quick check',
            content: <FinancialSovereigntyCheckGroup checks={resolved.checks} label="Start" />,
          },
        ],
      },
    ];

    return (
      <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
        <div className="min-h-0 flex-1">
          <BridgeMediaInteractionSection
            items={items}
            emptyLabel="Infographic not yet published."
            eyebrow={copy.eyebrow}
            headline={copy.headline}
            lead={copy.paragraphs[0]}
          >
            {resolved.contextualLine && <p className="text-xs text-slate-400">{resolved.contextualLine}</p>}
            <BridgeActivityGroupRail groups={groups} />
          </BridgeMediaInteractionSection>
        </div>
        {continueFooter}
      </div>
    );
  }

  if (stageKey === 'explore') {
    const resolved = resolveFsSectionContent('explore', bridge, fsConfig?.structuredContent as FsStructuredContent | null | undefined);
    const items = buildMediaItems(fsConfig, placeholderVideoOverlay, [
      { assetRef: 'E-I01', title: FS_STAGE_CONTENT.explore.asset.title },
    ]);
    const [goalTopic, comparisonTopic, rehearsalTopic] = resolved.topics;

    const groups: BridgeActivityGroup[] = [
      {
        id: 'try-the-thinking',
        title: 'Try the thinking',
        activities: [
          goalTopic && { id: goalTopic.id, type: 'goal-selection' as const, title: goalTopic.title, content: <p className="text-xs text-slate-400">{goalTopic.body}</p> },
          comparisonTopic && { id: comparisonTopic.id, type: 'comparison' as const, title: comparisonTopic.title, content: <p className="text-xs text-slate-400">{comparisonTopic.body}</p> },
          rehearsalTopic && { id: rehearsalTopic.id, type: 'simulation' as const, title: rehearsalTopic.title, content: <FinancialSovereigntyCostExample /> },
        ].filter((a): a is NonNullable<typeof a> => Boolean(a)),
      },
      {
        id: 'checks',
        title: 'Check your understanding',
        activities: [
          {
            id: 'checks',
            type: 'knowledge-check',
            title: 'Quick check',
            content: <FinancialSovereigntyCheckGroup checks={resolved.checks} label="Start" />,
          },
        ],
      },
      {
        id: 'capabilities',
        title: 'Available capabilities',
        activities: [
          ...services.map((service) => ({
            id: service.serviceId,
            type: 'capability' as const,
            title: service.displayName,
            description: `${service.providerMode} capability`,
            content: (
              <button
                type="button"
                onClick={() => handleCapabilityInteract(service.serviceId)}
                aria-pressed={interactedCapabilities.has(service.serviceId)}
                className="text-xs font-medium text-slate-300 underline decoration-dotted underline-offset-2 hover:text-white"
              >
                {interactedCapabilities.has(service.serviceId) ? 'Viewed' : 'Tap to view'}
              </button>
            ),
            completion: (interactedCapabilities.has(service.serviceId) ? 'complete' : 'incomplete') as 'complete' | 'incomplete',
          })),
          {
            id: LIVE_TRY_CAPABILITY_ID,
            type: 'action',
            title: 'Compute your Financial Profile',
            description: 'A real, live call — not a preview.',
            content: (
              <button
                type="button"
                onClick={() => void handleTryFinancialProfile()}
                disabled={tryStatus === 'loading'}
                className="text-xs font-medium text-slate-300 underline decoration-dotted underline-offset-2 hover:text-white disabled:opacity-60"
              >
                {tryStatus === 'loading' ? 'Computing…' : tryDetail ?? 'Run it'}
              </button>
            ),
            completion: interactedCapabilities.has(LIVE_TRY_CAPABILITY_ID) ? 'complete' : 'incomplete',
          },
        ],
      },
    ];

    return (
      <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
        <div className="min-h-0 flex-1">
          <BridgeMediaInteractionSection
            items={items}
            emptyLabel="Infographic not yet published."
            eyebrow={copy.eyebrow}
            headline={copy.headline}
            lead={copy.paragraphs[0]}
          >
            {resolved.contextualLine && <p className="text-xs text-slate-400">{resolved.contextualLine}</p>}
            <BridgeActivityGroupRail groups={groups} />
          </BridgeMediaInteractionSection>
        </div>
        {continueFooter}
      </div>
    );
  }

  // LEARN — one locked-viewport section: the carousel carries the video plus
  // all three real lesson infographics (L-I01/02/03); the Learning Rail
  // groups the three lessons' topics as example capsules, the existing
  // Advisor/Architect/Runtime picker as its own acknowledge-gated capsule
  // group (unchanged evidence semantics — learnSatisfied still requires all
  // three), and the combined understanding checks last.
  const plate0 = resolveFsLearnPlateContent(0, fsConfig?.structuredContent as FsStructuredContent | null | undefined);
  const plate1 = resolveFsLearnPlateContent(1, learnPlate2Config?.structuredContent as FsStructuredContent | null | undefined);
  const plate2 = resolveFsLearnPlateContent(2, learnPlate3Config?.structuredContent as FsStructuredContent | null | undefined);
  const learnItems = buildMediaItems(fsConfig, placeholderVideoOverlay, [
    { assetRef: FS_LEARN_PLATES[0].assetRef, title: plate0.lessonLabel },
    { assetRef: FS_LEARN_PLATES[1].assetRef, title: plate1.lessonLabel },
    { assetRef: FS_LEARN_PLATES[2].assetRef, title: plate2.lessonLabel },
  ]);
  // Learn's later plates each have their own admin-editable section
  // (fs-learn-2/fs-learn-3) — buildMediaItems only applies fsConfig's own
  // override to slot 0, so splice in plates 2/3's own admin overrides here.
  if (learnPlate2Config?.infographicUrl && learnItems[2]) learnItems[2] = { ...learnItems[2], url: learnPlate2Config.infographicUrl } as BridgeMediaCarouselItem;
  if (learnPlate3Config?.infographicUrl && learnItems[3]) learnItems[3] = { ...learnItems[3], url: learnPlate3Config.infographicUrl } as BridgeMediaCarouselItem;

  const allLearnTopics = [...plate0.topics, ...plate1.topics, ...plate2.topics];
  const allLearnChecks = [...plate0.checks, ...plate1.checks, ...plate2.checks];

  const learnGroups: BridgeActivityGroup[] = [
    {
      id: 'lesson-topics',
      title: 'What money helps you do',
      activities: allLearnTopics.map((topic) => ({
        id: topic.id,
        type: 'example',
        title: topic.title,
        content: <p className="text-xs text-slate-400">{topic.body}</p>,
      })),
    },
    {
      id: 'agents',
      title: 'You, AgentMe and MoneyPenny',
      activities: LEARN_CONCEPTS.map((concept) => {
        const acknowledged = acknowledgedConcepts.has(concept.id);
        return {
          id: concept.id,
          type: 'reflection' as const,
          title: concept.label,
          content: (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">{concept.body}</p>
              <button
                type="button"
                onClick={() => handleConceptAcknowledge(concept.id)}
                aria-pressed={acknowledged}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  acknowledged
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                }`}
              >
                {acknowledged ? 'Acknowledged' : 'Got it'}
              </button>
            </div>
          ),
          completion: (acknowledged ? 'complete' : 'incomplete') as 'complete' | 'incomplete',
        };
      }),
    },
    {
      id: 'checks',
      title: 'Check your understanding',
      activities: [
        {
          id: 'checks',
          type: 'knowledge-check',
          title: 'Quick check',
          content: <FinancialSovereigntyCheckGroup checks={allLearnChecks} label="Start" />,
        },
      ],
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
      <div className="min-h-0 flex-1">
        <BridgeMediaInteractionSection
          items={learnItems}
          emptyLabel="Infographic not yet published."
          eyebrow={copy.eyebrow}
          headline={copy.headline}
          lead={copy.paragraphs[0]}
        >
          <BridgeActivityGroupRail groups={learnGroups} />
        </BridgeMediaInteractionSection>
      </div>
      {continueFooter}
    </div>
  );
}

export default FinancialSovereigntyIntroStage;
