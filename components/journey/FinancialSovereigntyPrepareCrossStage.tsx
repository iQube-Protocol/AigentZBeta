'use client';

/**
 * FinancialSovereigntyPrepareCrossStage — the PREPARE/CROSS segment of the
 * KNYTS/CI → Financial Services main spine (AEE-XP-001 §4.2-4.3, §5).
 * Bridge-neutral, composed by both KNYTS and CI — one implementation.
 *
 * PREPARE (rebuilt 2026-09-02, Bridge spec B2 — the operator's own
 * correction: "The legacy agent-candidate-selection step is an
 * implementation baseline to replace or relocate — it does not satisfy
 * the agreed Prepare experience"): the visitor reviews or establishes
 * their financial profile through the SAME canonical manual/upload
 * workflow the MoneyPenny cartridge's `financial-profile` panel already
 * implements (C-04–C-06) — reusing `fetchFinancialProfileSummary()`, the
 * SAME read `MoneyPennyCopilotWorkspace.tsx`'s groundContext uses (one
 * canonical profile, never a copied bridge snapshot — SC-03). Its
 * "Review my financial profile" action opens that exact panel IN PLACE
 * (`MoneyPennyBridgeEmbed`, experience-coherence correction, 2026-09-03 —
 * a real iframe embed, never `window.location.assign`; see that
 * component's own header for the mechanism), with a "← Back to Prepare
 * summary" affordance to collapse it again; "Continue to Operate" advances
 * via the SAME `journey:select-stage` mechanism this file already used, to
 * `nextStageId` — already wired to `fs-operate` in both journey
 * definitions (services/journey/constitutionalInternetBridgeJourney.ts,
 * knytsBridgeCrossingJourney.ts), so no journey-graph change was needed
 * here, only this stage's own content.
 *
 * Production learning pattern completion (2026-09-03) — Prepare's SUMMARY
 * view (embedOpen === false) now uses the same locked-viewport
 * BridgeMediaInteractionSection shell as Discover/Learn/Explore (real
 * P-I01 infographic + placeholder video, BridgeActivityGroupRail for
 * P-TOPIC-01/02/03 + P-Q01/02). This is the LIGHTER, production-safe
 * migration the operator asked for where a full activity decomposition
 * would risk the real functional workspace: the profile-status card and
 * its Review/Continue buttons stay exactly as they were — plain content in
 * the Learning Rail, not decomposed into capsules — and the moment the
 * embed opens (below), this component falls straight back to its own
 * pre-existing full-height, non-carousel layout. The embed is NEVER
 * mounted inside the media-rail composition, so switching media carousel
 * position or scrolling the Learning Rail can never remount or reset it.
 *
 * The legacy agent-candidate picker is retired from Prepare's primary
 * flow, per the Bridge spec's own B-13 migration guidance: "A previously
 * selected agent candidate can be retained as an optional advanced
 * preference; it cannot count as a reviewed financial profile." CROSS
 * mode (below) already handles an absent candidate gracefully ("You can
 * still cross without a chosen candidate") — that path is exercised now
 * by construction, not a new case.
 *
 * CROSS (media rail added 2026-09-03, same light-touch pattern; handoff
 * mechanism unchanged): builds an `ExperienceHandoff`
 * (types/experienceHandoff.ts) carrying any still-present session
 * candidate plus return context, and navigates to the Financial Services
 * Bridge with it encoded in the URL — no server round-trip, no new
 * persistence engine (see experienceHandoffService.ts's own header for
 * why).
 */

import { useCallback, useEffect, useState } from 'react';
import { createExperienceHandoff, encodeExperienceHandoff } from '@/services/journey/experienceHandoffService';
import { getJourneyBranchIntent } from '@/services/journey/journeyBranchActivation';
import { WALLET_CONVERSION_CAPABILITY_ID } from '@/services/financialServices/walletConversionCapability';
import { fetchFinancialProfileSummary, markFinancialProfileReviewed, type FinancialProfileSummary } from '@/services/moneypenny/financialProfileSummary';
import type { BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { BridgeMediaInteractionSection } from '@/components/journey/BridgeMediaInteractionSection';
import { BridgeActivityGroupRail } from '@/components/journey/BridgeActivityGroupRail';
import type { BridgeActivityGroup } from '@/services/journey/bridgeActivity';
import { MoneyPennyBridgeEmbed } from '@/components/journey/MoneyPennyBridgeEmbed';
import { FinancialSovereigntyCheckGroup } from '@/components/journey/FinancialSovereigntyCheckGroup';
import { FS_STAGE_CONTENT, resolveFsSectionContent, type FsBridge, type FsStructuredContent } from '@/services/journey/financialSovereigntyContent';
import { useFsBridgeSection } from '@/services/journey/useFsBridgeSection';
import { FS_PLACEHOLDER_VIDEO_LABEL } from '@/services/journey/fsPlaceholderVideo';
import { buildFsMediaItems } from '@/services/journey/fsCanonicalMedia';

const FINANCIAL_SERVICES_BRANCH = 'financial-services';
/** Fallback ONLY for a direct deep link into the branch that skipped the
 *  Choose trigger (so no intent was ever declared) — never fabricates a
 *  different intent than what was actually declared when one exists. */
const DEFAULT_FINANCIAL_SERVICES_INTENT = 'JOIN_FINANCIAL_SERVICES';

const SESSION_KEY_PREFIX = 'fsHandoffAgentCandidate:';

function selectStage(stageId: string) {
  try {
    window.dispatchEvent(new CustomEvent('journey:select-stage', { detail: { stageId } }));
  } catch {
    /* non-fatal */
  }
}

const ACCENT_BUTTON: Record<BridgeAccent, string> = {
  amber: 'border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20',
  indigo: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20',
};

/** Same "Placeholder video — ..." badge every FS stage's media pane uses —
 *  see FinancialSovereigntyIntroStage.tsx for the canonical original. */
const PLACEHOLDER_VIDEO_OVERLAY = (
  <span className="pointer-events-none absolute left-2 top-2 max-w-[85%] rounded-md border border-amber-400/40 bg-slate-950/85 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-200">
    {FS_PLACEHOLDER_VIDEO_LABEL}
  </span>
);

export function FinancialSovereigntyPrepareCrossStage({
  mode,
  accent,
  sourceJourneyId,
  sourceStageId,
  nextStageId,
  returnStageId,
  personaId,
}: {
  mode: 'prepare' | 'cross';
  accent: BridgeAccent;
  sourceJourneyId: string;
  sourceStageId: string;
  /** PREPARE: the Operate stage id to advance to once the profile is reviewed. CROSS: unused. */
  nextStageId?: string;
  /** CROSS only — the stage to resume this journey at on return from Financial Services. */
  returnStageId?: string;
  /** PREPARE only — resolves the profile summary and the MoneyPenny deep link. */
  personaId?: string | null;
}) {
  const sessionKey = `${SESSION_KEY_PREFIX}${sourceJourneyId}`;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSelected(window.sessionStorage.getItem(sessionKey));
    } catch {
      /* storage unavailable — proceeds with no pre-selected candidate */
    }
  }, [sessionKey]);

  const bridge: FsBridge = accent === 'indigo' ? 'ci' : 'knyts';
  // Called unconditionally (rules-of-hooks) even though only the 'cross'
  // branch below renders it — PrepareFinancialProfileReview fetches its own
  // 'prepare' section independently, so this one is Cross's.
  const crossFsConfig = useFsBridgeSection(bridge, 'cross');

  if (mode === 'prepare') {
    return (
      <PrepareFinancialProfileReview accent={accent} bridge={bridge} nextStageId={nextStageId} personaId={personaId} />
    );
  }

  // mode === 'cross'
  const handleCross = () => {
    const handoff = createExperienceHandoff({
      sourceJourneyId,
      sourceStageId,
      targetJourneyId: 'horizen-moneypenny',
      targetSurfaceRef: 'register-agent-panel',
      intent:
        getJourneyBranchIntent(sourceJourneyId, FINANCIAL_SERVICES_BRANCH) ?? DEFAULT_FINANCIAL_SERVICES_INTENT,
      agentCandidateRef: selected ?? undefined,
      // AEE-Next (2026-09-01) — capability READINESS carried across the
      // crossing, never an exercise of it: the real, registered CTP
      // primitive id, so the receiving journey can make the wallet-
      // conversion capability discoverable once the crossing completes.
      // This call performs no conversion and writes no ctp_transition_evidence.
      capabilityFocus: [WALLET_CONVERSION_CAPABILITY_ID],
      // The FS Bridge is a full persistent, copilot-enabled journey (its own
      // JourneyCopilotHost mount, multi-stage register→claim/orient/passport
      // →activate→delegate→operate spine) — the deepest tier of the
      // canonical depth ladder (DEPTH_LADDER in
      // services/invariants/nodes/journeyProgression.ts: pill < capsule <
      // mini_runtime < codex). Not a guess: this is the same vocabulary
      // applied to a destination whose own nature (persistent, copilot-
      // enabled) is exactly what that ladder's "codex" tier defines.
      recommendedExperienceAltitude: 'codex',
      // No experienceEvidenceRefs: every fs-* on-ramp stage's
      // completionEvidence is intentionally empty (gate-less segment — see
      // this journey's own header comment), so there is no real evidence to
      // reference yet. Left unset rather than fabricated.
      returnJourneyId: sourceJourneyId,
      returnStageId: returnStageId ?? sourceStageId,
      rationale: 'Progressive Financial Sovereignty on-ramp handoff (AEE-XP-001 §5).',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    const token = encodeExperienceHandoff(handoff);
    window.location.href = `/bridge/fs?handoff=${encodeURIComponent(token)}`;
  };

  const crossResolved = resolveFsSectionContent('cross', bridge, crossFsConfig?.structuredContent as FsStructuredContent | null | undefined);
  const crossItems = buildFsMediaItems(crossFsConfig, PLACEHOLDER_VIDEO_OVERLAY, [
    { assetRef: 'C-I01', title: FS_STAGE_CONTENT.cross.asset.title },
  ]);
  const crossGroups: BridgeActivityGroup[] = [
    {
      id: 'automation',
      title: 'What changes with automation',
      activities: crossResolved.topics.map((topic) => ({
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
          content: <FinancialSovereigntyCheckGroup checks={crossResolved.checks} label="Start" />,
        },
      ],
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
      <div className="min-h-0 flex-1">
        <BridgeMediaInteractionSection
          items={crossItems}
          emptyLabel="Infographic not yet published."
          eyebrow="Cross"
          headline="Ready for the Financial Services Bridge."
          lead={
            selected
              ? `You're bringing an agent candidate (${selected}). The Financial Services Bridge will register it under its own authority checks — nothing is registered yet.`
              : 'You can still cross without a chosen candidate — the Financial Services Bridge will let you pick one there.'
          }
        >
          {crossResolved.contextualLine && <p className="text-xs text-slate-400">{crossResolved.contextualLine}</p>}
          <BridgeActivityGroupRail groups={crossGroups} />
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCross}
              className={`rounded-xl border px-6 py-3 text-sm font-semibold transition ${ACCENT_BUTTON[accent]}`}
            >
              Cross to Financial Services →
            </button>
          </div>
        </BridgeMediaInteractionSection>
      </div>
    </div>
  );
}

/**
 * B2 Prepare content (2026-09-02) — Bridge spec B-08: "Prepare is
 * financial-profile setup... Bring information, review extraction,
 * understand my position, personalize, review readiness." Reuses the
 * SAME canonical profile `fetchFinancialProfileSummary()` reads (the
 * exact fetch `MoneyPennyCopilotWorkspace.tsx`'s own groundContext uses)
 * — the review evidence here IS the reviewed-profile evidence MoneyPenny
 * itself already shows, never a second copy.
 */
function PrepareFinancialProfileReview({
  accent,
  bridge,
  nextStageId,
  personaId,
}: {
  accent: BridgeAccent;
  bridge: FsBridge;
  nextStageId?: string;
  personaId?: string | null;
}) {
  const fsConfig = useFsBridgeSection(bridge, 'prepare');
  const [summary, setSummary] = useState<FinancialProfileSummary | null | undefined>(undefined);
  const [marking, setMarking] = useState(false);
  // MoneyPenny experience-coherence correction (2026-09-03) — replaces the
  // navigate-away `window.location.assign` with an in-place embed toggle.
  // Refetch on close so a profile reviewed/edited inside the embed is
  // reflected in this stage's own summary immediately.
  const [embedOpen, setEmbedOpen] = useState(false);

  const refetch = useCallback(() => {
    void fetchFinancialProfileSummary().then((s) => setSummary(s));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchFinancialProfileSummary().then((s) => {
      if (!cancelled) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openFinancialProfile = () => {
    setEmbedOpen(true);
  };

  const closeFinancialProfile = () => {
    setEmbedOpen(false);
    refetch();
  };

  // Continue to Operate is NEVER gated on review — "users may continue to
  // appropriate learning or simulation" regardless of whether they've
  // reviewed their profile yet (operator directive, 2026-09-02). Only the
  // recorded EVIDENCE (hasPreparedFinancialProfile) differs by review state.
  const handleContinueToOperate = () => {
    if (nextStageId) selectStage(nextStageId);
  };

  // The ONLY caller of markFinancialProfileReviewed — a real button click,
  // never inferred from this component mounting/fetching the summary above.
  const handleMarkReviewed = async () => {
    setMarking(true);
    try {
      const ok = await markFinancialProfileReviewed();
      if (ok) refetch();
    } finally {
      setMarking(false);
    }
  };

  const loading = summary === undefined;
  const hasProfile = summary?.hasProfile === true;
  const isReviewed = hasProfile && summary?.reviewedAt != null;

  // MoneyPenny experience-coherence correction (2026-09-03) — "Review my
  // financial profile" opens the canonical MoneyPenny workspace IN PLACE
  // (MoneyPennyBridgeEmbed) rather than navigating the bridge away. The
  // stepper, this stage's own copy, and "Continue to Operate" all stay
  // reachable while the embed is open. This branch is deliberately OUTSIDE
  // the media-rail/BridgeMediaInteractionSection composition below — the
  // real workspace gets the full viewport, never squeezed beside a video,
  // and toggling embedOpen never touches the summary view's own state.
  if (embedOpen) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={closeFinancialProfile}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to Prepare summary
          </button>
          <button
            type="button"
            onClick={handleContinueToOperate}
            className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:opacity-80"
          >
            Continue to Operate
          </button>
        </div>
        <MoneyPennyBridgeEmbed tab="my-money" personaId={personaId} className="min-h-0 w-full flex-1 rounded-md border border-slate-800 bg-slate-950" />
      </div>
    );
  }

  const resolved = resolveFsSectionContent('prepare', bridge, fsConfig?.structuredContent as FsStructuredContent | null | undefined);
  const prepareItems = buildFsMediaItems(fsConfig, PLACEHOLDER_VIDEO_OVERLAY, [
    { assetRef: 'P-I01', title: FS_STAGE_CONTENT.prepare.asset.title },
  ]);
  const prepareGroups: BridgeActivityGroup[] = [
    {
      id: 'priorities',
      title: 'Your position and priorities',
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
          items={prepareItems}
          emptyLabel="Infographic not yet published."
          eyebrow="Prepare"
          headline="What is my financial position, and what do I want help with?"
          lead="Bring statements, or enter a limited profile manually — either way, MoneyPenny explains what is understood and what is still missing. This is preparation evidence, not permission to trade."
        >
          {/* The real, functional profile-status card — untouched content,
              never decomposed into a capsule (it is live data, not a
              lesson alternative). */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left">
            {loading && <p className="text-sm text-slate-400">Checking your financial profile…</p>}
            {!loading && !hasProfile && (
              <p className="text-sm text-slate-300">
                No financial profile reviewed yet. Understanding coverage, corrections and limitations happens in
                MoneyPenny's Financial Profile capsule.
              </p>
            )}
            {!loading && hasProfile && (
              <div className="space-y-2">
                <p className={`text-sm font-medium ${isReviewed ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {isReviewed ? 'Profile reviewed' : 'Profile computed — not yet reviewed'}
                </p>
                <p className="text-xs text-slate-400">
                  Source: {summary?.inputSource === 'manual_entry' ? 'manual entry' : 'uploaded statements'}
                  {summary?.computedFromMonths && summary.computedFromMonths.length > 0
                    ? ` · ${summary.computedFromMonths.length} month${summary.computedFromMonths.length === 1 ? '' : 's'} of coverage`
                    : ''}
                </p>
                {summary?.inputSource === 'manual_entry' && (
                  <p className="text-xs text-amber-300">
                    Limitation: a manually-entered profile may not reflect your full financial picture. Upload
                    statements for fuller coverage when you can.
                  </p>
                )}
                {(summary?.incomeMonthly != null || summary?.expenditureMonthly != null || summary?.availableSurplusMonthly != null) && (
                  <dl className="grid grid-cols-3 gap-2 pt-1 text-xs text-slate-300">
                    <div>
                      <dt className="text-slate-500">Income/mo</dt>
                      <dd>{summary?.incomeMonthly != null ? summary.incomeMonthly.toFixed(0) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Spend/mo</dt>
                      <dd>{summary?.expenditureMonthly != null ? summary.expenditureMonthly.toFixed(0) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Surplus/mo</dt>
                      <dd>{summary?.availableSurplusMonthly != null ? summary.availableSurplusMonthly.toFixed(0) : '—'}</dd>
                    </div>
                  </dl>
                )}
                {!isReviewed && (
                  <button
                    type="button"
                    onClick={() => void handleMarkReviewed()}
                    disabled={marking}
                    className="mt-2 w-full rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-50"
                  >
                    {marking ? 'Marking reviewed…' : "I've reviewed this — mark as reviewed"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openFinancialProfile}
              className={`rounded-xl border px-6 py-3 text-sm font-semibold transition ${ACCENT_BUTTON[accent]}`}
            >
              {hasProfile ? 'Review / update my financial profile →' : 'Review my financial profile →'}
            </button>
            <button
              type="button"
              onClick={handleContinueToOperate}
              className="rounded-xl border border-slate-700 bg-slate-900/40 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:opacity-80"
            >
              Continue to Operate
            </button>
          </div>

          {resolved.contextualLine && <p className="text-xs text-slate-400">{resolved.contextualLine}</p>}
          <BridgeActivityGroupRail groups={prepareGroups} />
        </BridgeMediaInteractionSection>
      </div>
    </div>
  );
}

export default FinancialSovereigntyPrepareCrossStage;
