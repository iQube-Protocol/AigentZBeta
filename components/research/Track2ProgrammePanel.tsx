"use client";

/**
 * Track 2 — the guided operator workflow (operator ruling, 2026-08-02).
 *
 *   > "The operator must not need to run curl commands."
 *
 * ── What this panel is ─────────────────────────────────────────────────────
 *
 * A ROUTER with three hands. It renders the eleven-stage programme the server
 * derives (`/api/research/track2/[experimentId]`) and, for the five pieces the
 * operator named as missing a front end, it provides the control inline:
 *
 *   · guided crystal assignment (dry run, then admit with a rationale)
 *   · freeze-artifact provisioning
 *   · the freeze act itself
 *   · clear readiness remedies, carried verbatim from the readiness engine
 *   · (relationship creation lives on the invariant detail surface, where the
 *     invariant is — not duplicated here)
 *
 * Every other stage NAMES its existing surface and sends the operator there.
 * Re-implementing Corpus Scout review or candidate promotion inside a workflow
 * panel would be the parallel-implementation defect this programme was written
 * to avoid — and the second copy would be the stale one.
 *
 * ── What it does not decide ────────────────────────────────────────────────
 *
 * No rule is evaluated here. Eligibility, cycle guards, staleness, signatory
 * shape and every refusal come from the server; this panel renders the server's
 * own words. `dryRun` defaults on, the freeze requires an explicit
 * confirmation, and the content hash submitted for a freeze is the one the
 * operator was shown — never one this component recomputed.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { PROVENANCE_CLASSES } from "@/services/corpusScout/types";
import { INVARIANT_EDGE_TYPES } from "@/types/invariants";
import { findDuplicateCandidates, type DuplicateGroup } from "@/services/corpusScout/intelligence";
import { findRegistryEntry, type SourceTier } from "@/services/corpusScout/institutionalRegistry";
import {
  ABSORBED_BATCH_LIMIT,
  partitionForExecution,
  renderPartitionPreview,
  summariseAbsorbedExecution,
  type AbsorbedExecutionSummary,
  type ExecutionBatchOutcome,
} from "@/services/corpusScout/executionAbsorption";
import {
  RECOMMENDATION_TO_REVIEW_DECISION,
  titleResolutionIssue,
  type AdmissionRecommendation,
  type RecommendedAdmissionClass,
} from "@/services/corpusScout/admissionRecommendation";
import type {
  DuplicateResolutionPlan,
  DuplicateResolutionDryRun,
} from "@/services/corpusScout/duplicateResolution";
import {
  DECLARED_POPULATION_LABEL,
  EXCEPTION_CAUSE_LABEL,
  groupExceptionsByCause,
  signalForDisposition,
  type DeclaredPopulation,
  type IsolationException,
  type IsolationSummary,
  type PopulationDisclosure,
  type RecordDisposition,
} from "@/services/research/exceptionIsolation";

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 p-4";

interface Stage {
  id: string;
  ordinal: number;
  label: string;
  does: string;
  capability: string;
  surface: string;
  workKind: "scientific" | "governance";
  actor: string;
  status: "complete" | "partially-complete" | "in-progress" | "not-started" | "blocked" | "unknown";
  /** WHAT THIS STAGE IS REASONING ABOUT — rendered on every stage row, because
   *  a population the operator cannot see is one they cannot check. */
  population?: {
    consumes: DeclaredPopulation;
    produces: DeclaredPopulation;
    source: string;
  };
  detail: string;
  remedies: string[];
}

interface Programme {
  experimentId: string;
  crystalDomain: string;
  stages: Stage[];
  currentStageId: string;
  /** Stages that MAY PROCEED NOW — every earlier stage complete or
   *  partially-complete. The authority for the lock; never re-derived from
   *  ordinals here (exception-isolation ruling §6). */
  unblockedStageIds?: string[];
  /** The pipeline's account of its own subject. A non-empty `breaks` or
   *  `breaches` is a defect in the PIPELINE, not in the data, and is rendered
   *  as such — never as an empty queue. */
  populationContinuity?: {
    breaks: { fromStageId: string; toStageId: string; detail: string }[];
    breaches: string[];
  };
  /** The Population Reconciliation Board's data (al, 2026-08-04) — rendered ONCE, at Stage 5. */
  reconciliation?: PopulationReconciliationView | null;
  /** Stages 5-7's action-queue worklists (al, 2026-08-04). */
  actionQueues?: Track2ActionQueues | null;
  nextActions: string[];
  derivationNote: string;
}

type UnaccountedDefect = "missing-invariant-id" | "unresolvable-invariant-id" | "duplicate-invariant-id";

interface UnaccountedPromotionRecord {
  candidateId: string;
  label: string;
  domain: string;
  subDomain: string | null;
  evidenceCount: number;
  promotedInvariantId: string | null;
  defect: UnaccountedDefect;
  duplicateOfCandidateId: string | null;
  deterministicRepairInvariantId: string | null;
  recommendedTreatment: "repair" | "exclude";
  recommendedReason: string;
}

interface PopulationReconciliationView {
  crystalId: string;
  fromStageId: string;
  toStageId: string;
  declaredOut: number;
  received: number;
  explicitlyExcluded: number;
  unaccountedRecords: UnaccountedPromotionRecord[];
}

interface CohortMemberRef {
  id: string;
  label: string;
  statement: string;
}

/**
 * `scientific-readiness` is a freeze-gating hard check; `scientific-maturity`
 * is informational only and never blocks Freeze (operator ruling,
 * 2026-08-05: "Can this crystal be frozen? Is this crystal scientifically
 * ideal? Those are not the same question."). Mirrors
 * services/research/crystalReadiness.ts's CrystalReadinessCheck.
 */
/** Mirrors services/research/crystalInstrumentSuite.ts's CheckRemediationClass. */
type CheckRemediationClass = "operator-cleanup" | "additional-acquisition-required" | "governance-decision-required";

interface ReadinessCheck {
  name: string;
  passed: boolean;
  detail: string;
  remedy: string | null;
  tier: "scientific-readiness" | "scientific-maturity";
  /** What kind of remediation this check needs, and the real Track 2 stage
   *  whose EXISTING control resolves it — server-derived, carried verbatim
   *  (operator ruling, 2026-08-27, "Crystal v1/v2 lineage collision", item 4:
   *  replace the generic "scroll to Stage 9" Resolve button with a real
   *  destination per check). */
  remediationClass?: CheckRemediationClass;
  remediationStageAnchor?: string | null;
  /** Only present on the duplicate-detection check. */
  duplicatePairs?: Array<{ aId: string; bId: string }>;
}

interface ReadinessMaturitySummary {
  checks: ReadinessCheck[];
  passedCount: number;
  totalCount: number;
  band: "bronze" | "silver" | "gold";
}

interface ReadinessReport {
  /** READY FOR FREEZE — depends only on `scientific-readiness`-tier checks. */
  ok: boolean;
  checks: ReadinessCheck[];
  /** Informational only — never gates anything. */
  maturity: ReadinessMaturitySummary;
  invariantCount: number;
}

/** Stages 5-7's named worklists (al, 2026-08-04 steward-workflow ruling) — replaces "N have no provenance" with a queue of the exact N. */
interface Track2ActionQueues {
  crystalId: string;
  unclassified: CohortMemberRef[];
  unvalidated: CohortMemberRef[];
  orphans: CohortMemberRef[];
  members: CohortMemberRef[];
}

interface RatifiedBoundary {
  domain: string;
  label: string;
  boundary: string;
  exclusions: string[];
  ratificationText: string | null;
  ratifiedBy: string | null;
  ratifiedAt: string | null;
  declarationHash: string;
  immutable: boolean;
  amendedBy: string;
}

interface Execution {
  wouldFreezeSucceed: boolean;
  nextAct: string;
  preconditions: { name: string; satisfied: boolean; detail: string; remedy: string | null }[];
}

interface AssignmentOutcome {
  invariantId: string;
  admitted: boolean;
  written: boolean;
  refusals: string[];
  detail: string;
  priorDomains: string[];
}

const STATUS_ICON: Record<Stage["status"], React.ReactNode> = {
  complete: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  // Partial completion is PROGRESS, not a fault — emerald, never rose. A
  // stage holding unresolved exceptions while having processed everything
  // executable must not read as a failure (exception-isolation ruling §5:
  // amber is not prohibition, and this is not even amber).
  "partially-complete": <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60" />,
  "in-progress": <Circle className="h-3.5 w-3.5 text-amber-300" />,
  "not-started": <Circle className="h-3.5 w-3.5 text-slate-600" />,
  blocked: <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />,
  unknown: <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />,
};

/** `unknown` is never rendered as a failure — it means the signal could not be
 *  read, which is different from both "not started" and "blocked".
 *
 *  `partially-complete` is likewise never rendered as a failure: it means the
 *  stage processed every executable record and is holding the remainder. */
const STATUS_LABEL: Record<Stage["status"], string> = {
  complete: "complete",
  "partially-complete": "partially complete — eligible records processed",
  "in-progress": "in progress",
  "not-started": "not started",
  blocked: "blocked — no valid subset can proceed",
  unknown: "not observable from here",
};

export function Track2ProgrammePanel({
  experimentId = "EXP-P1",
  initialAnchorId,
}: {
  experimentId?: string;
  /**
   * CANONICAL DEEP-LINK CONSUMPTION (2026-08-26, corrected 2026-08-27) —
   * when a caller (the Research Copilot's CTA, via InvariantExperimentLab's
   * own consumption of track2DeepLinkIntent.ts) opens this panel FOR a
   * specific stage, scroll there on the initial load rather than leaving the
   * operator at the top of the list.
   *
   * Takes the deep-link's OWN `surfaceRef.anchorId` verbatim — never
   * reconstructed here as `track2-stage-${stageId}`. Before this fix, the
   * panel silently rebuilt the anchor from a bare stage id, which happened
   * to work only because this panel's own convention and the deep-link's
   * convention were identical strings; the contract's whole point is that a
   * consumer must not have to know that, or keep it in sync by hand.
   *
   * Falls back to `track2-stage-${programme.currentStageId}` (the panel's
   * OWN internal anchor convention — see `scrollToStage` below) only when no
   * deep-link was supplied at all, so a plain, non-deep-linked open of this
   * tab ALSO lands on the live stage instead of visually "regressing" to
   * Discover Sources — the same fix serves both entry paths.
   */
  initialAnchorId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programme, setProgramme] = useState<Programme | null>(null);
  /*
   * The acquisition domain is a DIFFERENT namespace from the crystal domain
   * (the route says so explicitly and refuses to guess one from the other).
   * The review queue below reads candidate sources in the acquisition domain,
   * so it must come from the server's answer — never be inferred here.
   */
  const [acquisitionDomain, setAcquisitionDomain] = useState<string | null>(null);
  /** The full nine-check readiness breakdown (operator direction, 2026-08-05: show the current state up front, not only after a click). */
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  /*
   * FUTURE STAGES ARE COLLAPSED (Al + EXP agent, 2026-08-02).
   *
   *   > "several later steps display warnings like 'Nothing here has
   *   >  failed...'. Technically correct, but they make the screen noisy.
   *   >  I'd collapse Steps 5-11 until their prerequisites are met."
   *
   * Not hidden — collapsed, with the count and a toggle. A stage the operator
   * cannot act on yet is context; a stage they can act on is the work. Any
   * stage that is COMPLETE stays visible whatever its ordinal, because
   * concealing finished work would misreport progress in the other direction.
   */
  const [showAllStages, setShowAllStages] = useState(false);
  /*
   * OPERATOR-AUTHORITY CONTINUATION NOTE (al, EXP PP1 Track 2, 2026-08-05):
   * when Stage 10's reviewer call hits a transport failure (HTTP 5xx,
   * timeout — never a real governance rejection), "Continue under
   * Operator Authority" reveals Stage 11 immediately and seeds its
   * freeze rationale with an honest record of the attempt, so the
   * receipted rationale — not a UI toast that vanishes on reload — is
   * where the audit trail lives.
   */
  const [freezeRationaleSeed, setFreezeRationaleSeed] = useState<string | null>(null);
  /*
   * COMPLETED STAGES COLLAPSE AUTOMATICALLY (al, 2026-08-04 steward-workflow
   * ruling): "The operator should spend 95% of their time looking at the
   * current stage." Manually re-expanded stages stay expanded across a
   * reload — this is presentation only, never a second authority on status.
   */
  const [expandedStageIds, setExpandedStageIds] = useState<Set<string>>(new Set());

  /** The ONE place this panel scrolls to a DOM node by id — every scroll
   *  call site (below, and the initial deep-link scroll) goes through this,
   *  so there is exactly one scroll implementation to drift. */
  const scrollToAnchorId = useCallback((anchorId: string) => {
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  /** This panel's OWN internal anchor convention (`track2-stage-${id}`) —
   *  used for its self-driven post-action navigation (`reloadAndAdvance`),
   *  where there is no externally supplied deep-link to consume. This is
   *  NOT part of the canonical deep-link contract; it is this component's
   *  private concern, and it owns the convention it reconstructs from. */
  const scrollToStage = useCallback(
    (stageId: string) => scrollToAnchorId(`track2-stage-${stageId}`),
    [scrollToAnchorId],
  );

  const load = useCallback(async (): Promise<Programme | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}`, {
        cache: "no-store",
      });
      const d = await res.json().catch(() => null);
      if (!d?.requestSucceeded) {
        throw new Error(d?.error || `the Track 2 programme could not be read (HTTP ${res.status})`);
      }
      const p = d.programme as Programme;
      setProgramme(p);
      setAcquisitionDomain(typeof d.acquisitionDomain === "string" ? d.acquisitionDomain : null);
      setReadiness((d.readiness as ReadinessReport) ?? null);
      return p;
    } catch (e) {
      setError(e instanceof Error ? e.message : "the Track 2 programme could not be read");
      return null;
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  /*
   * AUTO-PROGRESS (al, 2026-08-04): "Whenever a stage finishes: refresh
   * state, advance focus, scroll to the next incomplete stage. The operator
   * should never have to hunt." Every action control's `onDone` calls this
   * instead of bare `load()` — reads the FRESHLY FETCHED programme `load()`
   * returns, never the pre-reload React state, so the scroll target is never
   * one action stale.
   */
  const reloadAndAdvance = useCallback(async () => {
    const p = await load();
    if (!p) return;
    const next = p.stages.find((s) => s.status !== "complete");
    if (!next) return;
    // A freshly-completed stage collapses again on its own next reload
    // (removing it from the manually-expanded set), so finishing Stage 5
    // does not leave it pinned open once Stage 6 is the focus.
    setExpandedStageIds((prev) => {
      const copy = new Set(prev);
      copy.delete(next.id);
      return copy;
    });
    // Deferred one frame (inside scrollToStage) — the DOM node for `next`
    // only exists after THIS render commits the freshly-fetched programme.
    scrollToStage(next.id);
  }, [load, scrollToStage]);

  /**
   * VISUAL-REGRESSION FIX (2026-08-26, corrected 2026-08-27): on the INITIAL
   * load only, scroll to `initialAnchorId` — the deep-link's OWN
   * `surfaceRef.anchorId`, consumed verbatim, never reconstructed — or,
   * absent one, this panel's own `track2-stage-${currentStageId}` anchor
   * (the programme's own "you are here"). Without this, every fresh mount of
   * this panel rendered all eleven stages from Stage 1 with no scroll — a
   * persona returning to a pending Stage 5 saw the viewport land on
   * "Discover Sources" even though nothing about the underlying data had
   * regressed (Stage 1 was, correctly, still COMPLETE). Guarded to run once:
   * subsequent reloads (act completions) are handled by `reloadAndAdvance`
   * above, which must not be overridden by this effect re-firing on every
   * `programme` update.
   */
  const didInitialScroll = useRef(false);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (didInitialScroll.current || !programme) return;
    didInitialScroll.current = true;
    scrollToAnchorId(initialAnchorId ?? `track2-stage-${programme.currentStageId}`);
  }, [programme, initialAnchorId, scrollToAnchorId]);

  return (
    <div className="space-y-4">
      <div className={PANEL}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">
            Track 2 — corpus acquisition to frozen crystal
          </h3>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        )}

        {programme && (
          <>
            {/* A POPULATION DISCONTINUITY OUTRANKS EVERY OTHER SIGNAL ON THIS
                SURFACE (operator, 2026-08-03). When two stages are reasoning
                about different subjects, every count below is about a
                population nobody has agreed on — including the reassuring
                ones. It leads, in rose, before the stage list. */}
            {((programme.populationContinuity?.breaches.length ?? 0) > 0 ||
              (programme.populationContinuity?.breaks.length ?? 0) > 0) && (
              <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] text-rose-100">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Population discontinuity — the pipeline changed its subject
                </div>
                <ul className="space-y-1">
                  {programme.populationContinuity?.breaches.map((b, i) => (
                    <li key={`breach-${i}`}>{b}</li>
                  ))}
                  {programme.populationContinuity?.breaks.map((b, i) => (
                    <li key={`break-${i}`}>{b.detail}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-300">
              <div className="text-slate-500">crystal domain</div>
              <div className="font-mono text-slate-200">{programme.crystalDomain}</div>
              <div className="mt-1.5 text-slate-500">next</div>
              <ul className="space-y-0.5">
                {programme.nextActions.map((a, i) => (
                  <li key={i} className="text-slate-200">
                    {a}
                  </li>
                ))}
              </ul>
            </div>

            {(() => {
              /*
               * FREEZE MODE (al, 2026-08-04 steward-workflow ruling): "When
               * only one path remains to complete the experiment,
               * automatically switch into: Finish Crystal... Every button
               * should move this checklist toward completion. No narrative."
               *
               * Additive, not a page replacement — the full stage list below
               * still carries the actual controls; this is a compact
               * "how much is left" summary so the operator does not have to
               * scroll the whole ladder to see it. Active only once every
               * scientific-work stage (1-7) has produced something usable
               * (complete or partially-complete) AND at least one governance
               * stage (8-11) remains — a crystal that is fully frozen has
               * nothing left to finish, so the banner does not outlive its
               * own purpose.
               */
              const PASSES: ReadonlySet<Stage["status"]> = new Set(["complete", "partially-complete"]);
              const tailIds = ["assign-to-crystal", "run-readiness", "prepare-independent-review", "freeze"];
              const tail = programme.stages.filter((s) => tailIds.includes(s.id));
              const earlier = programme.stages.filter((s) => !tailIds.includes(s.id));
              const earlierAllPass = earlier.every((s) => PASSES.has(s.status));
              const tailRemaining = tail.filter((s) => s.status !== "complete");
              if (!earlierAllPass || tailRemaining.length === 0) return null;
              // Everything below derives a HONEST classification of what remains,
              // never a time estimate (operator ruling, 2026-08-27, "Crystal v1/v2
              // lineage collision", item 6: "'<3 minutes' is plainly false for
              // this state... replace with a derived classification"). The
              // classification comes verbatim off each failing check's own
              // server-computed `remediationClass` — never re-derived here.
              const REMEDIATION_CLASS_RANK: Record<CheckRemediationClass, number> = {
                "operator-cleanup": 0,
                "additional-acquisition-required": 1,
                "governance-decision-required": 2,
              };
              const REMEDIATION_CLASS_LABEL: Record<CheckRemediationClass, string> = {
                "operator-cleanup": "operator cleanup",
                "additional-acquisition-required": "additional acquisition required",
                "governance-decision-required": "governance decision required",
              };
              // ONLY scientific-readiness (freeze-gating) checks count as
              // blockers here (item 5: a `scientific-maturity` finding —
              // structural-diversity, graph-connectivity — is an informational
              // observation, not a freeze blocker, and must never be counted
              // among "what remains before Freeze"; each already has its own
              // real remediation queue rendered inline at Stage 9).
              const runReadinessFailingChecks: ReadinessCheck[] =
                readiness ? readiness.checks.filter((c) => c.tier === "scientific-readiness" && !c.passed) : [];
              const worstRemediationClass = runReadinessFailingChecks.reduce<CheckRemediationClass | null>(
                (worst, c) => {
                  const cls = c.remediationClass ?? "governance-decision-required";
                  return worst === null || REMEDIATION_CLASS_RANK[cls] > REMEDIATION_CLASS_RANK[worst] ? cls : worst;
                },
                null,
              );
              const statusLabel =
                worstRemediationClass !== null
                  ? REMEDIATION_CLASS_LABEL[worstRemediationClass]
                  : "operator action — no scientific work outstanding";
              return (
                <div className="mb-3 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2.5 text-[11px]">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-medium text-emerald-200">Finish Crystal — remaining work</span>
                    <span className="text-emerald-300/70">status: {statusLabel}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {tail.map((s) => {
                      const scrollToAnchor = (anchorId: string) =>
                        document.getElementById(`track2-stage-${anchorId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      // Run Readiness gets its OWN failing checks named here (operator
                      // direction, 2026-08-05: "Run Readiness / 7/9 passed / Structural
                      // diversity [Resolve] / Graph connectivity [Resolve]"). ONLY
                      // scientific-readiness checks appear (item 5) — a maturity
                      // finding is still worth resolving, but it no longer inflates
                      // this list with a failure that was never a blocker.
                      const failingChecks = s.id === "run-readiness" ? runReadinessFailingChecks : [];
                      const readinessTierTotal = readiness ? readiness.checks.filter((c) => c.tier === "scientific-readiness").length : 0;
                      const readinessTierPassed = readiness
                        ? readiness.checks.filter((c) => c.tier === "scientific-readiness" && c.passed).length
                        : 0;
                      return (
                        <li key={s.id}>
                          <a
                            href={`#track2-stage-${s.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              scrollToAnchor(s.id);
                            }}
                            className="flex items-center gap-1.5 text-slate-200 hover:text-white"
                          >
                            {s.status === "complete" ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Circle className="h-3 w-3 text-slate-500" />
                            )}
                            {s.label}
                            {s.id === "run-readiness" && readiness && (
                              <span className="text-slate-500">
                                — {readinessTierPassed}/{readinessTierTotal} scientific-readiness passed
                                {readiness.maturity.totalCount > 0 && ` · maturity ${readiness.maturity.band}`}
                              </span>
                            )}
                          </a>
                          {failingChecks.length > 0 && (
                            <ul className="ml-4 mt-0.5 space-y-0.5">
                              {failingChecks.map((c) => {
                                // THE DESTINATION IS CHECK-SPECIFIC (item 4): each
                                // check's own `remediationStageAnchor` names the
                                // real, already-built control that resolves IT —
                                // never a blanket scroll back to Stage 9. Only
                                // duplicate-detection legitimately anchors to
                                // run-readiness itself (its queue renders inline
                                // there); every other failing scientific-readiness
                                // check anchors elsewhere.
                                const destAnchor = c.remediationStageAnchor ?? "run-readiness";
                                const label =
                                  destAnchor === "run-readiness"
                                    ? "Resolve"
                                    : c.remediationClass === "additional-acquisition-required"
                                      ? "Go acquire →"
                                      : "Go resolve →";
                                return (
                                  <li key={c.name} className="flex items-center justify-between text-slate-400">
                                    <span>{c.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => scrollToAnchor(destAnchor)}
                                      className="text-emerald-300 underline decoration-emerald-700 hover:text-emerald-200"
                                    >
                                      {label}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}

            <ol className="space-y-2">
              {programme.stages.map((s) => {
                // LOCKED IS READ FROM THE SERVER'S OWN `unblockedStageIds`,
                // never re-derived from ordinals here (exception-isolation
                // ruling §6).
                //
                // The old rule — `s.ordinal > current.ordinal` — was the UI
                // half of the paralysis: with Stage 2 holding three unresolved
                // sources, Stage 3 was hidden even though twenty-nine sources
                // had already been admitted for it to extract from. A stage
                // after a PARTIALLY-COMPLETE stage is unblocked, because
                // partial completion means the earlier stage produced
                // something to work on.
                const unblocked = programme.unblockedStageIds?.includes(s.id) ?? true;
                const locked = !unblocked && s.status !== "complete";
                if (locked && !showAllStages) return null;
                /*
                 * ONE WARNING, NOT THREE (al, 2026-08-04).
                 *
                 *   > "Stage 5, 6 and 7 all repeat the same warning. That
                 *   >  creates the impression of three separate failures.
                 *   >  They are not three failures. They are one upstream
                 *   >  discontinuity propagating downstream."
                 *
                 * Stages 6-7 are blocked by the SAME Stage 4 -> 5 handover
                 * Stage 5 itself is blocked by — never a second, independent
                 * diagnosis. When reconciliation is pending, they link back
                 * to the one active board instead of repeating it.
                 */
                const pendingReconciliation = (programme.reconciliation?.unaccountedRecords.length ?? 0) > 0;
                const isDownstreamOfReconciliation =
                  pendingReconciliation && (s.id === "validate" || s.id === "add-relationships") && s.status === "blocked";

                /*
                 * COMPLETED STAGES COLLAPSE AUTOMATICALLY (al, 2026-08-04
                 * steward-workflow ruling): "Display only ✓ Discover ✓
                 * Review ✓ Promote... Expand only on demand. The operator
                 * should spend 95% of their time looking at the current
                 * stage." The current stage never collapses even if complete
                 * (there is nowhere else to look right after finishing it),
                 * and a manual expand persists until the next auto-advance.
                 */
                if (s.status === "complete" && s.id !== programme.currentStageId && !expandedStageIds.has(s.id)) {
                  return (
                    <li key={s.id} id={`track2-stage-${s.id}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedStageIds((prev) => new Set(prev).add(s.id))}
                        className="flex w-full items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/20 px-2.5 py-1 text-left text-[11px] text-slate-500 transition hover:border-slate-800 hover:bg-slate-900/40 hover:text-slate-300"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-400/70" />
                        <span>
                          {s.ordinal}. {s.label}
                        </span>
                      </button>
                    </li>
                  );
                }
                return (
                <li
                  key={s.id}
                  id={`track2-stage-${s.id}`}
                  className={`rounded-lg border p-2.5 text-[11px] ${
                    s.id === programme.currentStageId
                      ? "border-slate-700 bg-slate-950"
                      : "border-slate-800 bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{STATUS_ICON[s.status]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-slate-100">
                          {s.ordinal}. {s.label}
                        </span>
                        <span className="text-slate-500">{STATUS_LABEL[s.status]}</span>
                        <span
                          className={
                            s.workKind === "governance" ? "text-violet-300" : "text-cyan-300"
                          }
                        >
                          {s.workKind}
                        </span>
                      </div>
                      <div className="text-slate-400">{s.does}</div>
                      {/* The declared population, on every row. The operator
                          read 17 / 68 / zero on one screen with nothing saying
                          which set each number was about; this is the line
                          that makes that visible without opening the code. */}
                      {s.population && (
                        <div className="mt-0.5 text-[10px] text-slate-500" title={s.population.source}>
                          <span className="text-slate-600">reads</span>{" "}
                          <span className="text-slate-300">
                            {DECLARED_POPULATION_LABEL[s.population.consumes]}
                          </span>
                          {s.population.produces !== s.population.consumes && (
                            <>
                              {" "}
                              <span className="text-slate-600">→ hands on</span>{" "}
                              <span className="text-slate-300">
                                {DECLARED_POPULATION_LABEL[s.population.produces]}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="mt-0.5 text-slate-500">{s.detail}</div>
                      {isDownstreamOfReconciliation ? (
                        <div className="mt-1.5 rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-amber-100">
                          Waiting on Stage 5 reconciliation — not a separate failure.{" "}
                          <a
                            href="#track2-stage-classify-provenance"
                            className="underline decoration-amber-400/50 hover:decoration-amber-400"
                          >
                            Go to the Population Reconciliation Board
                          </a>
                          .
                        </div>
                      ) : (
                        s.remedies.length > 0 && (
                          <ul className="mt-1.5 space-y-1">
                            {s.remedies.map((r, i) => (
                              <li
                                key={i}
                                className="rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-amber-100"
                              >
                                {r}
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                      {s.id === "classify-provenance" && pendingReconciliation && programme.reconciliation && (
                        <PopulationReconciliationBoard
                          experimentId={experimentId}
                          reconciliation={programme.reconciliation}
                          onDone={() => void reloadAndAdvance()}
                        />
                      )}
                      {/* STAGE 5 ACTION (al, 2026-08-04): "13 members require
                          provenance. [Open Classification Queue]." A real
                          "Classify All" has no shared inputs across arbitrary
                          records — each classification cites its OWN evidence
                          and rationale — so batch here means a fast per-record
                          queue over the EXISTING classify action, never a
                          fictitious one-click batch with no well-defined
                          semantics. Only offered once reconciliation is not
                          the blocking act. */}
                      {s.id === "classify-provenance" &&
                        !pendingReconciliation &&
                        (programme.actionQueues?.unclassified.length ?? 0) > 0 && (
                          <ClassificationQueue
                            queue={programme.actionQueues!.unclassified}
                            onDone={() => void reloadAndAdvance()}
                          />
                        )}
                      <div className="mt-1 text-[10px] text-slate-600">
                        {s.surface} · {s.actor}
                      </div>
                      <div className="text-[10px] font-mono text-slate-700">{s.capability}</div>

                      {/* STAGE 2 IS WHERE THE WORK IS (EXP agent, 2026-08-02:
                          "What happens when you click Review & Admit?").

                          It reported "41 sources await a human decision" and
                          offered nothing to decide with — orchestration built,
                          operator workflow missing. The queue below calls the
                          EXISTING review route; no admission rule, no
                          ingestion trigger and no status mapping is
                          reimplemented here. */}
                      {s.id === "review-and-admit" && (
                        <CorpusReviewQueue
                          acquisitionDomain={acquisitionDomain}
                          onDone={() => void reloadAndAdvance()}
                        />
                      )}
                      {/* STAGE 6 ACTION (al, 2026-08-04): "15 members require
                          validation. [Validate All]." Unlike Stage 5/7,
                          validation IS a genuine machine-run gate with no
                          per-record human content, so a real batch is honest
                          here — one new caller of the EXISTING validateInvariant,
                          never a new rule. */}
                      {s.id === "validate" &&
                        !isDownstreamOfReconciliation &&
                        (programme.actionQueues?.unvalidated.length ?? 0) > 0 && (
                          <ValidateAllControl
                            experimentId={experimentId}
                            count={programme.actionQueues!.unvalidated.length}
                            onDone={() => void reloadAndAdvance()}
                          />
                        )}
                      {/* STAGE 7 ACTION (operator direction, 2026-08-04:
                          "The graph engine should perform the reasoning; the
                          human should perform constitutional oversight.").
                          Ranked relationship suggestions from
                          services/invariants/relationshipSuggestion.ts,
                          reviewed as Accept/Edit/Reject cards — every write
                          still goes through the EXISTING single-edge route,
                          never a new writer. */}
                      {s.id === "add-relationships" &&
                        !isDownstreamOfReconciliation &&
                        (programme.actionQueues?.orphans.length ?? 0) > 0 && (
                          <RelationshipQueue
                            experimentId={experimentId}
                            queue={programme.actionQueues!.orphans}
                            members={programme.actionQueues!.members}
                            onDone={() => void reloadAndAdvance()}
                          />
                        )}
                      {/* STAGE 9 (operator direction, 2026-08-05: "Predicted
                          readiness... 9/9"). Readiness is a LIVE, deterministic
                          read of the actual current crystal (runCrystal
                          ReadinessReport) — not a probabilistic forecast, so
                          there is no separate "predicted" state to compute.
                          The honest version of "show it before the steward
                          has to ask" is showing the full nine-check
                          breakdown INLINE, immediately, rather than hiding it
                          behind a click — the button re-reads the live state
                          (the SAME reload every other control already
                          triggers) rather than approving anything separate. */}
                      {/* Two tiers, never conflated (operator ruling, 2026-08-05): "Can this
                          crystal be frozen?" (scientific-readiness, hard gate) is a different
                          question from "Is this crystal scientifically ideal?" (scientific-
                          maturity, informational). A first crystal that is all one semantic
                          shape, or still fragmented into disjoint clusters, is a true finding
                          about the corpus — not evidence corruption — and must not block Freeze
                          the way a real data-integrity failure does. */}
                      {s.id === "run-readiness" && readiness && (
                        <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
                          <div>
                            <div className="mb-0.5 font-medium text-slate-300">Scientific Readiness (freeze-gating)</div>
                            <ul className="space-y-0.5">
                              {readiness.checks
                                .filter((c) => c.tier === "scientific-readiness")
                                .map((c) => (
                                  <li key={c.name} className={c.passed ? "text-emerald-300" : "text-amber-200"}>
                                    {c.passed ? "✓" : "○"} {c.name}
                                    <span className="ml-1.5 text-slate-500">{c.detail}</span>
                                    {/* duplicate-detection's remediation is EXECUTABLE, not
                                        prose (item 4, operator ruling 2026-08-27): the exact
                                        near-duplicate pairs are already ON this check
                                        (readiness engine computed them) — this queue acts on
                                        them via the existing mergeInvariants primitive, never
                                        a second dedup implementation. */}
                                    {!c.passed && c.name === "duplicate-detection" && (
                                      <DuplicateInvariantQueue
                                        experimentId={experimentId}
                                        pairs={c.duplicatePairs ?? []}
                                        onDone={() => void reloadAndAdvance()}
                                      />
                                    )}
                                  </li>
                                ))}
                            </ul>
                          </div>
                          <div>
                            <div className="mb-0.5 font-medium text-slate-300">
                              Scientific Maturity — informational, does not block Freeze
                            </div>
                            <ul className="space-y-0.5">
                              {readiness.checks
                                .filter((c) => c.tier === "scientific-maturity")
                                .map((c) => (
                                  <li key={c.name} className={c.passed ? "text-emerald-300" : "text-sky-300"}>
                                    {c.passed ? "✓" : "⚠"} {c.name}
                                    <span className="ml-1.5 text-slate-500">{c.detail}</span>
                                    {/* Executable remediation in place of prose (operator direction,
                                        2026-08-05): a maturity finding still gets an affordance that
                                        actually resolves it — "always a way to resolve any blocker, not
                                        just highlighting it" — it just no longer withholds Freeze. */}
                                    {!c.passed && c.name === "structural-diversity" && (
                                      <DiversityCandidateQueue experimentId={experimentId} onDone={() => void reloadAndAdvance()} />
                                    )}
                                    {!c.passed && c.name === "graph-connectivity" && (
                                      <BridgeRelationshipQueue experimentId={experimentId} onDone={() => void reloadAndAdvance()} />
                                    )}
                                  </li>
                                ))}
                            </ul>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-800 pt-1.5">
                            <span className={`font-medium ${readiness.ok ? "text-emerald-300" : "text-amber-200"}`}>
                              Overall: {readiness.ok ? "READY FOR FREEZE" : "NOT YET READY"}
                            </span>
                            <span className="text-slate-400">
                              Scientific maturity: {readiness.maturity.band} ({readiness.maturity.passedCount}/{readiness.maturity.totalCount})
                            </span>
                          </div>
                        </div>
                      )}
                      {s.id === "run-readiness" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void reloadAndAdvance()}
                            disabled={loading}
                            className="mt-2 flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
                          >
                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            Refresh readiness
                          </button>
                          {/* Item 7 (operator ruling, 2026-08-27): this button
                              RE-READS the live corpus — it does not change the
                              corpus. Renamed from "Run Readiness" because that
                              name implied an action that could resolve a
                              failing check; repeatedly pressing it recomputes
                              the SAME failing checks against unchanged inputs. */}
                          <div className="mt-1 text-[10px] text-slate-600">
                            Recomputes the checks above from the corpus as it stands right now — it does not change the
                            corpus. Use each check&apos;s own remediation above to actually resolve a failure.
                          </div>
                        </>
                      )}
                      {s.id === "prepare-independent-review" && s.status === "partially-complete" && (
                        <ReviewPackageControl
                          onDone={() => void reloadAndAdvance()}
                          onContinueUnderAuthority={(note) => {
                            setFreezeRationaleSeed(note);
                            setShowAllStages(true);
                            requestAnimationFrame(() =>
                              document.getElementById("track2-stage-freeze")?.scrollIntoView({ behavior: "smooth", block: "center" }),
                            );
                          }}
                        />
                      )}
                      {/* STAGE 8 IS LOCKED UNTIL ITS PREREQUISITES ARE REAL
                          (Al, 2026-08-02).

                            68 promoted invariants with no recorded evidence
                            provenance + validation not started + relationships
                            not started = Stage 8 is not the next act.

                          Collapsing the stage was not enough: a steward who
                          expands "show all stages" still met an invariant-ID
                          textarea, and pasting IDs there would BYPASS
                          provenance classification, validation and
                          relationship review entirely. A control that can
                          circumvent the stages before it is not a convenience,
                          it is a hole in the ladder.

                          The control now renders only when every earlier stage
                          is complete. Otherwise the card names the stage that
                          IS the next act, so the surface routes the operator
                          to Stage 5 instead of inviting them into Stage 8. */}
                      {s.id === "assign-to-crystal" &&
                        (() => {
                          /*
                           * THE GATE MOVED FROM THE STAGE TO THE RECORD
                           * (exception-isolation ruling, 2026-08-03).
                           *
                           * The original gate required every earlier stage to be
                           * COMPLETE, because the control was a textarea and
                           * pasting ids there would bypass provenance,
                           * validation and relationship review — "a hole in the
                           * ladder".
                           *
                           * The derived surface cannot do that. Every row it
                           * offers has been through `evaluateCrystalAssignment`
                           * against the ratified declaration, so an invariant
                           * lacking validation or evidence provenance is
                           * rendered as an exception with its remedy and cannot
                           * be selected. The safety is now per-record, which is
                           * strictly stronger than a stage-level lock.
                           *
                           * So a PARTIALLY-COMPLETE earlier stage no longer
                           * withholds assignment of the cohort that IS eligible
                           * — which is the whole ruling. Only a stage with
                           * nothing usable at all still blocks.
                           */
                          const blockers = programme.stages.filter(
                            (x) =>
                              x.ordinal < s.ordinal &&
                              x.status !== "complete" &&
                              x.status !== "partially-complete",
                          );
                          if (blockers.length === 0) {
                            return <AssignmentControl experimentId={experimentId} onDone={() => void reloadAndAdvance()} />;
                          }
                          const next = blockers[0];
                          return (
                            <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-100">
                              <strong className="font-medium">Assignment is not the next act.</strong>{" "}
                              {blockers.length === 1 ? "One earlier stage is" : `${blockers.length} earlier stages are`}{" "}
                              incomplete, starting with <strong>{next.ordinal}. {next.label}</strong> — {next.detail}.
                              <div className="mt-1 text-amber-200/80">
                                No control is offered here because no eligible invariant can exist yet — not because
                                earlier stages hold unresolved exceptions. A stage that has produced SOME eligible
                                work does not withhold this one.
                              </div>
                            </div>
                          );
                        })()}
                      {/* Gated behind readiness (operator direction, 2026-08-05: "Stages 10
                          and 11 should show only: Waiting for readiness: 7/9 [Return to
                          unresolved checks]. Do not repeat the long explanations downstream.")
                          — the full ceremony (ref inputs, 3-step flow, boundary panel) has
                          no reason to render while the crystal cannot legally freeze yet. */}
                      {s.id === "freeze" &&
                        (() => {
                          /*
                           * FREEZE IS A ONE-TIME CONSTITUTIONAL ACT (operator
                           * bug report, 2026-08-05): "The UI still renders
                           * the pre-freeze ceremony... creating the
                           * impression that another freeze is required...
                           * The operator should never be able to 'freeze
                           * again.'" `s.status === 'complete'` on THIS stage
                           * means exactly `s.artifact?.lifecycle ===
                           * 'frozen'` (track2Programme.ts's own freeze-stage
                           * status derivation) — never re-derived here.
                           */
                          if (s.status === "complete") {
                            return <FrozenSummary experimentId={experimentId} />;
                          }
                          const readinessStage = programme.stages.find((st) => st.id === "run-readiness");
                          if (readinessStage && readinessStage.status !== "complete") {
                            return (
                              <div className="mt-2 flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-400">
                                <span>
                                  Waiting for readiness:{" "}
                                  {readiness ? `${readiness.checks.filter((c) => c.passed).length}/${readiness.checks.length}` : "…"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    document.getElementById("track2-stage-run-readiness")?.scrollIntoView({ behavior: "smooth", block: "center" })
                                  }
                                  className="text-emerald-300 underline decoration-emerald-700 hover:text-emerald-200"
                                >
                                  Return to unresolved checks
                                </button>
                              </div>
                            );
                          }
                          return (
                            <FreezeControl
                              experimentId={experimentId}
                              onDone={() => void reloadAndAdvance()}
                              initialRationale={freezeRationaleSeed ?? undefined}
                            />
                          );
                        })()}
                    </div>
                  </div>
                </li>
                );
              })}
            </ol>

            {(() => {
              // Same authority as the per-stage lock above — the server's
              // `unblockedStageIds`, never a second ordinal rule that could
              // disagree with it.
              const lockedCount = programme.stages.filter(
                (x) => !(programme.unblockedStageIds?.includes(x.id) ?? true) && x.status !== "complete",
              ).length;
              if (lockedCount === 0) return null;
              return (
                <button
                  onClick={() => setShowAllStages((v) => !v)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800/60"
                >
                  <Lock className="h-3 w-3" />
                  {showAllStages
                    ? `Hide the ${lockedCount} stage(s) that unlock later`
                    : `${lockedCount} remaining stage(s) unlock automatically — show them`}
                </button>
              );
            })()}

            <div className="mt-2 text-[10px] text-slate-600">{programme.derivationNote}</div>
          </>
        )}
      </div>
    </div>
  );
}

const DEFECT_LABEL: Record<UnaccountedDefect, string> = {
  "missing-invariant-id": "Missing invariant_id",
  "unresolvable-invariant-id": "Unresolvable invariant_id",
  "duplicate-invariant-id": "Duplicate resolution",
};

/**
 * THE POPULATION RECONCILIATION BOARD (al, 2026-08-04, Track 2 Stage 5).
 *
 *   > "The operator must be able to complete the repair from the place
 *   >  where the exception is surfaced." — not a navigation instruction.
 *
 * Renders every unaccounted promoted candidate INDIVIDUALLY, with the exact
 * defect and — where one exists — the deterministic repair already found by
 * the server (`reconcilePromotedCohort`). Never re-derives a recommendation
 * here: `record.recommendedTreatment` / `record.deterministicRepairInvariantId`
 * are read verbatim, because a client that recomputed them could disagree
 * with the server's own account of the same records.
 *
 * Both treatments post to the SAME governed route
 * (`POST /api/research/track2/[experimentId]/reconcile`), which applies each
 * through the existing canonical capability and receipts it individually —
 * this component never writes `discovery_candidates` itself.
 */
function PopulationReconciliationBoard({
  experimentId,
  reconciliation,
  onDone,
}: {
  experimentId: string;
  reconciliation: PopulationReconciliationView;
  onDone: () => void;
}) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [lastOutcomes, setLastOutcomes] = useState<
    { candidateId: string; treatment: "repair" | "exclude"; ok: boolean; detail: string }[] | null
  >(null);

  const { unaccountedRecords, declaredOut, received, explicitlyExcluded } = reconciliation;

  const apply = useCallback(
    async (treatments: { candidateId: string; treatment: "repair" | "exclude"; reason?: string }[]) => {
      setErr(null);
      setBusyIds((prev) => new Set([...prev, ...treatments.map((t) => t.candidateId)]));
      try {
        const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/reconcile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treatments }),
        });
        const d = await res.json().catch(() => null);
        if (!d) throw new Error(`the reconciliation could not be applied (HTTP ${res.status})`);
        setLastOutcomes(d.outcomes ?? null);
        if (!res.ok && res.status !== 207) {
          throw new Error(d.error || `the reconciliation could not be applied (HTTP ${res.status})`);
        }
        // RELOAD, NEVER LOCAL BOOKKEEPING (al, 2026-08-04: "do not require the
        // operator to navigate away and manually refresh"). The server is the
        // one authority on whether the population now reconciles.
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "the reconciliation could not be applied");
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          for (const t of treatments) next.delete(t.candidateId);
          return next;
        });
      }
    },
    [experimentId, onDone],
  );

  const repairBatch = unaccountedRecords.filter((r) => r.recommendedTreatment === "repair" && r.deterministicRepairInvariantId);
  const excludeBatch = unaccountedRecords.filter(
    (r) => r.recommendedTreatment === "exclude" && (r.defect === "duplicate-invariant-id" || r.defect === "unresolvable-invariant-id"),
  );

  return (
    <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-100">
        <ShieldAlert className="h-3.5 w-3.5" />
        Population Reconciliation Board
      </div>
      <p className="mt-1 text-[10px] text-rose-200/80">
        Every promoted candidate not yet a distinct crystal member, individually. Resolve each below — Stage 5
        unlocks automatically once every record is accounted for.
      </p>

      {/* THE LIVE POPULATION EQUATION (al, 2026-08-04). */}
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px]">
        {[
          { label: "Declared", value: declaredOut },
          { label: "Proceeding", value: received },
          { label: "Explicitly excluded", value: explicitlyExcluded },
          { label: "Unresolved", value: unaccountedRecords.length },
        ].map((cell) => (
          <div key={cell.label} className="rounded border border-slate-800 bg-slate-950/60 p-1.5">
            <div className="text-slate-500">{cell.label}</div>
            <div className={`font-mono text-sm ${cell.label === "Unresolved" && cell.value > 0 ? "text-rose-300" : "text-slate-200"}`}>
              {cell.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 text-center text-[10px] text-slate-600">
        Stage 5 unlocks when proceeding + explicitly excluded = declared population.
      </div>

      {err && (
        <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">{err}</div>
      )}
      {lastOutcomes && lastOutcomes.some((o) => !o.ok) && (
        <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-[11px] text-amber-100">
          {lastOutcomes.filter((o) => !o.ok).length} of {lastOutcomes.length} treatment(s) failed — the rest were
          applied. Failed record(s):
          <ul className="mt-1 space-y-0.5">
            {lastOutcomes
              .filter((o) => !o.ok)
              .map((o) => (
                <li key={o.candidateId} className="font-mono text-[10px]">
                  {o.candidateId}: {o.detail}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* BATCH ACTIONS — only when 2+ records share the SAME deterministic
          treatment (al, 2026-08-04: "If both records have the same
          deterministic defect, provide: Repair both and continue"). */}
      {(repairBatch.length > 1 || excludeBatch.length > 1) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {repairBatch.length > 1 && (
            <button
              onClick={() =>
                void apply(repairBatch.map((r) => ({ candidateId: r.candidateId, treatment: "repair" as const })))
              }
              disabled={repairBatch.some((r) => busyIds.has(r.candidateId))}
              className="rounded border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] text-emerald-200 transition hover:bg-emerald-900/40 disabled:opacity-50"
            >
              Repair all {repairBatch.length} and continue
            </button>
          )}
          {excludeBatch.length > 1 && (
            <button
              onClick={() =>
                void apply(
                  excludeBatch.map((r) => ({
                    candidateId: r.candidateId,
                    treatment: "exclude" as const,
                    reason: r.recommendedReason,
                  })),
                )
              }
              disabled={excludeBatch.some((r) => busyIds.has(r.candidateId))}
              className="rounded border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
            >
              Exclude all {excludeBatch.length} and continue
            </button>
          )}
        </div>
      )}

      {/* EVERY RECORD, INDIVIDUALLY — never only an aggregate count. */}
      <ul className="mt-2 space-y-1.5">
        {unaccountedRecords.map((r) => {
          const busy = busyIds.has(r.candidateId);
          const canRepair = r.recommendedTreatment === "repair" && Boolean(r.deterministicRepairInvariantId);
          const reasonValue = reasons[r.candidateId] ?? (canRepair ? "" : r.recommendedReason);
          return (
            <li key={r.candidateId} className="rounded border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="rounded border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {DEFECT_LABEL[r.defect]}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{r.candidateId}</span>
              </div>
              <div className="mt-1 text-slate-200">{r.label}</div>
              <div className="mt-1 text-[10px] text-slate-500">
                {r.domain}
                {r.subDomain ? `/${r.subDomain}` : ""} · {r.evidenceCount} evidence source(s) ·{" "}
                {r.promotedInvariantId ? (
                  <span className="font-mono">promoted_invariant_id: {r.promotedInvariantId}</span>
                ) : (
                  "no promoted_invariant_id recorded"
                )}
                {r.duplicateOfCandidateId && (
                  <>
                    {" "}
                    · already claimed by <span className="font-mono">{r.duplicateOfCandidateId}</span>
                  </>
                )}
              </div>
              <div className="mt-1 text-amber-100">{r.recommendedReason}</div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {canRepair ? (
                  <button
                    onClick={() => void apply([{ candidateId: r.candidateId, treatment: "repair" }])}
                    disabled={busy}
                    className="rounded border border-emerald-700/50 bg-emerald-950/30 px-2.5 py-1 text-[11px] text-emerald-200 transition hover:bg-emerald-900/40 disabled:opacity-50"
                  >
                    {busy ? "Repairing…" : "Repair and include"}
                  </button>
                ) : (
                  <span className="rounded border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-500">
                    Steward judgment required — no deterministic repair
                  </span>
                )}
                <input
                  type="text"
                  value={reasonValue}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [r.candidateId]: e.target.value }))}
                  placeholder="exclusion reason"
                  className="min-w-[10rem] flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                />
                <button
                  onClick={() =>
                    void apply([{ candidateId: r.candidateId, treatment: "exclude", reason: reasonValue.trim() }])
                  }
                  disabled={busy || !reasonValue.trim()}
                  className="rounded border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800/60 disabled:opacity-50"
                >
                  {busy ? "Excluding…" : "Explicitly exclude"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * STAGE 2 — the steward review queue (EXP agent + Al, 2026-08-02).
 *
 * ── The gap this closes ────────────────────────────────────────────────────
 *
 *   > "Step 2 currently reports '41 awaiting review' but provides no steward
 *   >  review surface. The Track 2 programme must open the pending Corpus
 *   >  Scout queue so I can review, admit, reject or defer each candidate."
 *
 * Everything downstream of this stage is downstream of these decisions, so an
 * unactionable Stage 2 made the whole programme unactionable.
 *
 * ── What is NOT here ───────────────────────────────────────────────────────
 *
 * No decision logic. The decision vocabulary, the status mapping and the
 * hand-off to the Ingestion Broker all live in
 * `POST /api/corpus-scout/candidates/[sourceId]/review`, which already
 * implements PRD-ICA-001 §6/§8/§9 — approval and ingestion are ONE reviewer
 * action there, and a second copy of that rule here would be the stale one.
 * This component collects a decision and a rationale and posts them.
 *
 * ── Defer is not in the ratified vocabulary ────────────────────────────────
 *
 * Al asked for Admit / Reject / Defer. §8's eleven statuses contain no
 * `deferred`: a source either carries a decision or remains `pending_review`.
 * Leaving it pending IS defer’s effect, and that is what "Leave pending" does —
 * it records nothing and changes nothing, which is exactly why it is not
 * dressed up as a governance act. A real deferral (with its own status,
 * rationale and receipt) is an amendment to PRD-ICA-001 §8 and to the column’s
 * enum, not a button a UI may invent. Reported, not fabricated.
 */
function CorpusReviewQueue({
  acquisitionDomain,
  onDone,
}: {
  acquisitionDomain: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CandidateSource[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] = useState<AdmissionRecommendation[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsErr, setRecsErr] = useState<string | null>(null);
  const [isolation, setIsolation] = useState<IsolationSummary | null>(null);
  const [population, setPopulation] = useState<PopulationDisclosure | null>(null);
  const [duplicatePlans, setDuplicatePlans] = useState<DuplicateResolutionPlan[] | null>(null);
  const [duplicateDryRun, setDuplicateDryRun] = useState<DuplicateResolutionDryRun | null>(null);
  const [criticalPath, setCriticalPath] = useState<{
    nextSafeAct: string;
    deferred: string;
    milestoneImpact: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!acquisitionDomain) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates?campaignDomain=${encodeURIComponent(acquisitionDomain)}` +
          `&reviewWorkflowStatus=pending_review`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `the review queue could not be read (HTTP ${res.status})`);
      setRows((d.candidates ?? []) as CandidateSource[]);
      // A selection is over rows that were in the queue when it was made. After
      // a reload the decided ones have LEFT, so carrying the set forward would
      // hold ids that are no longer selectable and silently understate what a
      // subsequent batch would touch.
      setSelected(new Set());
      // A stale recommendation set is worse than none — a source that just
      // left the queue (decided) or a newly-admitted source's freshly-computed
      // lineage would make an old recommendation set wrong in either
      // direction. Cleared on every reload; the operator re-prepares.
      setRecommendations(null);
      setDuplicatePlans(null);
      setDuplicateDryRun(null);
      setIsolation(null);
      setPopulation(null);
      setCriticalPath(null);
    } catch (e) {
      // Unreadable is not empty. An empty list here would read as "nothing to
      // review" on the one surface whose job is to show what is.
      setRows(null);
      setErr(e instanceof Error ? e.message : "the review queue could not be read");
    } finally {
      setLoading(false);
    }
  }, [acquisitionDomain]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  /*
   * PREPARE RECOMMENDATIONS (Track 2 Stage 2, 2026-08-03 operator correction).
   *
   * Calls the read-only `/api/corpus-scout/candidates/prepare-recommendations`
   * route, which aggregates the platform's EXISTING invariant lineage back
   * onto each pending source (`services/corpusScout/admissionRecommendation.ts`
   * — no fresh domain guess, no write). This state holds the PREPARED
   * recommendations only; nothing is admitted until the steward ratifies a
   * cohort below, which posts through the SAME governed `bulk-review` route
   * every manual batch already uses.
   */
  const prepareRecommendations = useCallback(async () => {
    if (!acquisitionDomain) return;
    setRecsLoading(true);
    setRecsErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates/prepare-recommendations?campaignDomain=${encodeURIComponent(acquisitionDomain)}`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `recommendations could not be prepared (HTTP ${res.status})`);
      setRecommendations((d.recommendations ?? []) as AdmissionRecommendation[]);
      // The executable batch, the population and the critical path are all
      // computed SERVER-SIDE from the shared isolation model. None of them is
      // re-derived here — a client that recomputed the counts could disagree
      // with the button it renders (inv.engineering.036).
      setIsolation((d.summary ?? null) as IsolationSummary | null);
      setDuplicatePlans((d.duplicateResolutions ?? null) as DuplicateResolutionPlan[] | null);
      setDuplicateDryRun((d.duplicateDryRun ?? null) as DuplicateResolutionDryRun | null);
      setPopulation((d.population ?? null) as PopulationDisclosure | null);
      setCriticalPath(
        (d.criticalPath ?? null) as { nextSafeAct: string; deferred: string; milestoneImpact: string } | null,
      );
    } catch (e) {
      setRecommendations(null);
      setDuplicatePlans(null);
      setDuplicateDryRun(null);
      setIsolation(null);
      setPopulation(null);
      setCriticalPath(null);
      setRecsErr(e instanceof Error ? e.message : "recommendations could not be prepared");
    } finally {
      setRecsLoading(false);
    }
  }, [acquisitionDomain]);

  /*
   * THE WHOLE CANON, AS A FILE (operator, 2026-08-02).
   *
   *   > "a link to download the json for all the sources in the canon so I can
   *   >  provide the list to Al to assist in filtering"
   *
   * DELIBERATELY NOT the review queue. The queue is the sources awaiting a
   * decision; the canon is every source discovery has produced, whatever its
   * status — filtering advice about a corpus cannot be given from a view that
   * has already dropped the rejected and the admitted.
   *
   * The list projection truncates `normalizedText` to stay under the response
   * cap, so the export SAYS SO in its own envelope. A file that looks complete
   * and is not is worse than one that declares its edges — whoever reads this
   * downstream is entitled to know which fields are whole.
   */
  const exportCanon = useCallback(async () => {
    if (!acquisitionDomain) return;
    setExporting(true);
    setExportErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates?campaignDomain=${encodeURIComponent(acquisitionDomain)}`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `the source canon could not be read (HTTP ${res.status})`);
      const candidates = (d.candidates ?? []) as CandidateSource[];
      const envelope = {
        acquisitionDomain,
        exportedAt: new Date().toISOString(),
        sourceCount: candidates.length,
        byReviewStatus: candidates.reduce<Record<string, number>>((acc, c) => {
          const k = (c as unknown as { reviewWorkflowStatus?: string }).reviewWorkflowStatus ?? "unknown";
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
        completeness:
          "normalizedText is TRUNCATED in this export — the list projection caps it to keep the response " +
          "under the serverless payload limit. normalizedTextChars carries each source's true length. Every " +
          "other field is whole. Nothing has been filtered out: this is every candidate source in the domain, " +
          "at every review status.",
        candidates,
      };
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `corpus-canon-${acquisitionDomain}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : "the source canon could not be exported");
    } finally {
      setExporting(false);
    }
  }, [acquisitionDomain]);

  /*
   * Search over what has been READ, never a second query. A server-side filter
   * would be a parallel implementation of a list this component already holds,
   * and the two would answer differently the moment either changed. Matches
   * across the fields a reviewer actually recognises a source by.
   */
  const q = query.trim().toLowerCase();
  const visible = !rows
    ? null
    : q === ""
      ? rows
      : rows.filter((r) =>
          [r.title, r.issuer ?? "", r.canonicalUrl, r.campaignSubDomain ?? "", r.authors.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );

  /*
   * EXACT-DUPLICATE GROUPS, ON THE SURFACE THAT DECIDES (2026-08-03).
   *
   * `findDuplicateCandidates` has existed since Phase 3 and CorpusScoutTab
   * renders it — but the Track 2 review queue, which is where the operator
   * actually decides these forty sources, did not. Admitting both members of a
   * byte-identical pair ingests the same document twice as two evidence rows,
   * and nothing downstream would tell them apart. The SAME function is called
   * here; the grouping is not re-derived (inv.engineering.037).
   */
  const duplicateGroups: DuplicateGroup[] = useMemo(
    () =>
      findDuplicateCandidates(
        (rows ?? []).map((r) => ({
          sourceId: r.sourceId,
          artifactHash: r.artifactHash,
          // The list projection does not carry normalizedTextHash, so this
          // axis genuinely cannot be checked here. Passing null is the honest
          // input — never the artifact hash standing in for it.
          normalizedTextHash: null,
          canonicalUrl: r.canonicalUrl,
        })),
      ),
    [rows],
  );
  const duplicateSourceIds = useMemo(
    () => new Set(duplicateGroups.flatMap((g) => g.sourceIds)),
    [duplicateGroups],
  );
  /** sourceId → row, for the recommendation cohorts to resolve a title/warning
   *  context without re-fetching what `load()` already holds. */
  const rowsById = useMemo(() => new Map((rows ?? []).map((r) => [r.sourceId, r])), [rows]);

  /*
   * ISSUER GROUPS — the shape a batch actually has.
   *
   * The case for bulk is a run of sources from ONE institution where the
   * constitutional judgment is the same for all of them. Grouping by issuer is
   * that case made selectable, and the tier is read from the ratified
   * Institutional Registry (`findRegistryEntry`, keyed by domain + pillar +
   * institution — never institution alone, which would return one pillar's
   * tradition when the source belongs to another). An issuer with no registry
   * entry gets `null`, reported as undeclared rather than assumed
   * authoritative — the same fail-closed posture `assessRegistryDiversity`
   * takes.
   */
  const issuerGroups = useMemo(() => {
    const groups = new Map<string, { issuer: string; tier: SourceTier | null; sourceIds: string[] }>();
    for (const r of visible ?? []) {
      const issuer = r.issuer?.trim();
      if (!issuer) continue;
      const entry = r.campaignSubDomain
        ? findRegistryEntry(r.campaignDomain, r.campaignSubDomain, issuer)
        : null;
      const g = groups.get(issuer) ?? { issuer, tier: entry?.tier ?? null, sourceIds: [] };
      g.sourceIds.push(r.sourceId);
      groups.set(issuer, g);
    }
    return [...groups.values()]
      .filter((g) => g.sourceIds.length > 1)
      .sort((a, b) => b.sourceIds.length - a.sourceIds.length || a.issuer.localeCompare(b.issuer));
  }, [visible]);

  const selectedRows = (rows ?? []).filter((r) => selected.has(r.sourceId));
  const toggle = (sourceId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });

  if (!acquisitionDomain) {
    return (
      <div className="mt-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-400">
        The acquisition domain was not returned by the programme read, so the review queue cannot be opened
        against a domain this surface is sure of. Refresh; if it persists, the Track 2 route is not answering.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-slate-800 bg-slate-900/40 p-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-[11px] font-medium text-slate-200"
      >
        <span>{open ? "Hide the review queue" : "Open the review queue"}</span>
        <span className="font-mono text-[10px] text-slate-500">{acquisitionDomain}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> reading the queue…
            </div>
          )}
          {err && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">
              {err}
            </div>
          )}
          {rows !== null && (
            <div className="flex flex-wrap items-center gap-2">
              {/* `type="search"` gives the browser's own clear affordance, and
                  autoComplete/spellCheck off keeps the browser from putting a
                  remembered value into a box whose only job is to HIDE rows —
                  a filter nobody typed is indistinguishable from an empty
                  queue. */}
              <input
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search title, issuer, author, URL, sub-domain"
                className="min-w-[12rem] flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
              />
              {q !== "" && (
                <button
                  onClick={() => setQuery("")}
                  className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60"
                >
                  Clear search
                </button>
              )}
              <button
                onClick={() => void exportCanon()}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Download the whole canon (JSON)
              </button>
            </div>
          )}
          {exportErr && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">
              {exportErr}
            </div>
          )}
          {rows !== null && visible !== null && q !== "" && (
            <div className="text-[10px] text-slate-500">
              {visible.length} of {rows.length} awaiting-decision source(s) match. The search filters this queue
              only — the download is always the whole canon, every status included.
            </div>
          )}
          {/*
            A SEARCH THAT MATCHES NOTHING MUST SAY SO (operator, 2026-08-02,
            14:33: "After I admit the first entry I can't scroll through or
            access the rest ... I need to exit the modal and return").

            With a filter active and no matches, the list rendered NOTHING —
            no rows, no explanation, no way back except unmounting the surface.
            An empty result and an empty queue looked identical, and the
            control that caused it was a text box the operator may not have
            put text into.
          */}
          {rows !== null && visible !== null && visible.length === 0 && rows.length > 0 && (
            <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-100">
              No source matches “{query}”. {rows.length} source(s) are still awaiting a decision — the search is
              hiding them, nothing has been removed. A source you have just decided will not appear here: it has
              left the queue.
              <button
                onClick={() => setQuery("")}
                className="ml-2 rounded border border-amber-500/30 px-2 py-0.5 text-amber-100 hover:bg-amber-500/10"
              >
                Show all {rows.length}
              </button>
            </div>
          )}
          {rows !== null && rows.length === 0 && !loading && (
            <div className="text-[11px] text-slate-400">
              No source is awaiting a decision in this domain. This is a read of the queue, not an assumption —
              sources already decided are not shown here. The canon download still returns every source.
            </div>
          )}
          {/*
            THE QUEUE SCROLLS ITSELF.

            Forty cards rendered inline are only reachable if every ancestor
            happens to let the page grow — inside the cartridge embed that is
            not something this surface can assume, and the operator could not
            reach past the first entries without unmounting and remounting the
            stage. A bounded, self-scrolling region depends on nothing above it.
          */}
          {duplicateGroups.length > 0 && (
            <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-100">
              <strong className="font-medium">
                {duplicateGroups.length} exact-duplicate group(s) in this queue.
              </strong>{" "}
              Byte- or URL-identical only — paraphrases and revised editions are NOT detected, and that judgment
              stays yours. Admitting more than one member of a group ingests the same document twice.
              <ul className="mt-1 space-y-0.5">
                {duplicateGroups.map((g) => (
                  <li key={`${g.matchType}:${g.key}`} className="font-mono text-[10px] text-amber-200/80">
                    {g.matchType}: {g.sourceIds.join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rows !== null && rows.length > 0 && (
            <div className="rounded border border-slate-700 bg-slate-950/40 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-200">
                  Machine-recommended cohorts
                </span>
                <button
                  onClick={() => void prepareRecommendations()}
                  disabled={recsLoading}
                  className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
                >
                  {recsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {recommendations ? "Refresh recommendations" : "Prepare recommendations"}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Aggregates the corpus&rsquo;s EXISTING invariant lineage and this source&rsquo;s own recorded quality
                signals into a proposed admission class and sub-domain per pending source. Writes nothing — the
                steward still ratifies each cohort explicitly below, through the same governed route a manual batch
                uses.
              </p>
              {recsErr && (
                <div className="mt-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[11px] text-rose-200">
                  {recsErr}
                </div>
              )}
              {isolation && (
                <ExecutableBatchSummary
                  isolation={isolation}
                  population={population}
                  criticalPath={criticalPath}
                />
              )}
              {duplicatePlans && duplicatePlans.length > 0 && acquisitionDomain && (
                <DuplicateResolutionBoard
                  plans={duplicatePlans}
                  dryRun={duplicateDryRun}
                  campaignDomain={acquisitionDomain}
                  onResolved={() => {
                    void load();
                    void prepareRecommendations();
                    onDone();
                  }}
                />
              )}
              {isolation && isolation.exceptions.length > 0 && (
                <ExceptionsSurface
                  exceptions={isolation.exceptions}
                  rowsById={rowsById}
                  resolvedGroupSourceIds={
                    new Set((duplicatePlans ?? []).flatMap((pl) => pl.copies.map((c) => c.sourceId)))
                  }
                />
              )}
              {recommendations && (
                <RecommendationCohorts
                  recommendations={recommendations}
                  rowsById={rowsById}
                  duplicateSourceIds={duplicateSourceIds}
                  onDone={() => {
                    void load();
                    onDone();
                  }}
                />
              )}
            </div>
          )}

          {rows !== null && visible !== null && visible.length > 0 && (
            <BulkAdmissionControl
              visible={visible}
              selected={selected}
              selectedRows={selectedRows}
              duplicateSourceIds={duplicateSourceIds}
              issuerGroups={issuerGroups}
              onSelectAllVisible={() => setSelected(new Set(visible.map((r) => r.sourceId)))}
              onSelectIssuer={(ids) => setSelected(new Set(ids))}
              onClearSelection={() => setSelected(new Set())}
              onDone={() => {
                void load();
                onDone();
              }}
            />
          )}

          <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {visible?.map((r) => (
            <CandidateReviewCard
              key={r.sourceId}
              row={r}
              selected={selected.has(r.sourceId)}
              onToggleSelected={() => toggle(r.sourceId)}
              isDuplicate={duplicateSourceIds.has(r.sourceId)}
              onDecided={() => {
                void load();
                onDone();
              }}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The fields the list projection returns. `normalizedText` is truncated by the
 *  server (Lambda response cap) — `normalizedTextChars` carries the true
 *  length, so a preview is never mistaken for the whole document. */
interface CandidateSource {
  sourceId: string;
  title: string;
  issuer: string | null;
  authors: string[];
  publicationDate: string | null;
  canonicalUrl: string;
  campaignDomain: string;
  campaignSubDomain: string | null;
  acquisitionMethod: string;
  licenseStatus: string;
  provenanceClass: string | null;
  extractionStatus: string;
  extractionWarnings: string[];
  structuralTags: string[];
  pageCount: number | null;
  fileSizeBytes: number | null;
  artifactHash: string | null;
  normalizedText: string;
  normalizedTextChars?: number;
  duplicateOfSourceId: string | null;
  retrievedAt: string | null;
}

/** §9's decisions, with what each one ACTUALLY does — the two that hand the
 *  source to the Ingestion Broker are marked, because "approve" and "approve
 *  and ingest" are not the same act and the operator is choosing between
 *  them. Taken from APPROVED_FOR_INGESTION, not restated from memory. */
const DECISIONS: {
  value: string;
  label: string;
  kind: "admit" | "reject";
  consequence: string;
}[] = [
  {
    value: "approve_exp_p1",
    label: "Admit — EXP-P1",
    kind: "admit",
    consequence: "Hands the source to the Ingestion Broker as EXP-P1 evidence. This is the admission that feeds the crystal.",
  },
  {
    value: "approve_general_finance",
    label: "Admit — general finance",
    kind: "admit",
    consequence: "Hands the source to the Ingestion Broker as general financial evidence, outside the EXP-P1 lane.",
  },
  {
    value: "approve_reference_only",
    label: "Admit — reference only",
    kind: "admit",
    consequence: "Recorded as admitted for reference. NOT ingested — it will not become evidence.",
  },
  {
    value: "reject_out_of_domain",
    label: "Reject — out of domain",
    kind: "reject",
    consequence: "Outside the ratified acquisition domain.",
  },
  {
    value: "reject_low_substance",
    label: "Reject — low substance",
    kind: "reject",
    consequence: "Too little substantive content to ground an invariant.",
  },
  {
    value: "reject_provenance",
    label: "Reject — provenance",
    kind: "reject",
    consequence: "The source’s provenance cannot be established to the standard the corpus requires.",
  },
  {
    value: "reject_access_or_license",
    label: "Reject — access or licence",
    kind: "reject",
    consequence: "Access or licensing forbids using this source as corpus evidence.",
  },
];

/**
 * IS THIS A TITLE, OR IS IT WHAT THE CRAWLER FOUND WHERE A TITLE SHOULD BE?
 *
 * ── The finding (Al, 2026-08-02, reviewing the canon export) ───────────────
 *
 *   > "BIS titles are duplicated as 'survey of the users of BIS research'
 *   >  CFTC titles appear only as 'PDF' ... I would not admit any CFTC
 *   >  document until the title is resolved."
 *
 * THE JUDGEMENT ITSELF NOW LIVES SERVER-SIDE, in
 * `services/corpusScout/admissionRecommendation.ts::titleResolutionIssue`
 * (moved 2026-08-03), because the recommendation pass needs the SAME answer
 * this card renders — and a second copy would have been the stale one
 * (inv.engineering.036). This wrapper only adapts the row shape.
 *
 * It does not repair the title, and — since the exception-isolation ruling §4
 * — it does not BLOCK the source either: an unresolved title on a source whose
 * content is verifiable is a recorded warning that rides into the receipt,
 * never a refusal.
 */
function titleLooksUnresolved(row: CandidateSource): string | null {
  return titleResolutionIssue(row.title, row.canonicalUrl);
}

/**
 * A governance-relevant field and whether it was actually captured.
 *
 * Al's point is that a steward should not have to INFER: a blank row and a row
 * whose publication date genuinely was never extracted look identical, and
 * only one of them is a reason to hesitate. So absence is rendered, not
 * omitted.
 *
 * Fields Corpus Scout does not capture at all today — regulation/programme,
 * document type, jurisdiction, and Corpus Scout's own relevance rationale —
 * are deliberately NOT listed here. Rendering a permanently-empty row for each
 * would be noise pretending to be rigour; they are named once, below the
 * captured fields, as what the pipeline does not yet produce.
 */
function bibliographicFields(row: CandidateSource): { label: string; value: string | null }[] {
  return [
    { label: "Institution", value: row.issuer },
    { label: "Published", value: row.publicationDate },
    { label: "Authors", value: row.authors.length > 0 ? row.authors.join(", ") : null },
    { label: "Pages", value: row.pageCount !== null ? String(row.pageCount) : null },
    { label: "Licence", value: row.licenseStatus && row.licenseStatus !== "unknown" ? row.licenseStatus : null },
  ];
}

/**
 * A GOVERNED batch admission (Track 2 Stage 2, 2026-08-03).
 *
 *   > Stage 2 holds tens of sources and offered only a per-source form.
 *
 * Deciding forty sources one at a time is not more rigorous than deciding them
 * together — past a certain count it is less, because the reviewer stops
 * reading. This control makes the batch an EXPLICIT act with one stated
 * rationale and one receipt, rather than forty unreceipted repetitions.
 *
 * It relaxes nothing. The route it posts to loops the SAME
 * `applyCandidateReviewDecision` the single-source route calls, so every
 * refusal is identical. What this component adds is the two-step posture the
 * crystal-assignment control already uses:
 *
 *   1. INSPECT (`dryRun: true`, the server's own default) — reports what each
 *      source's status is now and what the batch WOULD do to it, writing
 *      nothing.
 *   2. RECORD — enabled only after an inspection has been seen and a rationale
 *      entered. Never the first thing a click can do.
 *
 * Per-source outcomes are rendered individually, including ingestion failures,
 * so a batch is never summarised as "succeeded" when a member did not.
 */
function BulkAdmissionControl({
  visible,
  selected,
  selectedRows,
  duplicateSourceIds,
  issuerGroups,
  onSelectAllVisible,
  onSelectIssuer,
  onClearSelection,
  onDone,
  initialDecision,
  initialProvenanceClass,
  initialNotes,
}: {
  visible: CandidateSource[];
  selected: Set<string>;
  selectedRows: CandidateSource[];
  duplicateSourceIds: Set<string>;
  issuerGroups: { issuer: string; tier: SourceTier | null; sourceIds: string[] }[];
  onSelectAllVisible: () => void;
  onSelectIssuer: (sourceIds: string[]) => void;
  onClearSelection: () => void;
  onDone: () => void;
  /*
   * PRESELECTION, for a caller that already knows what this batch should be
   * (the machine-recommended cohorts, `RecommendationCohorts` below). Nothing
   * here changes the write path or its refusals — a preselected decision is
   * still just the `decision` state's initial value, still requires the SAME
   * Inspect-then-Record steps, and the operator can change it before either
   * click. Manual bulk-admission callers omit these and get the pre-existing
   * blank-start behaviour unchanged.
   */
  initialDecision?: string;
  initialProvenanceClass?: string;
  initialNotes?: string;
}) {
  const [decision, setDecision] = useState(initialDecision ?? "");
  const [provenanceClass, setProvenanceClass] = useState(initialProvenanceClass ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [absorbed, setAbsorbed] = useState<AbsorbedExecutionSummary | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [showPartition, setShowPartition] = useState(false);

  const chosen = DECISIONS.find((d) => d.value === decision) ?? null;
  const requiresProvenanceClass = chosen?.consequence.includes("Ingestion Broker") ?? false;
  // An inspection is only an inspection OF the current selection and decision.
  // Changing either invalidates it, so the record button re-locks rather than
  // letting a stale dry run authorise a different act.
  const inspection =
    result && result.dryRun && result.decision === decision && result.requested === selected.size ? result : null;

  const selectedDuplicates = selectedRows.filter((r) => duplicateSourceIds.has(r.sourceId));

  /*
   * EXECUTION CONSTRAINT ABSORPTION (operator ruling, 2026-08-03).
   *
   *   > "Implementation constraints that do not alter constitutional intent
   *   >  shall be absorbed by the system rather than projected onto the
   *   >  operator."
   *
   * The server caps a batch at 25 and REFUSES rather than truncating — which is
   * correct and unchanged, because a silently truncated batch reporting success
   * is the population-shrink defect. What was wrong was handing the operator
   * the remedy ("Split the selection") when the system already held every fact
   * needed to perform it: the selection, the limit, one disposition, one
   * provenance class, one rationale, and no constitutional difference whatever
   * between one batch and two.
   *
   * So the executor absorbs it: ONE operator act, N requests, EACH still
   * carrying its own governed receipt. The operator thinks "admit these
   * sources", never "execute two POSTs because the backend limits batches".
   *
   * Partial failure stays HONEST. If batch 2 fails after batch 1 succeeded,
   * `summariseAbsorbedExecution` reports exactly that — how many were recorded,
   * how many were not, and where it stopped. Absorbing the batching must never
   * reintroduce the defect the refusal was protecting against.
   */
  const post = useCallback(
    async (dryRun: boolean) => {
      if (selected.size === 0 || !chosen) return;
      setBusy(true);
      setErr(null);
      setAbsorbed(null);

      const batches = partitionForExecution([...selected]);
      const outcomes: ExecutionBatchOutcome[] = [];
      const merged: BulkResult["outcomes"] = [];
      let written = 0;
      let requested = 0;
      let decided = 0;
      let ingestionFailures = 0;
      let receiptsWritten = 0;

      try {
        for (const batch of batches) {
          setProgress({ current: batch.ordinal, total: batches.length });
          const res = await personaFetch("/api/corpus-scout/candidates/bulk-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceIds: batch.sourceIds,
              decision: chosen.value,
              notes: notes.trim(),
              provenanceClass: provenanceClass || undefined,
              dryRun,
            }),
          });
          const d = await res.json().catch(() => null);
          if (!d?.ok) {
            // STOP HERE, and say so. Continuing past a failure would leave the
            // operator unable to tell which sources were recorded.
            outcomes.push({
              ordinal: batch.ordinal,
              sourceIds: batch.sourceIds,
              ok: false,
              error: d?.error || `batch ${batch.ordinal} was not processed (HTTP ${res.status})`,
            });
            break;
          }
          const bulk = d as BulkResult;
          outcomes.push({
            ordinal: batch.ordinal,
            sourceIds: batch.sourceIds,
            ok: true,
            written: bulk.written,
            ingestionFailures: bulk.ingestionFailures,
            receiptWritten: bulk.receiptWritten,
          });
          merged.push(...bulk.outcomes);
          written += bulk.written;
          requested += bulk.requested;
          decided += bulk.decided;
          ingestionFailures += bulk.ingestionFailures;
          if (bulk.receiptWritten) receiptsWritten += 1;
        }

        const summary = summariseAbsorbedExecution({
          totalSelected: selected.size,
          batches,
          outcomes,
        });
        setAbsorbed(summary);
        setResult({
          dryRun,
          decision: chosen.value,
          requested,
          decided,
          written,
          ingestionFailures,
          // EACH BATCH KEEPS ITS OWN RECEIPT — that is the constitutional part
          // and is not collapsed. This flag reports whether EVERY batch was
          // receipted, so a missing one cannot hide behind a successful sibling.
          receiptWritten: receiptsWritten === outcomes.filter((o) => o.ok).length && receiptsWritten > 0,
          receiptWarning:
            receiptsWritten < outcomes.filter((o) => o.ok).length
              ? `${outcomes.filter((o) => o.ok).length - receiptsWritten} batch receipt(s) were not written. The decisions stand; the attributable record of those batches does not.`
              : null,
          outcomes: merged,
        });
        if (!dryRun && summary.batchesSucceeded > 0) onDone();
      } catch (e) {
        const summary = summariseAbsorbedExecution({ totalSelected: selected.size, batches, outcomes });
        setAbsorbed(summary);
        setErr(
          e instanceof Error
            ? `${e.message} — ${summary.headline}`
            : `the batch was not processed — ${summary.headline}`,
        );
      } finally {
        setProgress(null);
        setBusy(false);
      }
    },
    [selected, chosen, notes, provenanceClass, onDone],
  );

  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-200">
          {selected.size} selected of {visible.length} shown
        </span>
        <button
          onClick={onSelectAllVisible}
          className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:bg-slate-800/60"
        >
          Select all shown
        </button>
        {selected.size > 0 && (
          <button
            onClick={onClearSelection}
            className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-slate-300 hover:bg-slate-800/60"
          >
            Clear selection
          </button>
        )}
      </div>

      {issuerGroups.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500">by institution:</span>
          {issuerGroups.map((g) => (
            <button
              key={g.issuer}
              onClick={() => onSelectIssuer(g.sourceIds)}
              title={
                g.tier
                  ? `${g.issuer} — ${g.tier} in the ratified Institutional Registry`
                  : `${g.issuer} — no tier declared in the ratified Institutional Registry for this pillar. Undeclared is never counted as an authority.`
              }
              className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/60"
            >
              {g.issuer} ({g.sourceIds.length})
              <span className={g.tier === "institutional-authority" ? " text-emerald-300" : " text-slate-500"}>
                {" "}
                {g.tier ?? "tier undeclared"}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected.size === 0 ? (
        <p className="mt-1 text-[10px] text-slate-500">
          Tick sources to decide them together under one rationale and one receipt. Each is still recorded
          individually, through the same route and the same refusals as a single decision.
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {/* THE WARNING NOW TERMINATES IN AN ACT (UX II, 2026-08-03).
              It previously ended "…only you can say which copy is canonical",
              which was true before the resolution board existed and is stale
              now: the board above derives a canonical copy, explains it, and
              resolves the group in place. A warning with no act attached is
              the diagnosis-only defect. */}
          {selectedDuplicates.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-100">
              {selectedDuplicates.length} selected source(s) belong to an exact-duplicate group. Admitting more than
              one member ingests the same document twice.{" "}
              <strong className="font-medium">
                Resolve them in the duplicate panel above — it recommends a canonical copy and preserves the other as
                an alias in one act.
              </strong>{" "}
              This is not blocked; you may still admit them and decide later.
            </div>
          )}
          <select
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value);
              setResult(null);
            }}
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200"
          >
            <option value="">— one decision, applied to every selected source —</option>
            {DECISIONS.filter((d) => d.value !== "mark_duplicate").map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          {chosen && <div className="text-[10px] text-slate-400">{chosen.consequence}</div>}
          {requiresProvenanceClass && (
            <select
              value={provenanceClass}
              onChange={(e) => {
                setProvenanceClass(e.target.value);
                setResult(null);
              }}
              className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200"
            >
              <option value="">
                — provenance class (required; every source in the batch is admitted under this one class) —
              </option>
              {PROVENANCE_CLASSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="rationale (required to record — written onto every source in the batch and carried on the receipt)"
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
          />
          {/* SHAPE A — the partition, as expandable DETAIL rather than a
              decision. The operator asked for batching not to surface unless
              asked; this is what "asked" looks like. */}
          {selected.size > ABSORBED_BATCH_LIMIT && (
            <div className="rounded border border-slate-800 bg-slate-900/40 p-1.5 text-[10px]">
              <button
                onClick={() => setShowPartition((v) => !v)}
                className="text-slate-400 underline-offset-2 hover:underline"
              >
                {showPartition ? "Hide" : "Show"} how this will be executed (
                {partitionForExecution([...selected]).length} batches)
              </button>
              {showPartition && chosen && (
                <ul className="mt-1 space-y-0.5 text-slate-400">
                  {renderPartitionPreview(partitionForExecution([...selected]), {
                    decisionLabel: chosen.label,
                    provenanceClass: provenanceClass || null,
                    rationale: notes.trim() || "(none yet)",
                  }).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                  <li className="text-slate-600">
                    Batching is an execution detail, not a decision — each batch is still receipted separately.
                  </li>
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => void post(true)}
              disabled={busy || !chosen || (requiresProvenanceClass && !provenanceClass)}
              className="rounded border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-slate-200 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Inspect (writes nothing)"}
            </button>
            <button
              onClick={() => void post(false)}
              disabled={busy || !inspection || !notes.trim()}
              title={
                !inspection
                  ? "Inspect the batch first — the record button only unlocks against an inspection of this exact selection and decision"
                  : !notes.trim()
                    ? "A rationale is required to record"
                    : undefined
              }
              className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-emerald-200 disabled:opacity-50"
            >
              Record {selected.size} decision(s)
            </button>
          </div>
        </div>
      )}

      {/* SHAPE B — "Executing… Batch 1 of 2…". The operator sees progress, not
          a constraint they must solve. */}
      {progress && (
        <div className="mt-1.5 flex items-center gap-1.5 text-slate-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          Executing… batch {progress.current} of {progress.total}
        </div>
      )}

      {err && <div className="mt-1.5 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}

      {/* PARTIAL FAILURE STAYS HONEST. Absorbing the batching must never
          reintroduce the "partially applied batch reporting success" defect the
          server's refusal was protecting against — so a run that stopped
          partway says which batch it stopped at and names the sources that were
          NOT recorded. */}
      {absorbed && absorbed.outcome !== "complete" && absorbed.batchesAttempted > 0 && (
        <div className="mt-1.5 rounded border border-amber-500/40 bg-amber-500/10 p-1.5 text-amber-100">
          <strong className="font-medium">{absorbed.headline}</strong>
          {absorbed.notRecordedSourceIds.length > 0 && (
            <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-amber-200/80">
              {absorbed.notRecordedSourceIds.map((id) => (
                <li key={id}>{id} — not recorded</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {absorbed && absorbed.outcome === "complete" && absorbed.batchCount > 1 && (
        <div className="mt-1.5 text-[10px] text-slate-500">
          {absorbed.headline} Each batch carries its own receipt.
        </div>
      )}

      {result && (
        <div className="mt-2 space-y-1 rounded border border-slate-800 bg-slate-950 p-2">
          <div className={result.dryRun ? "text-slate-300" : "text-emerald-200"}>
            {result.dryRun
              ? `Inspection — ${result.requested} source(s) would be recorded as this decision. Nothing has been written.`
              : `${result.written} of ${result.requested} recorded.`}
            {!result.dryRun && result.ingestionFailures > 0 && (
              <span className="text-amber-200">
                {" "}
                {result.ingestionFailures} admitted WITHOUT becoming evidence — the Ingestion Broker hand-off failed.
              </span>
            )}
            {!result.dryRun && (
              <span className={result.receiptWritten ? " text-slate-400" : " text-amber-200"}>
                {" "}
                {result.receiptWritten ? "Batch receipt written." : (result.receiptWarning ?? "No batch receipt.")}
              </span>
            )}
          </div>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {result.outcomes.map((o) => (
              <li
                key={o.sourceId}
                className={o.ingested === false || (!o.decided && !result.dryRun) ? "text-amber-200" : "text-slate-400"}
              >
                <span className="font-mono text-[10px]">{o.sourceId}</span> — {o.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * THE EXECUTABLE BATCH (exception-isolation ruling §2, §5, §6).
 *
 *   > "THE PRESENCE OF EXCEPTIONS MUST NOT DISABLE THE PRIMARY ACTION."
 *
 * Renders the counts the operator specified, the FULL population disclosure,
 * and the critical path — all read from the SERVER's computed summary, never
 * recomputed here (a client that recounted could disagree with the button it
 * draws).
 *
 * Three properties are load-bearing and each has a canary:
 *
 *   1. The primary action's enablement comes from
 *      `isolation.primaryActionEnabled`, which is `executable > 0 && no global
 *      stop`. The exception count is deliberately NOT consulted — three
 *      anomalous sources cannot disable admission of thirty eligible ones.
 *   2. The population line is ALWAYS rendered when known. Exception isolation
 *      without population disclosure is a worse failure than the
 *      batch-blocking it replaces: it lets a materially narrow crystal look
 *      complete (ruling §5).
 *   3. A global stop — and ONLY a global stop — turns the action off, and says
 *      which of the five enumerated integrity failures held.
 */
function ExecutableBatchSummary({
  isolation,
  population,
  criticalPath,
}: {
  isolation: IsolationSummary;
  population: PopulationDisclosure | null;
  criticalPath: { nextSafeAct: string; deferred: string; milestoneImpact: string } | null;
}) {
  const c = isolation.counts;
  return (
    <div className="mt-2 rounded border border-slate-700 bg-slate-950 p-2 text-[11px]">
      <div className="text-slate-300">
        {c.total} pending source(s) · <span className="text-emerald-300">{c.ready} ready to admit</span> ·{" "}
        <span className="text-amber-200">{c.readyWithWarning} ready with warnings</span> ·{" "}
        <span className="text-rose-200">{c.exceptions} manual-review exception(s)</span> ·{" "}
        <span className="text-rose-300">{c.refused} refused</span>
      </div>
      <div className="mt-1 font-medium text-slate-100">{isolation.headline}</div>

      {/* THE POPULATION, ALWAYS. Never only what advanced. */}
      {population && (
        <div className="mt-1.5 rounded border border-slate-800 bg-slate-900/40 p-1.5 text-[10px] text-slate-400">
          <span className="text-slate-500">Full population — </span>
          Discovered: {population.discovered} / Admitted: {population.admitted} / Candidates extracted:{" "}
          {population.candidatesExtracted} / Validated: {population.validated} / Assigned to crystal:{" "}
          {population.assignedToCrystal} / Excluded with warnings: {population.excludedWithWarnings} / Exceptions:{" "}
          {population.exceptions} / Refused: {population.refused}
          <div className="mt-0.5 text-slate-600">
            Shown on every act so exception isolation can never quietly narrow the corpus until readiness passes.
          </div>
        </div>
      )}

      {criticalPath && (
        <div className="mt-1.5 space-y-0.5 rounded border border-slate-800 bg-slate-900/40 p-1.5 text-[10px]">
          <div className="text-slate-200">
            <span className="text-slate-500">Next safe act: </span>
            {criticalPath.nextSafeAct}
          </div>
          <div className="text-slate-400">
            <span className="text-slate-500">Deferred: </span>
            {criticalPath.deferred}
          </div>
          <div className="text-slate-400">
            <span className="text-slate-500">Current milestone impact: </span>
            {criticalPath.milestoneImpact}
          </div>
        </div>
      )}

      {/* A GLOBAL STOP IS THE ONLY THING THAT WITHHOLDS THE ACT. */}
      {isolation.globalStop && (
        <div className="mt-1.5 rounded border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-100">
          <strong className="font-medium">Batch integrity failure.</strong> {isolation.globalStop.detail} No record
          can proceed until this is resolved — this is one of the five enumerated conditions that compromise every
          record in the act, not a per-record exception.
        </div>
      )}
      {!isolation.globalStop && c.exceptions + c.refused > 0 && (
        <div className="mt-1.5 text-[10px] text-slate-500">
          The {c.exceptions + c.refused} excluded record(s) are quarantined individually and do not withhold the{" "}
          {c.executable} above. They stay visible, receipted and revisitable below.
        </div>
      )}
    </div>
  );
}

/**
 * THE ONE EXCEPTIONS SURFACE for Track 2 (ruling §8) — grouped by cause, with
 * every exception stating what it affects, why, what follows, what would
 * resolve it, whether it blocks a freeze and whether it can be deferred.
 *
 * `blocksFreeze` is rendered from the record, and the record's value is
 * COMPUTED against the actual crystal (`computeFreezeBlocking`) — never
 * asserted per cause. Almost every Stage 2 exception therefore reads "does not
 * block freeze", which is the honest answer for a source that never entered
 * the corpus.
 */
/**
 * THE DUPLICATE RESOLUTION BOARD — an exception that terminates in an act
 * (operator ruling, 2026-08-03).
 *
 *   > "Present the smallest safe decision at the point where the exception
 *   >  appears, with the evidence and consequence already assembled."
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 *
 * The duplicate exception card previously read "Decide this source individually
 * in the review queue" — a navigation instruction that sent the operator to
 * find records this surface already held, to re-derive a judgement the server
 * had already made, and to re-type a rationale the server had already written.
 *
 * ── The five questions, answered in one place ───────────────────────────────
 *
 *   1. What happened?      → the members side by side, with the duplicate basis
 *   2. What is recommended? → the derived canonical copy
 *   3. Why?                 → the signals that favoured it, named
 *   4. What if I approve?   → the consequence list, stated BEFORE the act
 *   5. What single action?  → "Accept recommendation and continue"
 *
 * Nothing here decides anything: the plan, the rationale and the dry run are
 * all computed server-side, so what the operator confirms is what the executor
 * performs.
 */
function DuplicateResolutionBoard({
  plans,
  dryRun,
  campaignDomain,
  onResolved,
}: {
  plans: DuplicateResolutionPlan[];
  dryRun: DuplicateResolutionDryRun | null;
  campaignDomain: string;
  onResolved: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ previewLines: string[] } | null>(null);
  // Per-group canonical override — "Choose the other copy" without leaving.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [deferred, setDeferred] = useState<Set<string>>(new Set());
  const [rationales, setRationales] = useState<Record<string, string>>({});

  const actionable = plans.filter(
    (p) => p.kind === "recommended-resolution-available" && !deferred.has(p.groupKey),
  );
  const judgement = plans.filter((p) => p.kind === "genuine-judgment-required");

  const post = useCallback(
    async (isDryRun: boolean, groupKeys: string[]) => {
      if (groupKeys.length === 0) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await personaFetch("/api/corpus-scout/candidates/resolve-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignDomain,
            groupKeys,
            canonicalOverrides: overrides,
            dryRun: isDryRun,
            ...(groupKeys.length === 1 && rationales[groupKeys[0]]
              ? { rationale: rationales[groupKeys[0]] }
              : {}),
          }),
        });
        const d = await res.json().catch(() => null);
        if (!d?.ok) throw new Error(d?.error || `the duplicate group was not resolved (HTTP ${res.status})`);
        if (isDryRun) setPreview(d as { previewLines: string[] });
        else {
          setPreview(null);
          onResolved();
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "the duplicate group was not resolved");
      } finally {
        setBusy(false);
      }
    },
    [campaignDomain, overrides, rationales, onResolved],
  );

  return (
    <div className="mt-2 rounded border border-amber-600/40 bg-amber-950/10 p-2 text-[11px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="font-medium text-amber-100">
          {plans.length} exact-duplicate group(s) — {actionable.length} with a recommended resolution
        </span>
        <span className="text-[10px] text-amber-200/70">
          {judgement.length > 0 ? `${judgement.length} need genuine judgement` : "all resolvable now"}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {plans.map((plan) => {
            const canonical = overrides[plan.groupKey] ?? plan.canonicalSourceId;
            const isDeferred = deferred.has(plan.groupKey);
            return (
              <div
                key={plan.groupKey}
                className={`rounded border p-2 ${
                  plan.kind === "recommended-resolution-available"
                    ? "border-slate-700 bg-slate-950"
                    : "border-rose-700/40 bg-rose-950/10"
                }`}
              >
                {/* 1 · WHAT HAPPENED — and why these count as duplicates. */}
                <div className="text-slate-300">{plan.duplicateBasis}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {plan.kind === "recommended-resolution-available"
                    ? "Recommended resolution available — confirm or override."
                    : "Genuine judgement required — the system cannot determine which copy is canonical."}
                </div>

                {/* MEMBERS SIDE BY SIDE, with the evidence already assembled. */}
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {plan.copies.map((copy) => {
                    const f = copy.facts;
                    const isCanonical = copy.sourceId === canonical;
                    return (
                      <div
                        key={copy.sourceId}
                        className={`rounded border p-1.5 ${
                          isCanonical ? "border-emerald-700/60 bg-emerald-950/20" : "border-slate-800 bg-slate-900/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-medium text-slate-100">{f.title}</span>
                          {isCanonical && <span className="shrink-0 text-[10px] text-emerald-300">canonical</span>}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">{copy.sourceId}</div>
                        <a
                          href={f.canonicalUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block truncate font-mono text-[10px] text-cyan-300 hover:underline"
                        >
                          {f.canonicalUrl}
                        </a>
                        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-[10px]">
                          <dt className="text-slate-500">artifact hash</dt>
                          <dd className={f.artifactHash ? "font-mono text-slate-300" : "text-amber-300 italic"}>
                            {f.artifactHash ? `${f.artifactHash.slice(0, 16)}…` : "not recorded"}
                          </dd>
                          <dt className="text-slate-500">pages</dt>
                          <dd className={f.pageCount !== null ? "text-slate-300" : "text-slate-600 italic"}>
                            {f.pageCount ?? "not captured"}
                          </dd>
                          <dt className="text-slate-500">extraction</dt>
                          <dd className={f.extractionStatus === "ok" ? "text-slate-300" : "text-amber-300"}>
                            {f.extractionStatus}
                            {typeof f.normalizedTextChars === "number"
                              ? ` · ${f.normalizedTextChars.toLocaleString()} chars`
                              : ""}
                          </dd>
                          <dt className="text-slate-500">metadata</dt>
                          <dd className="text-slate-300">
                            {[f.issuer && "issuer", f.publicationDate && "date", f.authors.length > 0 && "authors"]
                              .filter(Boolean)
                              .join(", ") || "none captured"}
                          </dd>
                          <dt className="text-slate-500">admission</dt>
                          <dd className="text-slate-300">{f.reviewWorkflowStatus}</dd>
                          <dt className="text-slate-500">sub-domain</dt>
                          <dd className={f.campaignSubDomain ? "text-slate-300" : "text-slate-600 italic"}>
                            {f.campaignSubDomain ?? "unplaced"}
                          </dd>
                          <dt className="text-slate-500">lineage</dt>
                          <dd className={f.evidenceRowId ? "text-slate-300" : "text-slate-600 italic"}>
                            {f.evidenceRowId ? "admitted as evidence" : "none yet"}
                          </dd>
                        </dl>
                      </div>
                    );
                  })}
                </div>

                {/* 2 + 3 · WHAT IS RECOMMENDED, AND WHY. */}
                {plan.kind === "recommended-resolution-available" && (
                  <div className="mt-1.5 rounded border border-slate-800 bg-slate-900/40 p-1.5">
                    <div className="text-slate-200">
                      Recommended canonical source:{" "}
                      <span className="font-mono text-emerald-300">{canonical}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Why: {plan.why.join("; ")}.</div>
                    <div className="text-[10px] text-slate-400">
                      Recommended treatment: exclude the other copy as an exact duplicate and preserve it as an alias
                      to the canonical source.
                    </div>
                  </div>
                )}
                {plan.ambiguity && (
                  <div className="mt-1.5 rounded border border-rose-700/40 bg-rose-950/20 p-1.5 text-[10px] text-rose-100">
                    {plan.ambiguity}
                  </div>
                )}

                {/* 4 · WHAT HAPPENS IF I APPROVE — before the act. */}
                <ul className="mt-1.5 space-y-0.5 text-[10px] text-slate-400">
                  {plan.consequence.map((c, i) => (
                    <li key={i}>· {c}</li>
                  ))}
                </ul>

                {/* THE RATIONALE, PRE-POPULATED AND EDITABLE. Never blank. */}
                <textarea
                  value={rationales[plan.groupKey] ?? plan.rationale}
                  onChange={(e) => setRationales((prev) => ({ ...prev, [plan.groupKey]: e.target.value }))}
                  rows={2}
                  className="mt-1.5 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-200"
                />

                {/* 5 · THE SINGLE ACTION THAT MOVES THE SAFE REMAINDER FORWARD. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {plan.kind === "recommended-resolution-available" && !isDeferred && (
                    <button
                      onClick={() => void post(false, [plan.groupKey])}
                      disabled={busy}
                      className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-emerald-200 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Accept recommendation and continue"}
                    </button>
                  )}
                  {plan.copies
                    .filter((c) => c.sourceId !== canonical)
                    .map((c) => (
                      <button
                        key={c.sourceId}
                        onClick={() => setOverrides((prev) => ({ ...prev, [plan.groupKey]: c.sourceId }))}
                        className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800/60"
                      >
                        Choose {c.sourceId.slice(0, 22)}… instead
                      </button>
                    ))}
                  <button
                    onClick={() =>
                      setDeferred((prev) => {
                        const next = new Set(prev);
                        if (next.has(plan.groupKey)) next.delete(plan.groupKey);
                        else next.add(plan.groupKey);
                        return next;
                      })
                    }
                    className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800/60"
                  >
                    {isDeferred ? "Un-defer this group" : "Defer this group"}
                  </button>
                  <span className="text-[10px] text-slate-600">
                    Keeping both as distinct editions = defer, then record each with its own decision.
                  </span>
                </div>
              </div>
            );
          })}

          {/* THE BATCH ACT — only over groups with deterministic recommendations. */}
          {actionable.length > 0 && (
            <div className="rounded border border-slate-700 bg-slate-950 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => void post(true, actionable.map((p) => p.groupKey))}
                  disabled={busy}
                  className="rounded border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-slate-200 disabled:opacity-50"
                >
                  Preview resolving {actionable.length} group(s)
                </button>
                <button
                  onClick={() => void post(false, actionable.map((p) => p.groupKey))}
                  disabled={busy || !preview}
                  title={!preview ? "Preview first — the confirm unlocks against an inspection of this exact set" : undefined}
                  className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-emerald-200 disabled:opacity-50"
                >
                  Resolve all recommended exceptions
                </button>
              </div>
              {(preview?.previewLines ?? (dryRun ? null : null)) && (
                <ul className="mt-1.5 space-y-0.5 text-[10px] text-slate-300">
                  {preview!.previewLines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
              {judgement.length > 0 && (
                <div className="mt-1 text-[10px] text-slate-500">
                  {judgement.length} group(s) needing genuine judgement are excluded from this act and stay isolated.
                </div>
              )}
            </div>
          )}

          {err && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ExceptionsSurface({
  exceptions,
  rowsById,
  resolvedGroupSourceIds,
}: {
  exceptions: IsolationException[];
  rowsById: Map<string, CandidateSource>;
  /** Sources whose exception is already answered by the resolution board
   *  above. Listing them again here would show the same problem twice and
   *  invite the operator to act in the weaker of the two places — the "one
   *  decision, one place" rule. */
  resolvedGroupSourceIds?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const unresolved = useMemo(
    () => exceptions.filter((e) => !(resolvedGroupSourceIds?.has(e.recordId) ?? false)),
    [exceptions, resolvedGroupSourceIds],
  );
  const groups = useMemo(() => groupExceptionsByCause(unresolved), [unresolved]);
  const freezeBlockers = unresolved.filter((e) => e.blocksFreeze).length;

  return (
    <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="font-medium text-slate-200">
          Review {unresolved.length} exception(s)
        </span>
        <span className="text-[10px] text-slate-500">
          {groups.length} cause group(s) ·{" "}
          {freezeBlockers === 0 ? "none blocks the freeze" : `${freezeBlockers} block the freeze`}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {groups.map((g) => (
            <div key={g.causeGroup}>
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {EXCEPTION_CAUSE_LABEL[g.causeGroup]} ({g.exceptions.length})
              </div>
              <ul className="mt-0.5 space-y-1">
                {g.exceptions.map((e) => (
                  <li key={e.recordId} className="rounded border border-slate-800 bg-slate-950 p-1.5">
                    <div className="text-slate-200">
                      {rowsById.get(e.recordId)?.title ?? e.recordLabel}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{e.cause}</div>
                    <div className="text-[10px] text-slate-500">{e.consequence}</div>
                    <div className="text-[10px] text-cyan-300/80">{e.recommendedAction}</div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-[10px]">
                      <span className={e.blocksCurrentStage ? "text-rose-300" : "text-slate-600"}>
                        {e.blocksCurrentStage ? "blocks this stage" : "does not block this stage"}
                      </span>
                      <span className={e.blocksCrystalAssignment ? "text-rose-300" : "text-slate-600"}>
                        {e.blocksCrystalAssignment ? "blocks crystal assignment" : "does not block assignment"}
                      </span>
                      <span className={e.blocksReadiness ? "text-rose-300" : "text-slate-600"}>
                        {e.blocksReadiness ? "blocks readiness" : "does not block readiness"}
                      </span>
                      <span className={e.blocksFreeze ? "text-rose-300" : "text-slate-600"}>
                        {e.blocksFreeze ? "BLOCKS FREEZE" : "does not block freeze"}
                      </span>
                      <span className="text-slate-600">
                        {e.deferrableUntil ? `defer until ${e.deferrableUntil}` : "deferrable"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MACHINE-RECOMMENDED COHORTS (Track 2 Stage 2, 2026-08-03 operator
 * correction — "prepare the decision, don't just execute one the operator
 * already made").
 *
 * Groups the prepared `AdmissionRecommendation`s by (admission class,
 * primary sub-domain) — the same shape the operator asked for: "EXP-P1
 * evidence — market integrity: 8", "Reference only: 5", etc. Each cohort maps
 * to exactly ONE `bulk-review` POST when ratified, because every member
 * already shares one recommended decision; the sub-domain is display context,
 * not something `bulk-review` accepts or needs.
 *
 * NO WRITE happens here. Ratifying a cohort renders the EXISTING
 * `BulkAdmissionControl` (preseeded, never auto-submitted) — the same
 * Inspect-then-Record steps, the same refusals, the same route. A `manual
 * review required` cohort offers NO ratify control at all: there is no
 * decision to preseed, so the steward decides those individually below.
 */
function RecommendationCohorts({
  recommendations,
  rowsById,
  duplicateSourceIds,
  onDone,
}: {
  recommendations: AdmissionRecommendation[];
  rowsById: Map<string, CandidateSource>;
  duplicateSourceIds: Set<string>;
  onDone: () => void;
}) {
  // A source may be MOVED to a different EXISTING cohort (never a fabricated
  // one — the move selector only ever offers cohort keys the recommendation
  // pass itself produced) or REMOVED from cohort ratification entirely (it
  // stays in the ordinary per-source queue below, to be decided by hand).
  const [moves, setMoves] = useState<Map<string, string>>(new Map());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const naturalCohortKey = useCallback(
    (r: AdmissionRecommendation) => `${r.admissionClass}::${r.primarySubDomain ?? ""}`,
    [],
  );

  const cohortMeta = useMemo(() => {
    const m = new Map<string, { admissionClass: RecommendedAdmissionClass; primarySubDomain: string | null }>();
    for (const r of recommendations) {
      const key = naturalCohortKey(r);
      if (!m.has(key)) m.set(key, { admissionClass: r.admissionClass, primarySubDomain: r.primarySubDomain });
    }
    return m;
  }, [recommendations, naturalCohortKey]);

  const cohorts = useMemo(() => {
    const groups = new Map<string, AdmissionRecommendation[]>();
    for (const r of recommendations) {
      if (excluded.has(r.sourceId)) continue;
      const key = moves.get(r.sourceId) ?? naturalCohortKey(r);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return [...groups.entries()]
      .map(([key, members]) => {
        const meta = cohortMeta.get(key)!;
        return { key, admissionClass: meta.admissionClass, primarySubDomain: meta.primarySubDomain, members };
      })
      .sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
  }, [recommendations, moves, excluded, naturalCohortKey, cohortMeta]);

  const allCohortKeys = useMemo(() => [...cohortMeta.keys()], [cohortMeta]);

  if (cohorts.length === 0) {
    return <p className="mt-1.5 text-[10px] text-slate-500">No pending source produced a recommendation.</p>;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {cohorts.map((c) => (
        <CohortCard
          key={c.key}
          cohortKey={c.key}
          admissionClass={c.admissionClass}
          primarySubDomain={c.primarySubDomain}
          members={c.members}
          rowsById={rowsById}
          duplicateSourceIds={duplicateSourceIds}
          allCohortKeys={allCohortKeys}
          onMoveSource={(sourceId, targetKey) => setMoves((prev) => new Map(prev).set(sourceId, targetKey))}
          onExcludeSource={(sourceId) => setExcluded((prev) => new Set(prev).add(sourceId))}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

const REVIEW_TIER_LABEL: Record<AdmissionRecommendation["reviewTier"], string> = {
  "auto-include": "auto-include",
  "needs-review": "needs review",
  exception: "exception",
};

function CohortCard({
  cohortKey,
  admissionClass,
  primarySubDomain,
  members,
  rowsById,
  duplicateSourceIds,
  allCohortKeys,
  onMoveSource,
  onExcludeSource,
  onDone,
}: {
  cohortKey: string;
  admissionClass: RecommendedAdmissionClass;
  primarySubDomain: string | null;
  members: AdmissionRecommendation[];
  rowsById: Map<string, CandidateSource>;
  duplicateSourceIds: Set<string>;
  allCohortKeys: string[];
  onMoveSource: (sourceId: string, targetCohortKey: string) => void;
  onExcludeSource: (sourceId: string) => void;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const memberIds = useMemo(() => members.map((m) => m.sourceId).join(","), [members]);
  const rows = useMemo(
    () => members.map((m) => rowsById.get(m.sourceId)).filter((r): r is CandidateSource => Boolean(r)),
    [members, rowsById],
  );
  // Selection defaults to "every member" and re-defaults whenever the cohort's
  // OWN membership changes (a move or exclusion elsewhere) — a stale
  // selection from before a move would silently under- or over-state what
  // "Record" is about to touch.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.sourceId)));
  useEffect(() => {
    setSelected(new Set(memberIds ? memberIds.split(",") : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds]);

  const avgConfidence = members.reduce((sum, m) => sum + m.confidence, 0) / members.length;
  const tierCounts = members.reduce(
    (acc, m) => {
      acc[m.reviewTier] += 1;
      return acc;
    },
    { "auto-include": 0, "needs-review": 0, exception: 0 } as Record<AdmissionRecommendation["reviewTier"], number>,
  );

  if (admissionClass === "manual review required") {
    return (
      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-100">
        <strong className="font-medium">{members.length} source(s) need manual review</strong> — the recommendation
        pass offers no decision for these; a canonical-copy choice, a borderline extraction, or an unverifiable
        artifact hash all require a steward's own judgement. Decide these individually in the queue below.
        <ul className="mt-1 space-y-0.5">
          {members.map((m) => (
            <li key={m.sourceId} className="font-mono text-[10px] text-amber-200/80">
              {rowsById.get(m.sourceId)?.title ?? m.sourceId} — {m.warnings.join(" ") || "see rationale"}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const suggestedNotes =
    `Machine-recommended batch — ${members.length} source(s) recommended '${admissionClass}'` +
    (primarySubDomain ? ` (sub-domain '${primarySubDomain}')` : "") +
    ` by the Track 2 admission-recommendation pass, average confidence ${avgConfidence.toFixed(2)}. ` +
    `Reviewed and ratified by the steward before recording.`;

  return (
    <div className="rounded border border-slate-700 bg-slate-950/60 p-2 text-[11px]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="font-medium text-slate-100">
          {admissionClass}
          {primarySubDomain ? ` — ${primarySubDomain}` : ""}: {members.length}
        </span>
        <span className="text-[10px] text-slate-500">
          avg confidence {avgConfidence.toFixed(2)} · {tierCounts["auto-include"]} auto-include ·{" "}
          {tierCounts["needs-review"]} needs review · {tierCounts.exception} exception
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          <ul className="space-y-1">
            {members.map((m) => (
              <li key={m.sourceId} className="flex flex-wrap items-start justify-between gap-2 rounded border border-slate-800 bg-slate-950 p-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-slate-200">{rowsById.get(m.sourceId)?.title ?? m.sourceId}</div>
                  <div className="text-[10px] text-slate-500">
                    confidence {m.confidence.toFixed(2)} · {REVIEW_TIER_LABEL[m.reviewTier]}
                    {m.provisional ? " · PROVISIONAL (no corpus lineage)" : ""}
                    {duplicateSourceIds.has(m.sourceId) ? " · in a duplicate group" : ""}
                  </div>
                  {m.warnings.length > 0 && (
                    <div className="text-[10px] text-amber-200">{m.warnings.join(" ")}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) onMoveSource(m.sourceId, e.target.value);
                    }}
                    className="rounded border border-slate-800 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-300"
                    aria-label={`move ${m.sourceId} to a different cohort`}
                  >
                    <option value="">move to…</option>
                    {allCohortKeys
                      .filter((k) => k !== cohortKey)
                      .map((k) => (
                        <option key={k} value={k}>
                          {k.replace("::", " — ") || "(uncategorised)"}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => onExcludeSource(m.sourceId)}
                    title="Decide this source individually instead — remove it from cohort ratification"
                    className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800/60"
                  >
                    remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <BulkAdmissionControl
            visible={rows}
            selected={selected}
            selectedRows={rows.filter((r) => selected.has(r.sourceId))}
            duplicateSourceIds={duplicateSourceIds}
            // Institution chips are the manual-selection control's own
            // organising axis; a cohort is already organised by the
            // recommendation, so re-surfacing them here would offer a second,
            // conflicting way to reshape a selection this card already made.
            issuerGroups={[]}
            onSelectAllVisible={() => setSelected(new Set(rows.map((r) => r.sourceId)))}
            onSelectIssuer={() => {}}
            onClearSelection={() => setSelected(new Set())}
            initialDecision={RECOMMENDATION_TO_REVIEW_DECISION[admissionClass] ?? ""}
            initialNotes={suggestedNotes}
            onDone={onDone}
          />
        </div>
      )}
    </div>
  );
}

interface BulkResult {
  dryRun: boolean;
  decision: string;
  requested: number;
  decided: number;
  written: number;
  ingestionFailures: number;
  receiptWritten: boolean;
  receiptWarning: string | null;
  outcomes: {
    sourceId: string;
    priorStatus: string | null;
    decided: boolean;
    written: boolean;
    ingested: boolean | null;
    detail: string;
  }[];
}

function CandidateReviewCard({
  row,
  selected,
  onToggleSelected,
  isDuplicate,
  onDecided,
}: {
  row: CandidateSource;
  selected: boolean;
  onToggleSelected: () => void;
  isDuplicate: boolean;
  onDecided: () => void;
}) {
  const [decision, setDecision] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [provenanceClass, setProvenanceClass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; ingestionFailed: boolean; ingestionError?: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const chosen = DECISIONS.find((d) => d.value === decision) ?? null;
  // The two decisions PRD-ICA-001 §6/§11 hand to the Ingestion Broker are the
  // ones whose consequence text says so — read from the same copy the
  // reviewer sees rather than restating the vocabulary
  // (services/corpusScout/reviewDecision.ts::INGESTING_DECISIONS is the
  // server-side authority; this is UI-only, not a second rule).
  const requiresProvenanceClass = chosen?.consequence.includes("Ingestion Broker") ?? false;

  const submit = useCallback(async () => {
    if (!chosen || !notes.trim()) return;
    if (requiresProvenanceClass && !provenanceClass) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await personaFetch(
        `/api/corpus-scout/candidates/${encodeURIComponent(row.sourceId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: chosen.value,
            notes: notes.trim(),
            provenanceClass: provenanceClass || undefined,
          }),
        },
      );
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `the decision was not recorded (HTTP ${res.status})`);
      // `ok: true` reports the DECISION was recorded — it says nothing about
      // whether ingestion (the actual evidence hand-off) succeeded. Checking
      // only the outer `ok` here previously let an ingestion failure pass as
      // a plain success (2026-08-03 fix — see reviewDecision.ts's module doc).
      const ingestion = d.ingestion as { ok: boolean; error?: string } | undefined;
      setDone({
        label: chosen.label,
        ingestionFailed: Boolean(ingestion && !ingestion.ok),
        ingestionError: ingestion && !ingestion.ok ? ingestion.error : undefined,
      });
      onDecided();
    } catch (e) {
      // A failed decision leaves the source PENDING and says so — the operator
      // must never be left thinking they decided something they did not.
      setErr(e instanceof Error ? e.message : "the decision was not recorded — this source is still pending");
    } finally {
      setBusy(false);
    }
  }, [chosen, notes, provenanceClass, requiresProvenanceClass, row.sourceId, onDecided]);

  if (done) {
    if (done.ingestionFailed) {
      return (
        <div className="rounded border border-amber-600/50 bg-amber-950/20 p-2 text-[11px] text-amber-100">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {row.title} — recorded as {done.label}, but the Ingestion Broker hand-off FAILED: {done.ingestionError}.
          This source is no longer pending review, and it is not yet evidence — it left the queue without becoming
          the thing its own decision label claims.
        </div>
      );
    }
    return (
      <div className="rounded border border-emerald-800/50 bg-emerald-950/20 p-2 text-[11px] text-emerald-200">
        <CheckCircle2 className="mr-1 inline h-3 w-3" />
        {row.title} — {done.label}. Recorded with your rationale.
      </div>
    );
  }

  return (
    <div
      className={`rounded border bg-slate-950/60 p-2 text-[11px] ${
        selected ? "border-emerald-800/60" : "border-slate-800"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`select ${row.title} for a batch decision`}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-100">{row.title}</div>
          {isDuplicate && (
            <div className="mt-0.5 text-[10px] text-amber-200">
              In an exact-duplicate group — another source in this queue is byte- or URL-identical.
            </div>
          )}
        </div>
      </div>
      {(() => {
        const unresolved = titleLooksUnresolved(row);
        return unresolved ? (
          <div className="mt-1 rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-[11px] text-amber-100">
            <strong className="font-medium">The title is unresolved.</strong> {unresolved} Corpus Scout takes
            titles from the link text it followed, or from the URL when there was none — neither is the
            document&rsquo;s own name. Open the source and confirm what this document is before admitting it.
          </div>
        ) : null;
      })()}
      {/* Every governance-relevant field, INCLUDING the ones with no value.
          A blank row and a row whose date was never extracted look identical
          otherwise, and only one of them is a reason to hesitate. */}
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
        {bibliographicFields(row).map((f) => (
          <React.Fragment key={f.label}>
            <dt className="text-slate-500">{f.label}</dt>
            <dd className={f.value ? "text-slate-300" : "text-slate-600 italic"}>
              {f.value ?? "not captured"}
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="mt-0.5 text-[10px] text-slate-500">
        {row.campaignDomain}
        {row.campaignSubDomain ? ` / ${row.campaignSubDomain}` : ""} · acquired via {row.acquisitionMethod} ·
        licence {row.licenseStatus} · extraction {row.extractionStatus}
        {row.pageCount !== null ? ` · ${row.pageCount}pp` : ""}
      </div>
      <a
        href={row.canonicalUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-0.5 block truncate font-mono text-[10px] text-cyan-300 hover:underline"
      >
        {row.canonicalUrl}
      </a>

      {/* Warnings the retrieval and inspection steps already produced. Shown
          on the decision surface because they are what a reviewer is meant to
          weigh, and they were previously only visible to a curl caller. */}
      {row.extractionWarnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {row.extractionWarnings.map((w, i) => (
            <li key={i} className="rounded border border-amber-500/20 bg-amber-500/5 p-1 text-amber-100">
              {w}
            </li>
          ))}
        </ul>
      )}
      {row.duplicateOfSourceId && (
        <div className="mt-1 rounded border border-amber-500/20 bg-amber-500/5 p-1 text-amber-100">
          Already flagged as a duplicate of <span className="font-mono">{row.duplicateOfSourceId}</span>.
        </div>
      )}
      {row.structuralTags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {row.structuralTags.map((t) => (
            <span key={t} className="rounded border border-slate-800 px-1 py-0.5 text-[10px] text-slate-400">
              {t}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-[10px] text-slate-400 underline-offset-2 hover:underline"
      >
        {expanded ? "Hide extracted text" : "Preview extracted text"}
      </button>
      {expanded && (
        <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-1.5 text-[10px] leading-relaxed text-slate-400">
          {row.normalizedText || "(no text was extracted)"}
          {typeof row.normalizedTextChars === "number" &&
            row.normalizedTextChars > row.normalizedText.length && (
              <div className="mt-1 text-slate-600">
                Preview only — {row.normalizedText.length} of {row.normalizedTextChars} characters. The full text
                is held server-side; this list is truncated to stay under the response cap.
              </div>
            )}
        </div>
      )}

      <div className="mt-2 space-y-1.5">
        {/* Said once, plainly, rather than rendered as five empty rows.
            A steward is entitled to know the difference between "this document
            has no jurisdiction" and "we never extract jurisdiction". */}
        <p className="text-[10px] leading-relaxed text-slate-600">
          Corpus Scout does not yet capture regulation or programme, document type, jurisdiction, or its own
          reason for believing this source is relevant. Those are absent from every row, not just this one —
          judge from the title, the issuer and the extracted text.
        </p>
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
        >
          <option value="">— choose a decision —</option>
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {chosen && <div className="text-[10px] text-slate-400">{chosen.consequence}</div>}
        {requiresProvenanceClass && (
          <select
            value={provenanceClass}
            onChange={(e) => setProvenanceClass(e.target.value)}
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
          >
            <option value="">— provenance class (required — the Ingestion Broker refuses without one) —</option>
            {PROVENANCE_CLASSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="rationale (required — recorded on the source as the reviewer's note)"
          className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => void submit()}
            disabled={busy || !chosen || !notes.trim() || (requiresProvenanceClass && !provenanceClass)}
            className={`rounded border px-2.5 py-1 text-[11px] disabled:opacity-50 ${
              chosen?.kind === "reject"
                ? "border-rose-800 bg-rose-900/30 text-rose-200"
                : "border-emerald-800 bg-emerald-900/30 text-emerald-200"
            }`}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Record decision"}
          </button>
          <span className="text-[10px] text-slate-500">
            Leave pending — take no action. There is no ratified `deferred` status; a source with no decision
            stays in this queue, which is what deferring means here.
          </span>
        </div>
        {err && (
          <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Guided crystal assignment. Dry run is the DEFAULT and the only thing the
 * first button does — the server also defaults `dryRun` to true, so a forgotten
 * flag inspects rather than writes. The admit button is disabled until a dry
 * run has been seen and a rationale entered.
 */
function AssignmentControl({ experimentId, onDone }: { experimentId: string; onDone: () => void }) {
  const [derived, setDerived] = useState<DerivedAssignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [idsText, setIdsText] = useState("");
  const [result, setResult] = useState<{
    dryRun: boolean;
    admitted: number;
    refused: number;
    written: number;
    notFound: string[];
    outcomes: AssignmentOutcome[];
    receiptWritten: boolean;
    receiptWarning?: string;
  } | null>(null);

  /*
   * THE DERIVED LIST IS THE PRIMARY PATH (operator ruling, 2026-08-03).
   *
   *   > "Do not accept pasted invariant IDs as the primary path."
   *
   * The server derives every candidate from the substrate, evaluates each one
   * through the SAME `evaluateCrystalAssignment` the write path uses, and
   * returns the cohort plus its hash. This component never decides
   * eligibility — it renders the server's answer and collects one
   * confirmation.
   */
  const loadDerived = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await personaFetch(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/assign`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => null);
      if (!d?.requestSucceeded) throw new Error(d?.error || `the assignment view could not be read (HTTP ${res.status})`);
      const payload = d as DerivedAssignment;
      setDerived(payload);
      // Preselect exactly the executable cohort — the operator does not hunt
      // for the eligible ones, and does not deselect the ineligible ones.
      setSelected(new Set(payload.summary.executableRecordIds));
      setRationale((prev) => prev || payload.suggestedRationale);
      setResult(null);
    } catch (e) {
      setDerived(null);
      setErr(e instanceof Error ? e.message : "the assignment view could not be read");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    void loadDerived();
  }, [loadDerived]);

  // The paste box remains available as an explicit FALLBACK only.
  const pastedIds = idsText.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const invariantIds = showPaste && pastedIds.length > 0 ? pastedIds : [...selected];

  const run = useCallback(
    async (dryRun: boolean) => {
      setBusy(true);
      setErr(null);
      try {
        const res = await personaFetch(
          `/api/research/crystal/${encodeURIComponent(experimentId)}/assign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invariantIds, dryRun, ...(dryRun ? {} : { rationale }) }),
          },
        );
        const d = await res.json().catch(() => null);
        if (!d?.requestSucceeded) throw new Error(d?.error || `assignment failed (HTTP ${res.status})`);
        setResult(d);
        if (!dryRun) {
          onDone();
          void loadDerived();
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "the assignment could not be evaluated");
      } finally {
        setBusy(false);
      }
    },
    [experimentId, invariantIds, rationale, onDone, loadDerived],
  );

  const dryRunSeen = result?.dryRun === true;
  /*
   * EXPECTED GRAPH GROWTH (operator direction, 2026-08-05: "System already
   * knows eligible members, destination crystal, admission order... [+15
   * nodes, +48 edges]"). Computed from `derived.rows`, already fetched for
   * the dry-run cohort — no new call. `newNodes` excludes rows already in
   * the crystal (`alreadyAssigned`); `carriedEdges` is each selected row's
   * OWN already-recorded relationship count, not a re-derivation of the
   * graph — an honest "how connected is what you're about to admit," not a
   * claim about edges this act itself creates (assignment writes no edges).
   */
  const expectedGrowth = useMemo(() => {
    if (!derived) return null;
    const rows = derived.rows.filter((r) => selected.has(r.invariantId));
    return {
      newNodes: rows.filter((r) => !r.alreadyAssigned).length,
      carriedEdges: rows.reduce((sum, r) => sum + r.relationshipCount, 0),
    };
  }, [derived, selected]);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setResult(null);
      return next;
    });

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-200">Eligible invariants — derived, not entered</span>
        <button
          onClick={() => void loadDerived()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </button>
      </div>

      {err && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>
      )}

      {derived && (
        <>
          <ExecutableBatchSummary
            isolation={derived.summary}
            population={derived.population}
            criticalPath={derived.criticalPath}
          />

          <div className="text-[10px] text-slate-500">
            Cohort <span className="font-mono text-slate-400">{derived.cohortHash}</span> · crystal{" "}
            <span className="font-mono text-slate-400">{derived.crystalDomain}</span> · from{" "}
            <span className="font-mono text-slate-400">{derived.acquisitionDomain}</span>
          </div>
          {expectedGrowth && (
            <div className="text-slate-300">
              {selected.size} selected → destination <span className="font-mono text-slate-200">{derived.crystalDomain}</span> ·
              expected <span className="text-emerald-300">+{expectedGrowth.newNodes} node(s)</span>, carrying{" "}
              <span className="text-emerald-300">{expectedGrowth.carriedEdges} relationship(s)</span> already recorded on
              them
            </div>
          )}

          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {derived.rows.map((r) => (
              <li
                key={r.invariantId}
                className={`rounded border p-1.5 ${
                  r.disposition === "ready"
                    ? "border-emerald-800/50 bg-emerald-950/10"
                    : r.disposition === "ready-with-warning"
                      ? "border-amber-600/40 bg-amber-950/10"
                      : "border-slate-800 bg-slate-950"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.invariantId)}
                    disabled={!r.admitted}
                    onChange={() => toggle(r.invariantId)}
                    aria-label={`select ${r.invariantId}`}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200">{r.statement}</div>
                    {/* Provenance, validation and relationship status per
                        invariant — the three facts the steward is deciding on. */}
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      status <span className="text-slate-400">{r.status}</span> · validated{" "}
                      <span className={r.timesValidated > 0 ? "text-slate-400" : "text-amber-300"}>
                        {r.timesValidated}×
                      </span>{" "}
                      · provenance{" "}
                      <span className={r.evidenceProvenance ? "text-slate-400" : "text-amber-300"}>
                        {r.evidenceProvenance ?? "unrecorded"}
                      </span>{" "}
                      · relationships{" "}
                      <span className={r.relationshipCount > 0 ? "text-slate-400" : "text-amber-300"}>
                        {r.relationshipCount}
                      </span>
                      {r.alreadyAssigned ? " · already in crystal" : ""}
                    </div>
                    {r.warnings.map((w, i) => (
                      <div key={i} className="text-[10px] text-amber-200">{w}</div>
                    ))}
                    {!r.admitted && (
                      <div className="mt-0.5 text-[10px]">
                        <div className="text-rose-200">{r.detail}</div>
                        {r.exception && (
                          <div className="text-cyan-300/80">{r.exception.recommendedAction}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {derived.rows.length === 0 && (
            <div className="text-slate-400">
              No invariant carries the <span className="font-mono">{derived.acquisitionDomain}</span> context yet.
              Nothing has failed — Stage 4 promotion is what produces these.
            </div>
          )}
        </>
      )}

      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={3}
        placeholder="why these invariants are admitted (required to write — recorded on the assignment receipt)"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => void run(true)}
          disabled={busy || invariantIds.length === 0}
          className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : `Dry run (${invariantIds.length})`}
        </button>
        <button
          onClick={() => void run(false)}
          disabled={
            busy ||
            !dryRunSeen ||
            !rationale.trim() ||
            (result?.admitted ?? 0) === 0 ||
            derived?.summary.primaryActionEnabled === false
          }
          title={
            derived?.summary.globalStop
              ? derived.summary.globalStop.detail
              : !dryRunSeen
                ? "Dry run first — the confirm unlocks against an inspection of this exact cohort"
                : undefined
          }
          className="rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 text-emerald-200 disabled:opacity-50"
        >
          Assign {invariantIds.length} invariant(s) to the crystal
        </button>
      </div>

      {/*
        THE PASTE PATH IS A FALLBACK, NOT THE PRIMARY (ruling, 2026-08-03).
        Collapsed by default and labelled as such, so the derived cohort is
        what an operator acts on unless they deliberately choose otherwise.
      */}
      <button
        onClick={() => setShowPaste((v) => !v)}
        className="text-[10px] text-slate-500 underline-offset-2 hover:underline"
      >
        {showPaste ? "Hide the manual fallback" : "Manual fallback — paste invariant ids"}
      </button>
      {showPaste && (
        <div className="space-y-1">
          <textarea
            value={idsText}
            onChange={(e) => {
              setIdsText(e.target.value);
              setResult(null);
            }}
            rows={2}
            placeholder="invariant ids, whitespace or comma separated"
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
          />
          <div className="text-[10px] text-slate-500">
            Overrides the derived cohort while non-empty. Every id still goes through the same eligibility
            evaluation — pasting cannot admit something the derived view refused.
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-1">
          <div className="text-slate-300">
            {result.dryRun ? "DRY RUN — nothing written. " : "Written. "}
            {result.admitted} admitted · {result.refused} refused
            {!result.dryRun && ` · ${result.written} context row(s) written`}
            {!result.dryRun && (
              <span className={result.receiptWritten ? " text-emerald-300" : " text-amber-200"}>
                {result.receiptWritten ? " · receipted" : " · RECEIPT FAILED"}
              </span>
            )}
          </div>
          {result.receiptWarning && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-amber-100">
              {result.receiptWarning}
            </div>
          )}
          {result.notFound.length > 0 && (
            <div className="text-amber-200">not found: {result.notFound.join(", ")}</div>
          )}
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {result.outcomes.map((o) => (
              <li
                key={o.invariantId}
                className={`rounded border p-1.5 ${
                  o.admitted ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"
                }`}
              >
                <span className="font-mono text-slate-400">{o.invariantId}</span>{" "}
                <span className={o.admitted ? "text-emerald-300" : "text-amber-200"}>
                  {o.admitted ? "admitted" : o.refusals.join(", ")}
                </span>
                <div className="text-slate-500">{o.detail}</div>
                <div className="text-[10px] text-slate-600">
                  prior domains: {o.priorDomains.join(", ") || "none"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The derived Stage 8 view, as `GET .../assign` returns it. */
interface DerivedAssignment {
  crystalDomain: string;
  acquisitionDomain: string;
  cohortHash: string;
  cohortInvariantIds: string[];
  suggestedRationale: string;
  summary: IsolationSummary;
  population: PopulationDisclosure;
  criticalPath: { nextSafeAct: string; deferred: string; milestoneImpact: string };
  rows: {
    invariantId: string;
    statement: string;
    status: string;
    timesValidated: number;
    evidenceProvenance: string | null;
    relationshipCount: number;
    alreadyAssigned: boolean;
    admitted: boolean;
    refusals: string[];
    detail: string;
    disposition: RecordDisposition;
    warnings: string[];
    exception?: IsolationException;
  }[];
}

/**
 * FROZEN — read-only, one-time (operator bug report, 2026-08-05): "The
 * operator should never be able to 'freeze again.' Freeze is a one-time
 * constitutional act." Rendered INSTEAD of `FreezeControl` the moment
 * `s.status === 'complete'` on the freeze stage — no ceremony inputs, no
 * Preview/Provision/Freeze buttons, no operator reference, no rationale, no
 * boundary acknowledgement. Reads the artifact fresh from the server
 * (GET .../freeze?crystalId=...) rather than trusting any LOCAL state left
 * over from the freeze click itself, so a fresh page load renders this same
 * summary rather than the pre-freeze ceremony.
 */
function FrozenSummary({ experimentId }: { experimentId: string }) {
  const [artifact, setArtifact] = useState<{
    id: string;
    contentHash: string | null;
    commitmentHash: string | null;
    frozenAt: string | null;
    signedBy: string[];
    receiptId: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`, { cache: "no-store" });
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (d?.requestSucceeded && d.artifact) setArtifact(d.artifact);
        else setError((d && typeof d.error === "string" && d.error) || `could not read the frozen artifact (HTTP ${res.status})`);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "could not read the frozen artifact");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [experimentId]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Reading the frozen artifact…
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-emerald-900/60 bg-emerald-950/20 p-2 text-[11px] text-emerald-100">
      <div className="flex items-center gap-1.5 font-medium text-emerald-200">
        <Lock className="h-3.5 w-3.5" /> Frozen — the crystal&apos;s content is fixed and receipted
      </div>
      {error && <div className="text-rose-300">{error}</div>}
      {artifact && (
        <div className="space-y-1 text-emerald-200/80">
          <div>
            Frozen at <span className="text-emerald-100">{artifact.frozenAt ?? "—"}</span>
          </div>
          <div>
            Content hash{" "}
            <span className="font-mono text-emerald-100">{artifact.contentHash ? `${artifact.contentHash.slice(0, 16)}…` : "—"}</span>
          </div>
          <div>
            Signed by <span className="text-emerald-100">{artifact.signedBy.length > 0 ? artifact.signedBy.join(", ") : "—"}</span>
          </div>
          <div>
            Receipt <span className="font-mono text-emerald-100">{artifact.receiptId ?? "not recorded"}</span>
          </div>
        </div>
      )}
      <div className="mt-1 rounded border border-slate-800 bg-slate-950/60 p-2 text-slate-400">
        <span className="font-medium text-slate-300">Next constitutional act:</span> Publish as Canonical.{" "}
        No publish-as-canonical surface exists yet for a crystal-version artifact — reported honestly rather
        than linked to something that isn&apos;t built.
      </div>
    </div>
  );
}

/**
 * The freeze ceremony.
 *
 * THE BOUNDARY IS RENDERED, NEVER TYPED. The server reads it from the ratified
 * declaration and returns it as immutable text; the operator confirms this
 * exact boundary. There is no field here that can change it — a different
 * boundary requires a formal amendment to the domain declaration.
 *
 * THE HASH SUBMITTED IS THE ONE SHOWN. The freeze posts the `contentHash` the
 * preview returned, and the server recomputes and refuses a mismatch. Nothing
 * here recomputes or substitutes a hash.
 */
function FreezeControl({
  experimentId,
  onDone,
  initialRationale,
}: {
  experimentId: string;
  onDone: () => void;
  /** Seeded once, on mount — e.g. an honest record of a Stage 10 reviewer
   *  transport failure the operator is proceeding past (al, 2026-08-05).
   *  The operator can still edit or clear it before freezing. */
  initialRationale?: string;
}) {
  const [operatorRef, setOperatorRef] = useState("");
  const [reviewerRef, setReviewerRef] = useState("");
  const [rationale, setRationale] = useState(initialRationale ?? "");
  const [boundaryAcknowledged, setBoundaryAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<RatifiedBoundary | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [frozen, setFrozen] = useState<{ receiptId: string | null; invariantCount: number } | null>(null);

  const call = useCallback(
    async (path: string, body: Record<string, unknown>, successField: "ok" | "requestSucceeded") => {
      const res = await personaFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!d?.[successField]) {
        // The server's own words win. A mismatch refusal names both hashes.
        throw new Error(
          [d?.error, d?.currentContentHash ? `current: ${d.currentContentHash}` : null]
            .filter(Boolean)
            .join(" — ") || `request failed (HTTP ${res.status})`,
        );
      }
      return d as Record<string, unknown>;
    },
    [],
  );

  const runPreview = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setFrozen(null);
    try {
      const d = await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze-preview`,
        {
          operatorRef,
          reviewerRef: reviewerRef || undefined,
          freezeRationale: rationale,
          ratifiedAt: new Date().toISOString(),
          // domainBoundary is deliberately NOT sent — the route refuses it.
        },
        "ok",
      );
      const pkg = d.package as { contentHash: string; eligibleForRatification: boolean };
      setBoundary(d.ratifiedBoundary as RatifiedBoundary);
      setContentHash(pkg.contentHash);
      setEligible(pkg.eligibleForRatification);
      setExecution(d.execution as Execution);
      setBoundaryAcknowledged(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the freeze preview could not be built");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, operatorRef, reviewerRef, rationale]);

  const provision = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`,
        { action: "provision" },
        "requestSucceeded",
      );
      await runPreview();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the artifact could not be provisioned");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, runPreview, onDone]);

  const freeze = useCallback(async () => {
    if (!contentHash) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await call(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`,
        {
          action: "freeze",
          confirm: true,
          contentHash,
          signedBy: [operatorRef, reviewerRef].filter(Boolean),
          freezeRationale: rationale,
          // The server re-validates this — it never trusts a client boolean
          // as the acknowledgement itself, only as a required INPUT the
          // route then checks alongside its own ratified-declaration read
          // (operator ruling, EXP PP1 Track 2, 2026-08-05).
          boundaryAcknowledged,
        },
        "requestSucceeded",
      );
      setFrozen({
        receiptId: (d.receiptId as string | null) ?? null,
        invariantCount: Number(d.invariantCount ?? 0),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the freeze was refused");
    } finally {
      setBusy(false);
    }
  }, [call, experimentId, contentHash, operatorRef, reviewerRef, rationale, boundaryAcknowledged, onDone]);

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="grid gap-1.5 sm:grid-cols-2">
        <input
          value={operatorRef}
          onChange={(e) => setOperatorRef(e.target.value)}
          placeholder="operator reference (T2-safe, never a persona UUID)"
          className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
        />
        <input
          value={reviewerRef}
          onChange={(e) => setReviewerRef(e.target.value)}
          placeholder="reviewer reference (optional)"
          className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
        />
      </div>
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="why this freeze, now — the ratifying words"
        className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
      />

      {/*
       * PROGRESSIVE UNLOCK, NOT A ROW OF THREE PEER BUTTONS (al, 2026-08-04
       * steward-workflow ruling): "Each successful action immediately
       * unlocks the next." Presentational only — the handlers, gating
       * conditions and network calls below are UNCHANGED; step 2 dims until
       * a preview has produced a content hash and step 3 dims until that
       * preview reports the freeze would actually succeed, so the operator
       * sees the ceremony as one path rather than three independent choices.
       */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 text-slate-500">1.</span>
          <button
            onClick={() => void runPreview()}
            disabled={busy || !operatorRef.trim() || !rationale.trim()}
            className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview Package"}
          </button>
        </div>
        <div className={`flex items-center gap-1.5 transition-opacity ${contentHash ? "" : "opacity-40"}`}>
          <span className="w-3.5 text-slate-500">2.</span>
          <button
            onClick={() => void provision()}
            disabled={busy}
            className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300 disabled:opacity-50"
          >
            Provision Artifact
          </button>
        </div>
        <div
          className={`flex items-center gap-1.5 transition-opacity ${
            contentHash && eligible === true && execution?.wouldFreezeSucceed === true ? "" : "opacity-40"
          }`}
        >
          <span className="w-3.5 text-slate-500">3.</span>
          <button
            onClick={() => void freeze()}
            disabled={
              busy ||
              !contentHash ||
              !boundaryAcknowledged ||
              eligible !== true ||
              execution?.wouldFreezeSucceed !== true
            }
            className="flex items-center gap-1 rounded border border-violet-800 bg-violet-900/30 px-2.5 py-1 text-violet-200 disabled:opacity-50"
          >
            <Lock className="h-3 w-3" /> Freeze
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>
      )}

      {boundary && (
        <div className="rounded border border-slate-700 bg-slate-950 p-2">
          <div className="mb-1 text-slate-500">
            Ratified domain boundary — <span className="text-slate-300">immutable</span>, read from the
            declaration. You confirm it; you do not reproduce it.
          </div>
          <div className="text-slate-200">{boundary.boundary}</div>
          {boundary.exclusions.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-slate-400">
              {boundary.exclusions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          <div className="mt-1 text-[10px] text-slate-600">
            ratified by {boundary.ratifiedBy ?? "—"} on {boundary.ratifiedAt ?? "—"} · declaration{" "}
            <span className="font-mono">{boundary.declarationHash.slice(0, 16)}…</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-600">{boundary.amendedBy}</div>
          <label className="mt-1.5 flex items-center gap-1.5 text-slate-200">
            <input
              type="checkbox"
              checked={boundaryAcknowledged}
              onChange={(e) => setBoundaryAcknowledged(e.target.checked)}
            />
            I ratify this exact boundary
          </label>
        </div>
      )}

      {contentHash && (
        <div className="text-slate-400">
          content commitment <span className="font-mono text-slate-200">{contentHash.slice(0, 24)}…</span> ·
          evidence eligible:{" "}
          <span className={eligible ? "text-emerald-300" : "text-amber-200"}>{String(eligible)}</span>
        </div>
      )}

      {execution && (
        <ul className="space-y-0.5">
          {execution.preconditions.map((p) => (
            <li key={p.name} className={p.satisfied ? "text-slate-500" : "text-amber-200"}>
              {p.satisfied ? "✓" : "○"} {p.name} — {p.detail}
              {p.remedy && <div className="text-[10px] text-slate-500">{p.remedy}</div>}
            </li>
          ))}
        </ul>
      )}

      {frozen && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-200">
          Frozen — {frozen.invariantCount} invariant(s) committed. Receipt{" "}
          <span className="font-mono">{frozen.receiptId ?? "—"}</span>. Publication as canonical is a separate
          act and is out of scope for EXP-P1.
        </div>
      )}
    </div>
  );
}

interface ProvenanceClassSuggestionView {
  suggestedClass: string;
  confidence: number;
  primarySource: string | null;
  supportingSources: string[];
  reason: string;
}

/**
 * STAGE 5's ACTION — AI-ASSISTED REVIEW, NOT A BLANK FORM (operator
 * direction, 2026-08-05: "the steward should never begin with a blank form
 * when the substrate can derive a reasonable proposal").
 *
 * `suggest-classification` (POST /api/invariants/discovery) now returns TWO
 * things: `suggestion` (evidence refs + rationale, pre-filled from the
 * invariant's ALREADY-RESOLVED evidence — unchanged from before) and
 * `classSuggestion` (services/invariants/provenanceSuggestion.ts — a
 * REVIEWED proposal of the class itself, with confidence, a primary source
 * and supporting sources). Accepting a suggestion still submits through the
 * SAME `POST {action:'classify'}` this queue always called — every refusal
 * in `applyProvenanceReclassification` still runs, including the
 * anti-laundering check that a move into Population A must cite at least
 * one non-repo-internal source. This is deliberately a different posture
 * from the OTHER classify surface (components/composer/
 * InvariantDiscoveryTab.tsx), which is canaried to never pre-select a class
 * at all — that canary is about a SILENT default sitting among clerical
 * fields; a card that names its own confidence, reason and sources and
 * requires its own dedicated Accept is the reviewed act that rule exists to
 * require, not the unreviewed one it forbids.
 *
 * "Accept All High-Confidence" batch-submits only suggestions the steward
 * never had to look at individually (confidence > 95) through this SAME
 * classify action — a per-record refusal (e.g. the anti-laundering check)
 * is caught and counted as "needs manual review," never treated as a batch
 * failure.
 */
function ClassificationQueue({ queue, onDone }: { queue: { id: string; label: string }[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [to, setTo] = useState<string>("");
  const [evidenceRefs, setEvidenceRefs] = useState("");
  const [rationale, setRationale] = useState("");
  const [classSuggestion, setClassSuggestion] = useState<ProvenanceClassSuggestionView | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [batch, setBatch] = useState<{ running: boolean; progress: number; total: number; summary: string | null }>({
    running: false,
    progress: 0,
    total: 0,
    summary: null,
  });

  const current = queue[index];

  const fetchSuggestion = useCallback(async (invariantId: string) => {
    try {
      const res = await personaFetch("/api/invariants/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest-classification", invariantId }),
      });
      return (await res.json().catch(() => null)) as {
        suggestion?: { suggestedEvidenceRefs?: string[]; suggestedRationale?: string };
        classSuggestion?: ProvenanceClassSuggestionView | null;
      } | null;
    } catch {
      return null;
    }
  }, []);

  const loadCurrent = useCallback(
    async (invariantId: string) => {
      setLoadingSuggestion(true);
      setSuggestionDismissed(false);
      setClassSuggestion(null);
      const d = await fetchSuggestion(invariantId);
      setEvidenceRefs(d?.suggestion?.suggestedEvidenceRefs?.join("\n") ?? "");
      setRationale(d?.suggestion?.suggestedRationale ?? "");
      setClassSuggestion(d?.classSuggestion ?? null);
      setLoadingSuggestion(false);
    },
    [fetchSuggestion],
  );

  const openQueue = useCallback(() => {
    setOpen(true);
    setIndex(0);
    setTo("");
    setDone(0);
    setBatch({ running: false, progress: 0, total: 0, summary: null });
    if (queue[0]) void loadCurrent(queue[0].id);
  }, [queue, loadCurrent]);

  const submit = useCallback(
    async (args: { to: string; evidenceRefs: string[]; rationale: string }) => {
      if (!current) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await personaFetch("/api/invariants/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "classify", invariantId: current.id, ...args }),
        });
        const d = await res.json().catch(() => null);
        if (!d?.ok) throw new Error(d?.error || `classification refused (HTTP ${res.status})`);
        setDone((n) => n + 1);
        const nextIndex = index + 1;
        if (nextIndex >= queue.length) {
          setOpen(false);
          onDone();
          return;
        }
        setIndex(nextIndex);
        setTo("");
        void loadCurrent(queue[nextIndex].id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "classification failed");
      } finally {
        setBusy(false);
      }
    },
    [current, index, queue, onDone, loadCurrent],
  );

  const acceptSuggestion = useCallback(() => {
    if (!classSuggestion) return;
    void submit({
      to: classSuggestion.suggestedClass,
      evidenceRefs: [classSuggestion.primarySource, ...classSuggestion.supportingSources].filter((v): v is string => Boolean(v)),
      rationale: classSuggestion.reason,
    });
  }, [classSuggestion, submit]);

  const editSuggestion = useCallback(() => {
    if (!classSuggestion) return;
    setTo(classSuggestion.suggestedClass);
    setEvidenceRefs([classSuggestion.primarySource, ...classSuggestion.supportingSources].filter(Boolean).join("\n"));
    setRationale(classSuggestion.reason);
    setSuggestionDismissed(true);
  }, [classSuggestion]);

  const classifyAndNext = useCallback(
    () => void submit({ to, evidenceRefs: evidenceRefs.split("\n").map((s) => s.trim()).filter(Boolean), rationale }),
    [submit, to, evidenceRefs, rationale],
  );

  const acceptAllHighConfidence = useCallback(async () => {
    setBatch({ running: true, progress: 0, total: queue.length, summary: null });
    let accepted = 0;
    let needsReview = 0;
    for (let i = 0; i < queue.length; i++) {
      const record = queue[i];
      setBatch((b) => ({ ...b, progress: i }));
      const d = await fetchSuggestion(record.id);
      const s = d?.classSuggestion;
      if (!s || s.confidence <= HIGH_CONFIDENCE_THRESHOLD) {
        needsReview += 1;
        continue;
      }
      try {
        const res = await personaFetch("/api/invariants/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "classify",
            invariantId: record.id,
            to: s.suggestedClass,
            evidenceRefs: [s.primarySource, ...s.supportingSources].filter(Boolean),
            rationale: s.reason,
          }),
        });
        const body = await res.json().catch(() => null);
        if (body?.ok) accepted += 1;
        else needsReview += 1;
      } catch {
        needsReview += 1;
      }
    }
    setBatch({
      running: false,
      progress: queue.length,
      total: queue.length,
      summary: `${accepted} classified automatically; ${needsReview} left for manual review (no high-confidence suggestion, or the classification was refused)`,
    });
    setOpen(false);
    onDone();
  }, [queue, fetchSuggestion, onDone]);

  if (!open) {
    return (
      <div className="mt-2 space-y-1.5 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">{queue.length} member(s) require provenance</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void acceptAllHighConfidence()}
              disabled={batch.running}
              className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 font-medium text-emerald-200 disabled:opacity-50"
            >
              {batch.running ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Accept All High-Confidence (&gt;{HIGH_CONFIDENCE_THRESHOLD}%)
            </button>
            <button
              type="button"
              onClick={openQueue}
              className="rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-medium text-slate-100 hover:bg-slate-700/60"
            >
              Open Classification Queue
            </button>
          </div>
        </div>
        {batch.running && (
          <div className="text-slate-500">
            reviewing record {batch.progress + 1} of {batch.total}…
          </div>
        )}
        {batch.summary && <div className="text-slate-400">{batch.summary}</div>}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex items-center justify-between text-slate-400">
        <span>
          Record {index + 1} of {queue.length} · {done} classified this session
        </span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
          close
        </button>
      </div>
      {current && (
        <>
          <div className="rounded border border-slate-800 bg-slate-950 p-1.5 text-slate-200">{current.label}</div>

          {loadingSuggestion && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> asking Invariant Intelligence for the strongest provenance classification…
            </div>
          )}

          {!loadingSuggestion && classSuggestion && !suggestionDismissed && (
            <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    classSuggestion.confidence > HIGH_CONFIDENCE_THRESHOLD
                      ? "bg-emerald-500/15 text-emerald-300"
                      : classSuggestion.confidence >= 70
                        ? "bg-amber-500/15 text-amber-200"
                        : "bg-slate-700/40 text-slate-400"
                  }`}
                >
                  {classSuggestion.confidence}% confidence
                </span>
                <span className="font-mono text-[10px] text-violet-300">{classSuggestion.suggestedClass}</span>
              </div>
              {classSuggestion.primarySource && (
                <div className="text-slate-300">
                  primary source: <span className="font-mono text-[10px] text-slate-400">{classSuggestion.primarySource}</span>
                </div>
              )}
              {classSuggestion.supportingSources.length > 0 && (
                <div className="text-slate-500">supporting: {classSuggestion.supportingSources.join(", ")}</div>
              )}
              <div className="mt-0.5 text-slate-500">{classSuggestion.reason}</div>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={acceptSuggestion}
                  disabled={busy}
                  className="rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-200 disabled:opacity-50"
                >
                  ✓ Accept
                </button>
                <button
                  type="button"
                  onClick={editSuggestion}
                  disabled={busy}
                  className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-slate-200 disabled:opacity-50"
                >
                  ✎ Edit
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestionDismissed(true)}
                  disabled={busy}
                  className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-slate-400 disabled:opacity-50"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          )}

          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200"
          >
            <option value="">— select evidence-provenance class —</option>
            {PROVENANCE_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            value={evidenceRefs}
            onChange={(e) => setEvidenceRefs(e.target.value)}
            rows={2}
            placeholder="evidence references, one per line"
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
          />
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
            placeholder="rationale"
            className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={classifyAndNext}
            disabled={busy || !to || !rationale.trim()}
            className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-medium text-slate-100 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Classify &amp; next
          </button>
        </>
      )}
      {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}
    </div>
  );
}

/**
 * STAGE 6's ACTION — a genuine batch (al, 2026-08-04 steward-workflow
 * ruling): "15 members require validation. [Validate All]." Validation has
 * no per-record human content — `validateInvariant` runs the same
 * consistency/groundedness/canonical-form gate on every invariant — so this
 * button is honest where Stage 5/7's queues are the honest choice instead.
 * Calls the NEW `POST .../validate-all`, itself a new caller of the
 * EXISTING `validateInvariant`.
 */
function ValidateAllControl({
  experimentId,
  count,
  onDone,
}: {
  experimentId: string;
  count: number;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<{ invariantId: string; ok: boolean; detail: string; checks: { name: string; passed: boolean; detail?: string }[] }[]>([]);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setSummary(null);
    setOutcomes([]);
    setProgress({ done: 0, total: count });
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/validate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json().catch(() => null);
      if (!d || (res.status !== 200 && res.status !== 207)) {
        throw new Error(d?.error || `validation batch failed (HTTP ${res.status})`);
      }
      const results = (d.outcomes ?? []) as typeof outcomes;
      setProgress({ done: results.length, total: count });
      setSummary(d.summary ?? null);
      setOutcomes(results);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the validation batch could not be run");
    } finally {
      setBusy(false);
    }
  }, [experimentId, count, onDone]);

  return (
    <div className="mt-2 space-y-1.5 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-slate-300">{count} member(s) require validation</span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-medium text-slate-100 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Validate All
        </button>
      </div>
      {progress && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-emerald-500/70 transition-all"
            style={{ width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
          />
        </div>
      )}
      {summary && <div className="text-slate-400">{summary}</div>}
      {/* Per-record check breakdown (operator direction, 2026-08-05: the
          steward reviews what was checked, not only a pass/fail count) —
          validateInvariant's own verdict.checks, rendered verbatim. */}
      {outcomes.length > 0 && (
        <ul className="max-h-52 space-y-1 overflow-y-auto">
          {outcomes.map((o) => (
            <li
              key={o.invariantId}
              className={`rounded border p-1.5 ${o.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-400">{o.invariantId}</span>
                <span className={o.ok ? "text-emerald-300" : "text-amber-200"}>{o.ok ? "PASS" : "FAILED"}</span>
              </div>
              {o.checks.length > 0 ? (
                <ul className="mt-0.5 space-y-0.5">
                  {o.checks.map((c) => (
                    <li key={c.name} className={c.passed ? "text-slate-500" : "text-amber-200"}>
                      {c.passed ? "✓" : "○"} {c.name}
                      {c.detail && <span className="text-slate-600"> — {c.detail}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-0.5 text-slate-500">{o.detail}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}
    </div>
  );
}

interface RelationshipSuggestionView {
  relatedInvariantId: string;
  relatedLabel: string;
  relationType: string;
  rationale: string;
  confidence: number;
}

/** Stage 9 structural-diversity remediation (al, 2026-08-05) — mirrors app/api/.../diversity-candidates's DiversityCandidateView. */
interface DiversityCandidateView {
  candidateId: string;
  statement: string;
  evidenceSummary: string;
  proposedSemanticType: string;
  confidence: number;
  reason: string;
}

/** Stage 9 graph-connectivity remediation (al, 2026-08-05) — mirrors app/api/.../bridge-candidates's BridgeCandidateView. */
interface BridgeCandidateView {
  invariantAId: string;
  invariantAStatement: string;
  invariantBId: string;
  invariantBStatement: string;
  relationType: string;
  rationale: string;
  confidence: number;
  componentsJoined: [number, number];
}

/** A suggestion this auto-batch action must never write on its own — a genuine logical conflict is always a steward's call, not a heuristic's (al, 2026-08-04). */
const NEVER_AUTO_ACCEPT_TYPE = "contradicts";
const HIGH_CONFIDENCE_THRESHOLD = 95;

/**
 * STAGE 7's ACTION — AI-ASSISTED REVIEW, NOT A BLANK FORM (operator
 * direction, 2026-08-04: "The steward's role becomes constitutional
 * approval, not manual graph construction. The graph engine should perform
 * the reasoning; the human should perform constitutional oversight.").
 *
 * For each orphan cohort member, `POST .../suggest-relationships` (backed by
 * services/invariants/relationshipSuggestion.ts, which calls the platform's
 * `callSovereign('classification', ...)`) returns ranked candidate
 * relationships — related member, relation type, rationale, confidence.
 * The steward Accepts one as-is, Edits it before submitting, Rejects it
 * (dismissed from view only — nothing is written or persisted for a
 * rejection), or falls through to Choose Different, the same manual form
 * this queue used before. EVERY write — accepted, edited or manual — still
 * goes through the SAME EXISTING `POST /api/invariants/[id]/edges` this
 * queue always called; this component never writes an edge on its own
 * authority, it only pre-fills the form a human still submits.
 *
 * "Accept All High-Confidence" batch-writes only suggestions the steward
 * never had to look at individually: confidence > 95, AND the existing
 * `preview:true` cycle/quarantine check reports no conflict, AND the
 * relation type is never `contradicts` — a genuine logical conflict is
 * always a steward's call, never a heuristic's, however confident the
 * model is. Everything else in the batch is left for the per-record queue.
 */
function RelationshipQueue({
  experimentId,
  queue,
  members,
  onDone,
}: {
  experimentId: string;
  queue: { id: string; label: string }[];
  members: { id: string; label: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<RelationshipSuggestionView[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [manualOpen, setManualOpen] = useState(false);
  const [toInvariantId, setToInvariantId] = useState("");
  const [relation, setRelation] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [batch, setBatch] = useState<{ running: boolean; progress: number; total: number; summary: string | null }>({
    running: false,
    progress: 0,
    total: 0,
    summary: null,
  });

  const current = queue[index];
  const candidates = useMemo(() => members.filter((m) => m.id !== current?.id), [members, current]);
  const visibleSuggestions = useMemo(() => suggestions.filter((s) => !dismissedIds.has(s.relatedInvariantId + s.relationType)), [suggestions, dismissedIds]);

  const fetchSuggestions = useCallback(
    async (invariantId: string): Promise<RelationshipSuggestionView[]> => {
      try {
        const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/suggest-relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invariantId }),
        });
        const d = await res.json().catch(() => null);
        if (!d?.ok) return [];
        return (d.suggestions ?? []) as RelationshipSuggestionView[];
      } catch {
        return [];
      }
    },
    [experimentId],
  );

  const loadCurrent = useCallback(async (recordId: string) => {
    setLoadingSuggestions(true);
    setSuggestions([]);
    setDismissedIds(new Set());
    setManualOpen(false);
    const s = await fetchSuggestions(recordId);
    setSuggestions(s);
    setLoadingSuggestions(false);
  }, [fetchSuggestions]);

  const openQueue = useCallback(() => {
    setOpen(true);
    setIndex(0);
    setToInvariantId("");
    setRelation("");
    setRationale("");
    setDone(0);
    setBatch({ running: false, progress: 0, total: 0, summary: null });
    if (queue[0]) void loadCurrent(queue[0].id);
  }, [queue, loadCurrent]);

  const advance = useCallback(() => {
    setDone((n) => n + 1);
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      setOpen(false);
      onDone();
      return;
    }
    setIndex(nextIndex);
    setToInvariantId("");
    setRelation("");
    setRationale("");
    void loadCurrent(queue[nextIndex].id);
  }, [index, queue, onDone, loadCurrent]);

  const writeEdge = useCallback(
    async (args: { toInvariantId: string; relation: string; rationale: string }) => {
      if (!current) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await personaFetch(`/api/invariants/${encodeURIComponent(current.id)}/edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        const d = await res.json().catch(() => null);
        if (!d?.ok) throw new Error(d?.error || `relationship refused (HTTP ${res.status})`);
        advance();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "relationship creation failed");
      } finally {
        setBusy(false);
      }
    },
    [current, advance],
  );

  const acceptSuggestion = useCallback(
    (s: RelationshipSuggestionView) => void writeEdge({ toInvariantId: s.relatedInvariantId, relation: s.relationType, rationale: s.rationale }),
    [writeEdge],
  );

  const editSuggestion = useCallback((s: RelationshipSuggestionView) => {
    setToInvariantId(s.relatedInvariantId);
    setRelation(s.relationType);
    setRationale(s.rationale);
    setManualOpen(true);
  }, []);

  const rejectSuggestion = useCallback((s: RelationshipSuggestionView) => {
    // Client-side dismiss only — a rejected suggestion was never written
    // anywhere, so there is nothing to undo and nothing to receipt.
    setDismissedIds((prev) => new Set(prev).add(s.relatedInvariantId + s.relationType));
  }, []);

  const recordAndNext = useCallback(
    () => void writeEdge({ toInvariantId, relation, rationale: rationale.trim() }),
    [writeEdge, toInvariantId, relation, rationale],
  );

  const acceptAllHighConfidence = useCallback(async () => {
    setBatch({ running: true, progress: 0, total: queue.length, summary: null });
    let accepted = 0;
    let needsReview = 0;
    for (let i = 0; i < queue.length; i++) {
      const record = queue[i];
      setBatch((b) => ({ ...b, progress: i }));
      const recordSuggestions = await fetchSuggestions(record.id);
      let wroteOne = false;
      for (const s of recordSuggestions) {
        if (s.confidence <= HIGH_CONFIDENCE_THRESHOLD || s.relationType === NEVER_AUTO_ACCEPT_TYPE) continue;
        try {
          const previewRes = await personaFetch(`/api/invariants/${encodeURIComponent(record.id)}/edges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toInvariantId: s.relatedInvariantId, relation: s.relationType, rationale: s.rationale, preview: true }),
          });
          const previewBody = await previewRes.json().catch(() => null);
          if (!previewBody?.ok || previewBody.wouldSucceed !== true || previewBody.quarantineWarning) continue;
          const writeRes = await personaFetch(`/api/invariants/${encodeURIComponent(record.id)}/edges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toInvariantId: s.relatedInvariantId, relation: s.relationType, rationale: s.rationale }),
          });
          const writeBody = await writeRes.json().catch(() => null);
          if (writeBody?.ok) {
            wroteOne = true;
            break; // one accepted relationship is enough to clear this record's orphan status
          }
        } catch {
          // one candidate failing never stops the batch — move to the next suggestion or record
        }
      }
      if (wroteOne) accepted += 1;
      else needsReview += 1;
    }
    setBatch({
      running: false,
      progress: queue.length,
      total: queue.length,
      summary: `${accepted} accepted automatically; ${needsReview} left for manual review (no high-confidence conflict-free suggestion)`,
    });
    setOpen(false);
    onDone();
  }, [queue, fetchSuggestions, onDone]);

  if (!open) {
    return (
      <div className="mt-2 space-y-1.5 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">{queue.length} member(s) require relationship derivation</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void acceptAllHighConfidence()}
              disabled={batch.running}
              className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-900/30 px-2.5 py-1 font-medium text-emerald-200 disabled:opacity-50"
            >
              {batch.running ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Accept All High-Confidence (&gt;{HIGH_CONFIDENCE_THRESHOLD}%)
            </button>
            <button
              type="button"
              onClick={openQueue}
              className="rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-medium text-slate-100 hover:bg-slate-700/60"
            >
              Open Relationship Queue
            </button>
          </div>
        </div>
        {batch.running && (
          <div className="text-slate-500">
            reviewing record {batch.progress + 1} of {batch.total}…
          </div>
        )}
        {batch.summary && <div className="text-slate-400">{batch.summary}</div>}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex items-center justify-between text-slate-400">
        <span>
          Record {index + 1} of {queue.length} · {done} related this session
        </span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
          close
        </button>
      </div>
      {current && (
        <>
          <div className="rounded border border-slate-800 bg-slate-950 p-1.5 text-slate-200">{current.label}</div>

          {loadingSuggestions && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> asking Invariant Intelligence for the strongest relationships…
            </div>
          )}

          {!loadingSuggestions && visibleSuggestions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-slate-500">suggested relationships — reviewed and approved by you, never written automatically</div>
              {visibleSuggestions.map((s) => (
                <div key={s.relatedInvariantId + s.relationType} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        s.confidence > HIGH_CONFIDENCE_THRESHOLD
                          ? "bg-emerald-500/15 text-emerald-300"
                          : s.confidence >= 70
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-slate-700/40 text-slate-400"
                      }`}
                    >
                      {s.confidence}% confidence
                    </span>
                    <span className="font-mono text-[10px] text-violet-300">{s.relationType}</span>
                  </div>
                  <div className="text-slate-200">→ {s.relatedLabel}</div>
                  <div className="mt-0.5 text-slate-500">{s.rationale}</div>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => acceptSuggestion(s)}
                      disabled={busy}
                      className="rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-200 disabled:opacity-50"
                    >
                      ✓ Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => editSuggestion(s)}
                      disabled={busy}
                      className="rounded border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-slate-200 disabled:opacity-50"
                    >
                      ✎ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectSuggestion(s)}
                      disabled={busy}
                      className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-slate-400 disabled:opacity-50"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingSuggestions && visibleSuggestions.length === 0 && !manualOpen && (
            <div className="text-slate-500">no suggestion cleared review for this member.</div>
          )}

          {!manualOpen ? (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="text-slate-500 underline decoration-slate-600 hover:text-slate-300"
            >
              + Choose Different
            </button>
          ) : (
            <div className="space-y-1.5 rounded border border-slate-800 bg-slate-950/40 p-1.5">
              <select
                value={toInvariantId}
                onChange={(e) => setToInvariantId(e.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200"
              >
                <option value="">— relate to which other member —</option>
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200"
              >
                <option value="">— relation type —</option>
                {INVARIANT_EDGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={2}
                placeholder="rationale — why this relationship holds"
                className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-slate-200 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={recordAndNext}
                disabled={busy || !toInvariantId || !relation || !rationale.trim()}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-medium text-slate-100 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Record &amp; next
              </button>
            </div>
          )}
        </>
      )}
      {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}
    </div>
  );
}

/**
 * Stage 9 — "Find diversity candidates" (operator direction, 2026-08-05):
 * the structural-diversity remediation. Fetches unpromoted candidates whose
 * natural semantic shape genuinely differs from the crystal's dominant one;
 * Accept promotes+validates with that EXACT reviewed shape via
 * POST .../diversity-candidates/[id]/accept — never a relabel of an
 * existing crystal member. When nothing qualifies, points at the Corpus
 * Scout tab with the exact domain/missing-shapes context rather than a
 * fabricated deep link (CorpusScoutTab takes no URL params today).
 */
function DiversityCandidateQueue({ experimentId, onDone }: { experimentId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<DiversityCandidateView[]>([]);
  const [dominantShape, setDominantShape] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/diversity-candidates`, { cache: "no-store" });
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `could not read diversity candidates (HTTP ${res.status})`);
      setCandidates(d.candidates ?? []);
      setDominantShape(d.dominantShape ?? null);
      setScanned(d.scanned ?? 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "diversity-candidate search failed");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  const openQueue = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);

  const accept = useCallback(
    async (c: DiversityCandidateView) => {
      setBusyId(c.candidateId);
      setErr(null);
      try {
        const res = await personaFetch(
          `/api/research/track2/${encodeURIComponent(experimentId)}/diversity-candidates/${encodeURIComponent(c.candidateId)}/accept`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ semanticType: c.proposedSemanticType }) },
        );
        const d = await res.json().catch(() => null);
        if (!d?.ok) throw new Error(d?.error || `extraction refused (HTTP ${res.status})`);
        setCandidates((prev) => prev.filter((x) => x.candidateId !== c.candidateId));
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "extract-and-validate failed");
      } finally {
        setBusyId(null);
      }
    },
    [experimentId, onDone],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={openQueue}
        className="mt-1.5 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700/60"
      >
        Find diversity candidates
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex items-center justify-between text-slate-400">
        <span>
          {loading
            ? "scanning extracted candidates for a distinct shape…"
            : `${candidates.length} candidate(s) with a shape distinct from '${dominantShape}' (${scanned} scanned)`}
        </span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
          close
        </button>
      </div>
      {loading && (
        <div className="flex items-center gap-1.5 text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> classifying…
        </div>
      )}
      {!loading &&
        candidates.map((c) => (
          <div key={c.candidateId} className="rounded border border-slate-800 bg-slate-950/60 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">{c.proposedSemanticType}</span>
              <span className="text-[10px] text-slate-500">{c.confidence}% confidence</span>
            </div>
            <div className="text-slate-200">{c.statement}</div>
            <div className="mt-0.5 text-slate-500">Evidence: {c.evidenceSummary}</div>
            <div className="mt-0.5 text-slate-500">Why distinct: {c.reason}</div>
            <button
              type="button"
              onClick={() => void accept(c)}
              disabled={busyId === c.candidateId}
              className="mt-1.5 flex items-center gap-1 rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-200 disabled:opacity-50"
            >
              {busyId === c.candidateId ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Extract and validate
            </button>
          </div>
        ))}
      {!loading && candidates.length === 0 && (
        <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-slate-400">
          No extracted candidate scanned ({scanned}) resolves to a shape distinct from &apos;{dominantShape}&apos;. Open the{" "}
          <span className="font-medium text-slate-200">Corpus Scout</span> tab and acquire material for domain{" "}
          <span className="font-mono text-slate-300">financial-risk-value-systems</span> aimed at the missing shapes (any of: constraint, law,
          definition, principle, heuristic, epistemic — other than &apos;{dominantShape}&apos;).
        </div>
      )}
      {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}
    </div>
  );
}

/**
 * Stage 9 — `duplicate-detection` remediation (operator ruling, 2026-08-27,
 * "Crystal v1/v2 lineage collision", item 4: "duplicate detection →
 * duplicate-pair adjudication queue"). The pairs are a PROP, not a fetch —
 * the readiness engine already computed the exact near-duplicate pairs
 * (`services/research/crystalReadiness.ts`'s `duplicatePairs`) and this
 * queue only ever acts on what that engine named. Each pair offers "keep A" /
 * "keep B", which merges the OTHER invariant into the kept survivor via the
 * existing `mergeInvariants` primitive (unions contexts/edges, marks the
 * merged row `superseded`) — never a second, independently-judged dedup path.
 */
function DuplicateInvariantQueue({
  experimentId,
  pairs,
  onDone,
}: {
  experimentId: string;
  pairs: Array<{ aId: string; bId: string }>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pairKey = (aId: string, bId: string) => [aId, bId].sort().join('~');
  const remaining = pairs.filter((p) => !resolvedKeys.has(pairKey(p.aId, p.bId)));

  const merge = useCallback(
    async (survivorId: string, mergedId: string, key: string) => {
      setBusyKey(key);
      setErr(null);
      try {
        const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/duplicate-pairs/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ survivorId, mergedId }),
        });
        const d = await res.json().catch(() => null);
        if (!d?.ok) throw new Error(d?.error || `merge refused (HTTP ${res.status})`);
        setResolvedKeys((prev) => new Set(prev).add(key));
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "merge failed");
      } finally {
        setBusyKey(null);
      }
    },
    [experimentId, onDone],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700/60"
      >
        Adjudicate {pairs.length} duplicate pair{pairs.length === 1 ? "" : "s"}
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex items-center justify-between text-slate-400">
        <span>{remaining.length} pair(s) awaiting a decision</span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
          close
        </button>
      </div>
      {remaining.map((p) => {
        const key = pairKey(p.aId, p.bId);
        return (
          <div key={key} className="rounded border border-slate-800 bg-slate-950/60 p-2">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
              <span className="text-slate-300">{p.aId}</span>
              <span className="text-slate-600">~</span>
              <span className="text-slate-300">{p.bId}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void merge(p.aId, p.bId, key)}
                disabled={busyKey === key}
                className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-200 disabled:opacity-50"
              >
                {busyKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Keep {p.aId}
              </button>
              <button
                type="button"
                onClick={() => void merge(p.bId, p.aId, key)}
                disabled={busyKey === key}
                className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-200 disabled:opacity-50"
              >
                {busyKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Keep {p.bId}
              </button>
            </div>
          </div>
        );
      })}
      {remaining.length === 0 && (
        <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-slate-400">
          Every pair from this reading has been resolved. Refresh readiness to confirm none remain.
        </div>
      )}
      {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}
    </div>
  );
}

/**
 * Stage 9 — "Find valid bridge relationships" (operator direction,
 * 2026-08-05): the graph-connectivity remediation. Proposes relationships
 * between the largest component and every smaller one, via the SAME
 * `suggestRelationships` engine Stage 7 uses. Single Accept goes through the
 * existing `POST /api/invariants/[id]/edges`; batch Accept goes through
 * `POST .../accept-bridges`, which enforces the identical per-edge rules.
 */
function BridgeRelationshipQueue({ experimentId, onDone }: { experimentId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<BridgeCandidateView[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const keyOf = (c: BridgeCandidateView) => `${c.invariantAId}~${c.invariantBId}~${c.relationType}`;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/bridge-candidates`, { cache: "no-store" });
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `could not read bridge candidates (HTTP ${res.status})`);
      setCandidates(d.candidates ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "bridge-candidate search failed");
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  const openQueue = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);

  const acceptOne = useCallback(
    async (c: BridgeCandidateView) => {
      setBusyKey(keyOf(c));
      setErr(null);
      try {
        const res = await personaFetch(`/api/invariants/${encodeURIComponent(c.invariantAId)}/edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toInvariantId: c.invariantBId, relation: c.relationType, rationale: c.rationale }),
        });
        const d = await res.json().catch(() => null);
        if (!d?.ok) throw new Error(d?.error || `bridge refused (HTTP ${res.status})`);
        setCandidates((prev) => prev.filter((x) => keyOf(x) !== keyOf(c)));
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "bridge acceptance failed");
      } finally {
        setBusyKey(null);
      }
    },
    [onDone],
  );

  const rejectOne = useCallback((c: BridgeCandidateView) => {
    setCandidates((prev) => prev.filter((x) => keyOf(x) !== keyOf(c)));
  }, []);

  const acceptAll = useCallback(async () => {
    setAcceptingAll(true);
    setErr(null);
    try {
      const res = await personaFetch(`/api/research/track2/${encodeURIComponent(experimentId)}/accept-bridges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bridges: candidates.map((c) => ({ fromInvariantId: c.invariantAId, toInvariantId: c.invariantBId, relation: c.relationType, rationale: c.rationale })),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error || `batch accept refused (HTTP ${res.status})`);
      setCandidates([]);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "accept-all failed");
    } finally {
      setAcceptingAll(false);
    }
  }, [experimentId, candidates, onDone]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={openQueue}
        className="mt-1.5 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-100 hover:bg-slate-700/60"
      >
        Find valid bridge relationships
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex items-center justify-between text-slate-400">
        <span>{loading ? "scanning disconnected clusters…" : `${candidates.length} grounded bridge(s) found`}</span>
        <div className="flex items-center gap-2">
          {candidates.length > 0 && (
            <button
              type="button"
              onClick={() => void acceptAll()}
              disabled={acceptingAll}
              className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-200 disabled:opacity-50"
            >
              {acceptingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Accept all grounded bridges
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
            close
          </button>
        </div>
      </div>
      {loading && (
        <div className="flex items-center gap-1.5 text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> asking Invariant Intelligence which clusters genuinely relate…
        </div>
      )}
      {!loading &&
        candidates.map((c) => (
          <div key={keyOf(c)} className="rounded border border-slate-800 bg-slate-950/60 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] text-violet-300">{c.relationType}</span>
              <span className="text-[10px] text-slate-500">
                joins clusters of {c.componentsJoined[0]} + {c.componentsJoined[1]} · {c.confidence}% confidence
              </span>
            </div>
            <div className="text-slate-200">{c.invariantAStatement}</div>
            <div className="my-0.5 text-center text-slate-500">↓ {c.relationType}</div>
            <div className="text-slate-200">{c.invariantBStatement}</div>
            <div className="mt-0.5 text-slate-500">{c.rationale}</div>
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => void acceptOne(c)}
                disabled={busyKey === keyOf(c)}
                className="rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 font-medium text-emerald-200 disabled:opacity-50"
              >
                ✓ Accept relationship
              </button>
              <button
                type="button"
                onClick={() => rejectOne(c)}
                disabled={busyKey === keyOf(c)}
                className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-slate-400 disabled:opacity-50"
              >
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      {!loading && candidates.length === 0 && (
        <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-slate-400">
          No grounded relationship found between the disconnected clusters and the largest one. A genuine relationship may not exist yet in the
          corpus — acquiring more material for the smaller cluster's topic is the remedy, not inventing an edge.
        </div>
      )}
      {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}
    </div>
  );
}

/**
 * STAGE 10's ACTION (al, 2026-08-04 steward-workflow ruling, operator
 * confirmed 2026-08-04): "Generate Review Package. [Send to Reviewer]."
 *
 * Wires to the EXISTING, EXP-P1-wide Independent Review Lab
 * (services/research/independentReviewPlan.ts's `buildReviewPlan` via
 * `POST /api/research/review`) — never a lightweight Track2-only
 * substitute. This IS a heavier, more consequential act than the other
 * buttons on this page: `buildReviewPlan` reads the WHOLE EXP-P1 corpus
 * within its namespace boundary, not only this crystal's assigned members,
 * and `mode:'run'` dispatches both reviewers for real. Reviewer selection
 * defaults to the pinned `EXP_P1_REVIEWER_PAIR` when none is supplied
 * (services/research/review/_lib/resolveSelection.ts), which is what makes
 * "Send to Reviewer" a genuine one-click act rather than a hidden
 * reviewer-picker dialog.
 */
interface ReviewExecutiveSummaryView {
  strengths: string[];
  weaknesses: string[];
  openQuestions: string[];
}

/**
 * A reviewer TRANSPORT failure (gateway timeout, 502/503/504, or a body
 * that isn't the route's own JSON at all) is not a governance verdict — it
 * means the reviewer call never completed, not that it completed and
 * rejected the crystal (al, EXP PP1 Track 2, 2026-08-05). The route's own
 * business-logic failures always return `{ok:false, error}` JSON (see
 * app/api/research/review/route.ts's catch block) with a 409 (ReviewRefusal)
 * or 500 (genuine server error) — a response that never parsed as JSON at
 * all, or a 502/503/504, means the platform gateway killed the request
 * before this app's own error handling ever ran.
 */
const TRANSPORT_FAILURE_STATUSES = new Set([502, 503, 504]);

interface ReviewUnavailable {
  status: number;
  at: string;
}

function ReviewPackageControl({
  onDone,
  onContinueUnderAuthority,
}: {
  onDone: () => void;
  /** Reveals Stage 11 and seeds its freeze rationale with the honest
   *  transport-failure note — never called for a real rejection. */
  onContinueUnderAuthority: (note: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<ReviewUnavailable | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  // Steward-facing only — built from `summary` above, never from the sealed
  // package the blinded reviewers receive. See
  // services/research/reviewExecutiveSummary.ts's own header for why that
  // boundary matters; this component only renders what the route already
  // decided is safe to show here.
  const [executiveSummary, setExecutiveSummary] = useState<ReviewExecutiveSummaryView | null>(null);
  const [ran, setRan] = useState<{ tally: Record<string, unknown> } | null>(null);

  const call = useCallback(async (mode: "preview" | "run") => {
    setBusy(true);
    setErr(null);
    setUnavailable(null);
    try {
      const res = await personaFetch("/api/research/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) {
        // A parsed `{ok:false}` body means THIS route ran and refused —
        // that is a real outcome (ReviewRefusal or a genuine 500), so it
        // still renders as `err`. A response that never parsed as JSON at
        // all is the gateway-timeout case: this route's handler never got
        // to write a response, so there is no verdict to report.
        if (d === null || TRANSPORT_FAILURE_STATUSES.has(res.status)) {
          setUnavailable({ status: res.status, at: new Date().toISOString() });
          return;
        }
        throw new Error(d?.error || `review ${mode} failed (HTTP ${res.status})`);
      }
      setSummary(d.summary ?? null);
      setExecutiveSummary(d.executiveSummary ?? null);
      if (mode === "run") {
        setRan({ tally: d.tally ?? {} });
        onDone();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : `the review ${mode} could not be run`);
    } finally {
      setBusy(false);
    }
  }, [onDone]);

  return (
    <div className="mt-2 space-y-1.5 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void call("preview")}
          disabled={busy}
          className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-medium text-slate-100 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Generate Review Package
        </button>
        {summary && !ran && (
          <button
            type="button"
            onClick={() => void call("run")}
            disabled={busy}
            className="flex items-center gap-1 rounded border border-violet-800 bg-violet-900/30 px-2.5 py-1 font-medium text-violet-200 disabled:opacity-50"
          >
            Send to Reviewer
          </button>
        )}
      </div>
      {unavailable && (
        <div className="space-y-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-100">
          <div>
            <strong className="font-medium">Reviewer unavailable</strong> (HTTP {unavailable.status}) — the reviewer
            call did not complete. This is a transport failure, not a review rejection: no verdict was returned, and
            none is recorded.
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void call("run")}
              disabled={busy}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 font-medium text-slate-100 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Retry
            </button>
            <button
              type="button"
              onClick={() =>
                onContinueUnderAuthority(
                  `Independent review attempted — reviewer unavailable (HTTP ${unavailable.status}) at ${unavailable.at}. ` +
                    'Review did not complete; no verdict was returned. Proceeding to freeze under operator authority.',
                )
              }
              className="flex items-center gap-1 rounded border border-emerald-700 bg-emerald-900/30 px-2.5 py-1 font-medium text-emerald-200"
            >
              Continue under Operator Authority
            </button>
          </div>
        </div>
      )}
      {summary && (
        <div className="text-slate-400">
          package <span className="font-mono text-slate-300">{String(summary.packageHash ?? "").slice(0, 16)}…</span>{" "}
          · {String(summary.corpusRowCount ?? "?")} corpus row(s) · {String(summary.inBoundaryCount ?? "?")} in
          boundary
        </div>
      )}
      {executiveSummary && (
        <div className="space-y-1 rounded border border-slate-800 bg-slate-950/60 p-2">
          <div className="text-[10px] text-slate-600">
            executive summary — for you, the steward, never sent to the blinded reviewers
          </div>
          {executiveSummary.strengths.length > 0 && (
            <div>
              <div className="text-emerald-300">Strengths</div>
              <ul className="list-disc pl-4 text-slate-300">
                {executiveSummary.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {executiveSummary.weaknesses.length > 0 && (
            <div>
              <div className="text-amber-200">Weaknesses</div>
              <ul className="list-disc pl-4 text-slate-300">
                {executiveSummary.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {executiveSummary.openQuestions.length > 0 && (
            <div>
              <div className="text-cyan-300">Open questions</div>
              <ul className="list-disc pl-4 text-slate-300">
                {executiveSummary.openQuestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {ran && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-200">
          Sent to reviewers — tally: {JSON.stringify(ran.tally)}
        </div>
      )}
      {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{err}</div>}
    </div>
  );
}
