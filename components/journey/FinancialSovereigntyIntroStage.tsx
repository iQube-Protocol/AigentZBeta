'use client';

/**
 * FinancialSovereigntyIntroStage — the DISCOVER/LEARN/EXPLORE segment of the
 * KNYTS/CI → Financial Services main spine (AEE-XP-001 §4.2). Bridge-neutral
 * (KNYTS passes accent="amber", CI passes accent="indigo") — ONE
 * implementation composed by both, never forked, exactly like
 * `BridgeOrientSurface`/`BridgeMediaStage` already are for ORIENT/HOME.
 *
 * Reuses `BridgeMediaStage` directly (the same generic shell HOME/ORIENT use
 * elsewhere in both bridges) rather than a bespoke layout. EXPLORE
 * additionally projects the REAL canonical Financial Services catalogue
 * (`services/financialServices/serviceCatalog.ts`) — never a second,
 * hand-authored service list.
 *
 * Content for DISCOVER/LEARN is intentionally minimal, static copy: the
 * canonical Financial Services Learning capability taxonomy (AEE-XP-001 §9,
 * XP-4 "Progressive Sovereignty Experience Pack") is explicitly later-phase
 * work (spec §15, Phase 5) — this stage's job in Phase 1 is only to prove
 * the main-spine connection exists and hands off correctly, not to author
 * the eventual Studio-driven learning content.
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
 * LEARN/EXPLORE follow-up (2026-09-01) — "the plumbing is mechanical; the
 * evidence semantics are not." DISCOVER's bar (any observed Continue) stays
 * deliberately weak — "meaningfully encountered FS's existence," nothing
 * more. LEARN and EXPLORE reuse the SAME generic promotion mechanism but
 * require a STRONGER, kind-discriminated basis
 * (`hasQualifyingExperienceInteraction`, never plain presence):
 *   - LEARN requires all three FS concept cards (Advisor/Architect/Runtime —
 *     the same three-axis MoneyPenny provider-mode vocabulary the FS spec
 *     already establishes) to be individually expanded/acknowledged before
 *     Continue is even clickable. A page render or a single click can never
 *     satisfy this — "observed engagement is evidence of engagement, not
 *     automatically evidence of competence."
 *   - EXPLORE requires at least one REAL MoneyPenny capability from the
 *     canonical `serviceCatalog` to be interacted with (clicked open), not
 *     merely listed/rendered. No fabricated "continue" acknowledgment.
 * Both gate the primary CTA client-side (BridgeMediaStage's generic
 * `primaryCtaDisabled`) AND are re-checked server-side by the Journey
 * Spine's own `completionEvidence` — the client gate is a UX convenience,
 * never the actual authority (same discipline as every other evidenced
 * stage in this codebase).
 *
 * AEE-Next (2026-09-01) — EXPLORE's four service cards above are still
 * describe-only (open the card, no live call — `serviceCatalog` entries
 * carry no bounded, no-input, side-effect-free live action to trigger
 * safely from a passive click). This adds ONE additional, genuinely live
 * action alongside them: "Try it — Compute your Financial Profile" calls
 * the real `POST /api/moneypenny/financial-profile/compute` (MPY2-2/3,
 * already deployed) and records its REAL result — not a click, an actual
 * outcome — as `outcome` on the SAME `experience_interaction_observed`
 * receipt (see `experienceObservationPromotion.ts`'s new `outcome` field).
 * This is what turns EXPLORE's evidence from "engaged with the idea of a
 * capability" into "observed the consequence of actually using one," which
 * `experienceIntentAssembly.ts`'s `observedBehavior` already carries into
 * the next AEE pass — no further wiring needed for the loop to close.
 * Deliberately NOT wired to Architect/Runtime (those require either a real
 * text intent or real financial consequence — out of scope for a passive
 * EXPLORE click); Financial Profile compute needs no input and is already
 * honest about its own absence of data (`no-financial-documents`).
 */

import { useCallback, useMemo, useState } from 'react';
import { BridgeMediaStage, type BridgeAccent } from '@/components/journey/BridgeMediaStage';
import { listFinancialServiceDefinitions } from '@/services/financialServices/serviceCatalog';
import { useDcirSeam } from '@/services/dcir/useDcirSeam';
import { aigentMeCapsuleEngagedEvent } from '@/services/dcir/eventStream';
import { personaFetch } from '@/utils/personaSpine';
import { personaFetchDeadline } from '@/utils/personaSpine';
import { FS_STAGE_CONTENT, FS_LEARN_PLATES, type FsBridge } from '@/services/journey/financialSovereigntyContent';
import { useFsBridgeSection, useFsLearnPlateSection } from '@/services/journey/useFsBridgeSection';
import { FinancialSovereigntyStageExtras } from '@/components/journey/FinancialSovereigntyStageExtras';

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

/**
 * CFS content pack integration (2026-09-03) — eyebrow/headline/lead now come
 * from FS_STAGE_CONTENT (services/journey/financialSovereigntyContent.ts),
 * which also carries this stage's corrected copy (Discover's "bounded,
 * evidenced, reversible" and Learn's "only a runtime action changes
 * anything" both replaced per the brief's "Preserve functions, correct
 * misleading copy" section) plus the pack's topics/checks/exercise summary,
 * rendered via FinancialSovereigntyStageExtras below. An admin-published
 * headline/shortCopy (knyts_bridge_editorial_config, via
 * fsBridgeSectionKey) overrides the static default when set — same
 * division of labour as every other admin-overridable Bridge section.
 */
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
  /**
   * The owning journey's id (e.g. 'knyts-bridge-crossing',
   * 'constitutional-internet-bridge') — required to build the generic
   * `${journeyId}:${stageId}` experienceRef the observation promotion
   * seam uses. Optional only so this component degrades gracefully (no
   * observation write, navigation still works) if a future caller forgets
   * to thread it, rather than throwing.
   */
  journeyId?: string;
  personaId?: string | null;
}) {
  // CFS content pack (2026-09-03) — accent already encodes which bridge is
  // rendering (KNYTS='amber', CI='indigo'; see this file's own header),
  // reused here rather than adding a redundant bridge prop.
  const bridge: FsBridge = accent === 'indigo' ? 'ci' : 'knyts';
  const fsConfig = useFsBridgeSection(bridge, stageKey);
  // Unconditional per rules-of-hooks; only consumed when stageKey === 'learn'.
  const learnPlate2Config = useFsLearnPlateSection(bridge, 1);
  const learnPlate3Config = useFsLearnPlateSection(bridge, 2);
  const copy = resolveCopy(stageKey, fsConfig);
  const services = stageKey === 'explore' ? listFinancialServiceDefinitions() : [];
  const stageId = `fs-${stageKey}`;

  // AEE-XP-001 §10/XP-6 — DCIR observation of the "Continue" interaction.
  // Local-only (session ring buffer, never persisted by DCIR itself); the
  // durable write is the separate `observeExperienceInteraction` promotion
  // call below. Reuses the SAME generic surface concept every other DCIR
  // adopter uses (services/dcir/useDcirSeam.ts).
  const { observe } = useDcirSeam({ surface: 'financial-sovereignty-intro', workflowStage: stageKey });

  // LEARN/EXPLORE's qualifying-interaction gates — session-local UX
  // convenience only; the Journey Spine re-derives the real answer from
  // durable receipts on its own next fetch (see header comment).
  const [acknowledgedConcepts, setAcknowledgedConcepts] = useState<Set<string>>(new Set());
  const [interactedCapabilities, setInteractedCapabilities] = useState<Set<string>>(new Set());
  const [tryStatus, setTryStatus] = useState<TryFinancialProfileStatus>('idle');
  const [tryDetail, setTryDetail] = useState<string | null>(null);

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

  /**
   * AEE-Next (2026-09-01) — the one live action EXPLORE can trigger. Calls
   * the REAL, already-deployed Financial Profile compute route (no input
   * required, no LLM call, deterministic) and records its REAL result as
   * `outcome` on the observation receipt — never a fabricated success. A
   * persona with no uploaded statements gets an honest 'no-data' result,
   * not a fake one.
   */
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
    // Real, kind-discriminated evidence now backs all three stages —
    // DISCOVER (any observed Continue), LEARN (all concept cards
    // acknowledged), EXPLORE (at least one real capability interacted
    // with). Re-evaluation always fires; resolveJourneyState is the only
    // place that actually turns evidence into COMPLETE.
    selectStage(nextStageId, 'stage-satisfaction-evidence-change');
  }, [observe, stageId, journeyId, stageKey, personaId, nextStageId]);

  const primaryCtaDisabled =
    (stageKey === 'learn' && !learnSatisfied) || (stageKey === 'explore' && !exploreSatisfied);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <BridgeMediaStage
        eyebrow={copy.eyebrow}
        headline={copy.headline}
        paragraphs={copy.paragraphs}
        primaryCtaLabel="Continue"
        onPrimaryCta={handlePrimaryCta}
        primaryCtaDisabled={primaryCtaDisabled}
        accent={accent}
        layout="standard"
        infographicUrl={fsConfig?.infographicUrl ?? undefined}
      >
        {stageKey === 'learn' && (
          <div className="space-y-2">
            {LEARN_CONCEPTS.map((concept) => {
              const acknowledged = acknowledgedConcepts.has(concept.id);
              return (
                <button
                  key={concept.id}
                  type="button"
                  onClick={() => handleConceptAcknowledge(concept.id)}
                  aria-pressed={acknowledged}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    acknowledged
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-slate-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span className="font-semibold">{acknowledged ? '✓ ' : ''}{concept.label}</span>
                  <span className="mt-1 block text-slate-400">{concept.body}</span>
                </button>
              );
            })}
          </div>
        )}
        {stageKey === 'explore' && services.length > 0 && (
          <div className="space-y-2">
            {services.map((service) => {
              const interacted = interactedCapabilities.has(service.serviceId);
              return (
                <button
                  key={service.serviceId}
                  type="button"
                  onClick={() => handleCapabilityInteract(service.serviceId)}
                  aria-pressed={interacted}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    interacted
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-slate-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                  }`}
                >
                  <span className="font-semibold">{interacted ? '✓ ' : ''}{service.displayName}</span>
                  <span className="mt-1 block text-slate-400">{service.providerMode} capability — tap to view.</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleTryFinancialProfile}
              disabled={tryStatus === 'loading'}
              aria-pressed={interactedCapabilities.has(LIVE_TRY_CAPABILITY_ID)}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition disabled:opacity-60 ${
                interactedCapabilities.has(LIVE_TRY_CAPABILITY_ID)
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-slate-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
              }`}
            >
              <span className="font-semibold">
                {interactedCapabilities.has(LIVE_TRY_CAPABILITY_ID) ? '✓ ' : ''}Try it — Compute your Financial Profile
              </span>
              <span className="mt-1 block text-slate-400">
                {tryStatus === 'loading'
                  ? 'Computing…'
                  : tryDetail ?? 'A real, live call — not a preview. Uses your uploaded bank statements, if any.'}
              </span>
            </button>
          </div>
        )}
        <FinancialSovereigntyStageExtras
          content={FS_STAGE_CONTENT[stageKey]}
          bridge={bridge}
          showCostExample={stageKey === 'explore'}
          assets={
            stageKey === 'learn'
              ? [
                  { asset: FS_LEARN_PLATES[0], infographicUrl: fsConfig?.infographicUrl, label: 'Lesson 1 — What money helps you do' },
                  { asset: FS_LEARN_PLATES[1], infographicUrl: learnPlate2Config?.infographicUrl, label: 'Lesson 2 — Fiat, crypto and value' },
                  { asset: FS_LEARN_PLATES[2], infographicUrl: learnPlate3Config?.infographicUrl, label: 'Lesson 3 — You, AgentMe and MoneyPenny' },
                ]
              : [{ asset: FS_STAGE_CONTENT[stageKey].asset, infographicUrl: fsConfig?.infographicUrl }]
          }
        />
      </BridgeMediaStage>
    </div>
  );
}

export default FinancialSovereigntyIntroStage;
