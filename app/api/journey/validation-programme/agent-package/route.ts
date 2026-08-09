/**
 * GET /api/journey/validation-programme/agent-package
 *
 * The JSON Agent Package for the Validation Programme — an AUDITABLE
 * EXTERNAL-REVIEW PACKAGE for Austin/Avi and their delegated agents to
 * review both the frozen Crystal vP1 AND the EXP-P1 experimental design,
 * without requiring unstated platform knowledge (External Review
 * Completeness Pass, 2026-08-09).
 *
 * Distinct from the "Download JSON for Agent" button on the Crystal Review
 * stage (which downloads one crystal domain's LIVE report; this route
 * describes the whole programme, hash-bound where it matters). Every field
 * below is EITHER a real, already-reachable endpoint/resource, a real
 * derivation from persisted state, a real EXTRACT of a canonical document
 * (never a rewritten second specification), OR an honest statement that no
 * such record exists (CLAUDE.md "No Guessing") — nothing here is fabricated
 * to look more complete than the platform actually is.
 *
 * Same gate as the journey's own state route and the Crystal Review endpoint
 * it points to: admin, OR a persona holding a research-lab grant in a role
 * the Review workspace view admits, scoped to EXP-P1
 * (`callerMayReadExperimentReview`). This route reads only — it never writes,
 * freezes, ratifies, or executes anything, and never reveals another
 * observer's decision before the caller decides (SPEC point 8; see
 * `crystalObserverReview.ts::blindOtherObserverDecisions`, the SAME
 * derivation `/api/research/observer-review/[experimentId]` uses).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { personaPublicRef } from '@/services/identity/personaReferences';
import { resolveRequestOrigin } from '@/app/api/agents/_lib/requestOrigin';
import { callerMayReadExperimentReview, resolveExperimentReviewGrant } from '@/services/passport/participationAccess';
import { RESEARCH_WORKSPACE_ROLE_AUTHORITY, type ResearchWorkspaceRoleId } from '@/services/research/researchWorkspaceRoles';
import { getResearchWorkspace, researchWorkspaceParent, researchWorkspaceExperiment, researchWorkspaceLabel } from '@/services/research/researchWorkspace';
import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';
import { reviewerAgreementStatus, CONSENT_BINDS_EXACT_TERMS } from '@/services/research/reviewerAgreement';
import { getArtifact, deriveProtocolRatified } from '@/services/research/artifacts';
import { deriveOverview } from '@/services/research/lifecycle';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import { buildFrozenCrystalManifest, type FrozenCrystalManifest } from '@/services/research/crystalFrozenManifest';
import { observerRoundId, getObserverRound } from '@/services/research/observerReviewStore';
import {
  resolveObserverRound,
  deriveCallerObserverStatus,
  projectResolutionForCaller,
  OBSERVER_DECISION_KINDS,
  type ObserverReviewPackage,
} from '@/services/research/crystalObserverReview';
import {
  VALIDATION_PROGRAMME_JOURNEY,
  VALIDATION_PROGRAMME_WORKSPACE_ID,
  VALIDATION_PROGRAMME_EXPERIMENT_ID,
  isExpP1Path,
} from '@/services/journey/validationProgrammeJourney';

export const dynamic = 'force-dynamic';

const PACKAGE_SCHEMA_VERSION = 'validation-programme-agent-package/v2.0';

/** Reads col_experiments from the real collections.json and returns EXP-P1's own items — never a hand-copied list. */
async function resolveExpP1DocumentResources(origin: string): Promise<Array<{ path: string; url: string }>> {
  try {
    const raw = await corpusReadPackFile('irl', 'collections.json');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { collections?: Array<{ id: string; items?: string[] }> };
    const collection = parsed.collections?.find((c) => c.id === 'col_experiments');
    const items = (collection?.items ?? []).filter(isExpP1Path);
    return items.map((p) => ({ path: p, url: `${origin}/api/codex/packs/irl/file?path=${encodeURIComponent(p)}` }));
  } catch {
    return [];
  }
}

// ─── §7 Governing Resources — a CURATED canonical set, distinct from the four ──
// EXP-P1-local `documentResources` above (which stay unchanged). Real paths,
// verified to resolve on disk in tests/validation-programme-agent-package.test.ts.

const GOVERNING_RESOURCE_PATHS: Array<{ id: string; label: string; path: string }> = [
  { id: 'IRL-012', label: 'IRL-012 — Austin Feedback Integration', path: 'foundation/IRL-012_austin-feedback-integration.md' },
  { id: 'IRL-016', label: 'IRL-016 — Experimental Freeze and Protocol Governance', path: 'foundation/IRL-016_experimental-freeze-and-protocol-governance.md' },
  { id: 'CFS-033', label: 'CFS-033 — Constitutional Evaluation', path: 'foundation/CFS-033_constitutional-evaluation.md' },
  { id: 'CFS-054', label: 'CFS-054 — Crystal Freeze Specification', path: 'foundation/CFS-054_crystal-freeze-specification.md' },
  { id: 'PRD-EPI-001', label: 'PRD-EPI-001 — EXP-P1 Experimental Infrastructure Programme', path: 'foundation/PRD-EPI-001_exp-p1-experimental-infrastructure-programme.md' },
  { id: 'SERIES-RATIFICATION-P1-P2-P3', label: 'Series Ratification — EXP-P1/P2/P3', path: 'foundation/experiments/SERIES-RATIFICATION_p1-p2-p3.md' },
  { id: 'EXP-010', label: 'EXP-010 — Representation Gauntlet (underlying design EXP-P1 freezes)', path: 'foundation/experiments/exp-010-representation-gauntlet/README.md' },
];

async function buildGoverningResources(origin: string): Promise<Array<{ id: string; label: string; path: string; url: string; resolved: boolean }>> {
  return Promise.all(
    GOVERNING_RESOURCE_PATHS.map(async (r) => {
      const content = await corpusReadPackFile('irl', r.path).catch(() => null);
      return {
        id: r.id,
        label: r.label,
        path: r.path,
        url: `${origin}/api/codex/packs/irl/file?path=${encodeURIComponent(r.path)}`,
        resolved: Boolean(content && content.trim().length > 0),
      };
    }),
  );
}

// ─── §3 Experiment Design — a section-cited EXTRACT of the canonical protocol,
// NEVER a second editable specification. Every field below either quotes the
// real README.md verbatim or names the section it summarizes; if the two
// ever disagree, the document wins.

function extractMarkdownSection(md: string, headingPrefix: string): string | null {
  const lines = md.split('\n');
  const startIdx = lines.findIndex((l) => l.trim().startsWith(headingPrefix));
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || lines[i].trim() === '---') {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n').trim();
}

const EXP_P1_README_PATH = 'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md';

async function buildExperimentDesign(origin: string, hypothesis: string | null): Promise<Record<string, unknown>> {
  const raw = await corpusReadPackFile('irl', EXP_P1_README_PATH).catch(() => null);
  const sourceDocument = { path: EXP_P1_README_PATH, url: `${origin}/api/codex/packs/irl/file?path=${encodeURIComponent(EXP_P1_README_PATH)}` };
  if (!raw) {
    return {
      available: false,
      reason: `The canonical protocol document (${EXP_P1_README_PATH}) could not be read — no experiment design is fabricated in its place.`,
      sourceDocument,
    };
  }
  return {
    available: true,
    sourceDocument,
    disclaimer:
      'A section-cited EXTRACT of the canonical pre-registration protocol at sourceDocument, not a second, ' +
      'independently editable specification. If this block and the document ever disagree, the document is ' +
      'authoritative — re-fetch this package rather than trust a cached copy of this field.',
    hypothesis: hypothesis ?? 'Not found in EXPERIMENT_REGISTRY.',
    deltaFramework:
      extractMarkdownSection(raw, '## 1. Purpose and Scope') ??
      'Section "1. Purpose and Scope" (D−A, C−D, B−C delta table) not found in the current document.',
    materialsAndFreezing:
      extractMarkdownSection(raw, '## 3. Materials, Pinning, and Freezing') ??
      'Section "3. Materials, Pinning, and Freezing" (Crystal vP1 snapshot, ⊆40% Arm-C slice guard, enlargement discipline) not found.',
    arms:
      extractMarkdownSection(raw, '## 4. Arms') ??
      'Section "4. Arms" (A=Cold, D=Expert Prose, C=Flattened Invariants, B=Full Runtime; selection-neutral/selection-sensitive classification) not found.',
    taskSet:
      extractMarkdownSection(raw, '## 5. Task Set') ??
      'Section "5. Task Set" (minimum 24 tasks: 12 recall + 12 derivation; Austin selects/creates; held-out guarantee) not found.',
    probes:
      extractMarkdownSection(raw, '## 6. Probes') ??
      'Section "6. Probes" (generative-sufficiency probe; mutation/objecthood probe) not found.',
    runsAndStatistics:
      extractMarkdownSection(raw, '## 7. Runs and Statistics') ??
      'Section "7. Runs and Statistics" (k=5 repetitions, bootstrap 95% CI, pre-agreed signal thresholds) not found.',
    judging:
      extractMarkdownSection(raw, '## 8. Judging') ??
      'Section "8. Judging" (pinned judge model + rubric, blinding, dual-run verification) not found.',
    tokenAccounting:
      extractMarkdownSection(raw, '## 9. Token Accounting') ??
      'Section "9. Token Accounting" (matched-token requirement, Arm D within ±2% of Arm C) not found.',
    interpretationTable:
      extractMarkdownSection(raw, '## 12. Interpretation Table') ??
      'Section "12. Interpretation Table" (pre-registered interpretation, frozen before any result; the domain ' +
        'limitation paragraph) not found.',
    rolesAndLogistics:
      extractMarkdownSection(raw, '## 13. Roles, Environment, Logistics') ??
      'Section "13. Roles, Environment, Logistics" (Austin owns task set + answer keys, Arm D, judge config; IRL ' +
        'owns the frozen snapshot, exporter run, Arm B execution) not found.',
  };
}

// ─── §4 Review Mandate — the operator's exact decision question and dimensions.

const REVIEW_MANDATE = {
  decisionQuestion:
    'Is the frozen Crystal vP1 a sufficiently coherent, traceable, appropriately bounded and experimentally useful ' +
    'substrate for EXP-P1 to proceed to post-crystal protocol preparation under the declared limitations?',
  dimensions: [
    'hash/content integrity',
    'provenance and traceability',
    'domain-boundary validity',
    'population/exclusion integrity',
    'structural/derivational headroom',
    'compatibility with the ≤40% Arm-C slice constraint',
    'task-independence/no leakage',
    'declared maturity limitations',
    'adequacy for the four-arm design',
    'overclaim/generalisation risk',
  ],
  disclaimer:
    'Acceptance under this mandate does NOT approve results (no results exist yet), does NOT establish domain ' +
    'generality (EXP-P1 is pre-registered as an internal-coherence/domain-affinity validation, never evidence of ' +
    'domain-independent generalisation), does NOT authorize experiment execution, and does NOT substitute for the ' +
    'later, separate act of Protocol Ratification. It is a judgment about the SUBSTRATE, scoped to the ten ' +
    'dimensions above.',
};

// ─── §5 Scientific Limitations — current frozen review facts, real and sourced.

const SCIENTIFIC_LIMITATIONS = {
  hardReadinessVsMaturity:
    "Two tiers, not one (operator ruling, 2026-08-05): 'scientific-readiness' checks are a HARD GATE — a crystal " +
    "cannot legally freeze while one fails. 'scientific-maturity' checks (structural-diversity, graph-connectivity) " +
    'are INFORMATIONAL and never block a freeze — a first crystal of one semantic shape, or one still fragmented ' +
    'into clusters, is a true finding about the corpus, not evidence corruption. See `frozenCrystal` for which tier ' +
    'each check belonged to at the time this package was generated.',
  heuristics: [
    'Duplicate detection (crystalReadiness.ts::findNearDuplicatePairs) is a LEXICAL heuristic — normalized-text ' +
      'Jaccard similarity over word sets. It catches lexical near-duplicates only; it will miss paraphrases with low ' +
      'word overlap and can false-positive on short, generic statements. It is not a semantic entailment check.',
    'Derivation-shape detection (crystalReadiness.ts::looksDerivationEligible) is a HEURISTIC proxy (semanticType ∈ ' +
      '{constraint, law}, or a logical-connective statement pattern) for "this statement plausibly carries ' +
      'relational/conditional structure". It is not a formal entailment analysis — the actual generative-sufficiency ' +
      'claim is tested only by the real derivation-task probe (P-IRL-3), not by this proxy.',
  ],
  domainLimitation:
    'EXP-P1 is PRE-REGISTERED (README §12, inv.reasoning.349) as evaluating the runtime against the constitutional ' +
    "corpus it was derived from (Crystal vP1 = the platform's own doctrine collection). It is a validation of " +
    'INTERNAL COHERENCE and domain affinity, by design — NOT a claim of domain generality. No EXP-P1 outcome, ' +
    'however strong, may be read as evidence of domain-independent generalisation; that is explicitly sequenced as ' +
    'a distinct later phase (EXP-P2). This limitation is pre-registered, not a post-hoc caveat.',
};

// ─── §9 Review Output Guidance — decision kinds + the structured report schema.

const STRUCTURED_REVIEW_REPORT_SCHEMA = {
  findingId: 'string, required — stable within your report, e.g. "F1"',
  targetRef: 'string, required — the invariant id, section, or artifact this finding is about',
  category: 'string, required — one of the reviewMandate.dimensions, or "other"',
  finding: 'string, required — what you observed',
  evidenceRefs: 'string[], optional — supporting refs (e.g. a Locker document reference)',
  severity: "'blocking' | 'non-blocking', required",
  recommendation: 'string, required — what you recommend as a result',
};

const REVIEW_OUTPUT_GUIDANCE = {
  decisionKinds: OBSERVER_DECISION_KINDS,
  acceptedMayIncludeNonBlockingObservations:
    "An 'accepted' decision's rationale MAY contain non-blocking observations — accepting the substrate does not " +
    'mean you found nothing worth noting, only that nothing you found rises to blocking the crystal.',
  structuredReviewReportSchema: STRUCTURED_REVIEW_REPORT_SCHEMA,
  reportSubmissionGuidance:
    'Do not force every nuance of your review into the single prose `rationale` field on your decision. Author a ' +
    'structured report (one row per finding, using the schema above), upload it to the Locker, and supply its ' +
    'reference in your decision\'s `evidenceRefs`. `rationale` remains required and should summarize your overall ' +
    'judgment; `evidenceRefs` is where the detail lives.',
};

/*
 * EVERY EXIT IS A NAMED ANSWER (operator, 2026-08-03, on the third report of
 * `Unexpected end of JSON input`).
 */
export async function GET(req: NextRequest) {
  try {
    return await getImpl(req);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'UNHANDLED_ROUTE_ERROR',
        error:
          `This request threw before it could answer: ` +
          `${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}. ` +
          'Nothing here says whether the work completed — re-read the state before retrying.',
      },
      { status: 500 },
    );
  }
}

const PROHIBITIONS = [
  'No governance actions: this reviewer and their agent may not freeze, ratify, or perform any accept/revise/defer/reject resolution on a review record.',
  'No corpus mutation: the invariant canon, CFS corpus, and source assets under review may not be edited by this reviewer or their agent.',
  'No standing changes: Standing is granted only through the platform\'s own verified-contribution pipeline, never by an act of authority this role holds.',
  'No experiment execution: EXP-P1 may not be run, re-run, or have its parameters changed by this reviewer or their agent.',
  'No additional observer vote: a delegated agent may analyse the frozen crystal and submit attributable evidence alongside a decision (submittedByAgentRef), but the decision is recorded under the human reviewer\'s own persona alone — an agent never creates a second vote, and only a research-steward or principal-investigator may resolve a change proposal.',
  'No approval-by-implication: accepting under `reviewMandate` does not approve results, establish domain generality, authorize execution, or substitute for Protocol Ratification — see `reviewMandate.disclaimer`.',
  'These prohibitions hold unless and until a platform admin explicitly authorizes a broader grant — nothing in this package itself expands them.',
];

const STEWARD_ROLES = new Set(['research-steward', 'principal-investigator']);

async function getImpl(req: NextRequest) {
  // ONE timestamp for this whole response — `generatedAt`, `frozenCrystal`'s
  // `observedAt`/`computedAt`. No module this route calls reads a clock
  // itself (same discipline as crystalFreezeCeremony.ts); this is the single
  // point where "now" is read, so every stamp in one response agrees.
  const generatedAt = new Date().toISOString();

  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const admin = getSupabaseServer();
  const isAdmin = !!persona.cartridgeFlags?.isAdmin;
  const reviewerAccessConfirmed =
    isAdmin || (admin ? await callerMayReadExperimentReview(admin, persona.personaId, VALIDATION_PROGRAMME_EXPERIMENT_ID) : false);

  if (!reviewerAccessConfirmed) {
    return NextResponse.json({ ok: false, error: 'Not authorized to read this programme' }, { status: 403 });
  }

  const grant = admin ? await resolveExperimentReviewGrant(admin, persona.personaId, VALIDATION_PROGRAMME_EXPERIMENT_ID) : null;
  const isSteward = isAdmin || (grant ? STEWARD_ROLES.has(grant.role) : false);
  const callerRef = personaPublicRef(persona.personaId);

  const agreementStatus = admin
    ? await reviewerAgreementStatus(admin, {
        personaId: persona.personaId,
        experimentId: VALIDATION_PROGRAMME_EXPERIMENT_ID,
      })
    : null;
  const authority =
    grant && grant.role in RESEARCH_WORKSPACE_ROLE_AUTHORITY
      ? RESEARCH_WORKSPACE_ROLE_AUTHORITY[grant.role as ResearchWorkspaceRoleId]
      : null;

  const origin = resolveRequestOrigin(req);
  const experimentWorkspace = getResearchWorkspace(VALIDATION_PROGRAMME_WORKSPACE_ID);
  const programmeWorkspace = experimentWorkspace ? researchWorkspaceParent(experimentWorkspace) : null;
  const experiment = experimentWorkspace ? researchWorkspaceExperiment(experimentWorkspace) : null;

  const documentResources = await resolveExpP1DocumentResources(origin);

  /*
   * ── §1 LIFECYCLE — the crystal, the observer round, the protocol, and the
   * experiment execution state, EXPLICITLY SEPARATED (fixed 2026-08-09,
   * External Review Completeness Pass, point 1). A genuinely frozen artifact
   * NEVER serializes as anything resembling 'candidate' anywhere in this
   * package — every field below reads the same persisted artifact lifecycle,
   * never a stale pre-freeze computation re-run blind to it.
   */
  const artifact = await getArtifact(VALIDATION_PROGRAMME_EXPERIMENT_ID, 'crystal-version').catch(() => null);
  const isFrozen = artifact?.lifecycle === 'frozen';

  let observerRoundResolution: ReturnType<typeof resolveObserverRound> | null = null;
  let observerPackage: ObserverReviewPackage | null = null;
  let callerObserverStatus: ReturnType<typeof deriveCallerObserverStatus> | null = null;
  let roundStatus: string | null = null;
  /*
   * The SAME mayViewAll rule `/api/research/observer-review/[experimentId]`
   * uses (steward/admin, or the caller has already decided, or the round is
   * closed) — gates `assignedObserverRefs` and the unredacted `resolution`
   * below (SPEC point 8, tightened 2026-08-09 second pass). Defaults to
   * `isSteward` when there is no round to check a caller's own decision
   * against yet.
   */
  let mayViewFullObserverDetail = isSteward;
  if (isFrozen && artifact && admin) {
    try {
      const round = await getObserverRound(admin, observerRoundId(VALIDATION_PROGRAMME_EXPERIMENT_ID, artifact.id));
      if (round) {
        roundStatus = round.status;
        const callerHasDecided = round.decisions.some((d) => d.observerRef === callerRef);
        mayViewFullObserverDetail = isSteward || callerHasDecided || round.status !== 'open';
        if (round.package) {
          observerPackage = round.package;
          observerRoundResolution = resolveObserverRound({ pkg: round.package, decisions: round.decisions });
          callerObserverStatus = deriveCallerObserverStatus({
            pkg: round.package,
            decisions: round.decisions,
            callerRef,
            mayViewOthersProgress: mayViewFullObserverDetail,
          });
        }
      }
    } catch {
      // Honest absence — observerRoundResolution stays null, never fabricated.
    }
  }

  const observerReviewLifecycleState: 'not-applicable' | 'awaiting-assignment' | 'pending' | 'accepted' | 'changes_requested' | 'mixed' =
    !isFrozen
      ? 'not-applicable'
      : !observerRoundResolution
        ? 'awaiting-assignment'
        : observerRoundResolution.acceptance;

  const protocolGate = await deriveProtocolRatified(VALIDATION_PROGRAMME_EXPERIMENT_ID).catch(() => ({ ready: false, missing: [], present: [] }));
  const overview = await deriveOverview().catch(() => []);
  const overviewEntry = overview.find((e) => e.experiment.id === VALIDATION_PROGRAMME_EXPERIMENT_ID);
  const executionState = overviewEntry?.lifecycle ?? 'designed';

  const lifecycle = {
    crystal: {
      frozen: isFrozen,
      artifactId: artifact?.id ?? null,
      contentHash: isFrozen ? artifact?.contentHash ?? null : null,
      commitmentHash: isFrozen ? artifact?.commitmentHash ?? null : null,
      frozenAt: isFrozen ? artifact?.frozenAt ?? null : null,
      signatories: isFrozen ? artifact?.signedBy ?? [] : [],
      freezeReceiptRef: isFrozen ? artifact?.receiptId ?? null : null,
      note: isFrozen
        ? null
        : `artifact is '${artifact?.lifecycle ?? 'not-provisioned'}', not 'frozen' — see frozenCrystal (null) and crystalReviewEndpoint for the pre-freeze readiness surface instead.`,
    },
    observerReview: observerReviewLifecycleState,
    protocol: {
      artifactGateReady: protocolGate.ready,
      missingArtifactKinds: protocolGate.missing,
      presentArtifactKinds: protocolGate.present,
      note:
        'artifactGateReady mirrors deriveProtocolRatified — every PROTOCOL_FREEZE_ARTIFACT_KINDS member frozen. ' +
        'It is fully INDEPENDENT of observerReview: an accepted Observer Review round does not set this, and this ' +
        'gate does not read observer decisions (SPEC point 3).',
    },
    execution: executionState,
  };

  /*
   * ── §2 FROZEN CRYSTAL — the hash-verified manifest. `null` when the
   * crystal is not frozen (there is nothing to manifest yet); never a
   * live-corpus preview served under this key instead.
   */
  let frozenCrystal: FrozenCrystalManifest | null = null;
  if (isFrozen && artifact) {
    try {
      frozenCrystal = await buildFrozenCrystalManifest({ experimentId: VALIDATION_PROGRAMME_EXPERIMENT_ID, artifact, observedAt: generatedAt });
    } catch (e) {
      frozenCrystal = null;
      lifecycle.crystal.note = `frozenCrystal could not be built: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  /*
   * ── REVIEWABILITY — makes the mandate/evidence mismatch machine-readable
   * (fixed 2026-08-09, second review pass). `reviewMandate.dimensions` asks
   * Austin/Avi to judge 'population/exclusion integrity' — but
   * `frozenCrystal.freezeDisclosure.captured` is honestly false: that
   * historical disclosure was never persisted. Rather than hide the
   * dimension (which would remove a real, legitimate review question) or
   * force a reviewer into `unable_to_assess` for the WHOLE crystal over ONE
   * unassessable dimension, this states PRECISELY which dimensions are fully
   * assessable from the supplied evidence and which are only partially so —
   * with the constraint named and the permitted conclusion stated, so a
   * reviewer can accept the manifest while explicitly qualifying that one
   * dimension, rather than being forced into false confidence or a blanket
   * refusal.
   */
  const partiallyReviewable: Array<{ dimension: string; constraint: string; permittedConclusion: string }> = [];
  if (!frozenCrystal || !frozenCrystal.freezeDisclosure.captured) {
    partiallyReviewable.push({
      dimension: 'population/exclusion integrity',
      constraint:
        'Freeze-time cohort/exclusion disclosure was not persisted by the real freeze act — see ' +
        'frozenCrystal.freezeDisclosure.reason.',
      permittedConclusion:
        'Assess manifest integrity (the verified frozen member set) on its own terms; explicitly qualify any ' +
        'historical population/exclusion conclusion as unassessable from the supplied evidence, rather than either ' +
        "treating it as fully assessed or answering 'unable_to_assess' for the crystal as a whole over this one " +
        'dimension.',
    });
  }
  const reviewability = {
    fullyReviewableDimensions: REVIEW_MANDATE.dimensions.filter(
      (d) => !partiallyReviewable.some((p) => p.dimension === d),
    ),
    partiallyReviewableDimensions: partiallyReviewable,
  };

  // ── §3 EXPERIMENT DESIGN ────────────────────────────────────────────────
  const experimentDesign = await buildExperimentDesign(origin, experiment?.hypothesis ?? null);

  // ── §6 GOVERNING RESOURCES ───────────────────────────────────────────────
  const governingResources = await buildGoverningResources(origin);

  // ── §7 REVIEWER READINESS — a reviewer-safe gate PROJECTION, never the
  // admin-only readiness endpoint. States what is complete, what remains,
  // and what observer acceptance unlocks (SPEC point 7).
  const reviewerReadiness = {
    /*
     * The THIRD rung is DERIVED from `protocolGate.missing` (fixed
     * 2026-08-09, second review pass) — it previously hardcoded the FULL
     * artifact-kind list, which literally contradicted `completed` below
     * whenever an artifact (e.g. arm-config) was already frozen: the same
     * response would claim it both done and still-pending in the same
     * breath. Falls back to the full list only pre-freeze, when nothing has
     * been assessed yet and there is nothing to derive from.
     */
    gateSequence: [
      'Crystal Frozen',
      'Observer Accepted',
      protocolGate.present.length > 0 || protocolGate.missing.length > 0
        ? `remaining protocol artifact preparation/freeze: ${protocolGate.missing.length > 0 ? protocolGate.missing.join(', ') : 'none — all frozen'}`
        : 'task-set / answer-key / arm-config / judge-config / analysis-config / interpretation-table preparation',
      'Protocol Ratified',
      'Execution',
    ],
    completed: [
      ...(isFrozen ? ['Crystal Frozen'] : []),
      ...(observerReviewLifecycleState === 'accepted' ? ['Observer Accepted'] : []),
      ...(protocolGate.present.length > 0 ? [`Protocol artifacts frozen: ${protocolGate.present.join(', ')}`] : []),
    ],
    remaining: [
      ...(!isFrozen ? ['Crystal Frozen'] : []),
      ...(isFrozen && observerReviewLifecycleState !== 'accepted' ? [`Observer Accepted (currently: ${observerReviewLifecycleState})`] : []),
      ...(protocolGate.missing.length > 0 ? [`Protocol artifact preparation: ${protocolGate.missing.join(', ')}`] : []),
      ...(!protocolGate.ready ? ['Protocol Ratified'] : []),
      ...(executionState === 'designed' ? ['Execution'] : []),
    ],
    // The parenthetical is DERIVED from `protocolGate.missing`, same as
    // `gateSequence` above (fixed 2026-08-09, third review pass) — it
    // previously hardcoded the full artifact-kind list including
    // 'arm-config', contradicting `completed` above once arm-config froze.
    whatObserverAcceptanceUnlocks:
      'Observer Accepted is the signal that the frozen substrate is sound enough to begin POST-CRYSTAL protocol ' +
      `preparation (${protocolGate.missing.length > 0 ? protocolGate.missing.join(', ') : 'task-set, answer-key, arm-config, judge-config, analysis-config, interpretation-table'}). It does ` +
      'NOT unlock Protocol Ratified or Execution directly — those still require every PROTOCOL_FREEZE_ARTIFACT_KINDS ' +
      'artifact to independently reach `frozen` (see `lifecycle.protocol`), and Execution requires Protocol Ratified ' +
      'first. See `reviewMandate.disclaimer`.',
  };

  /*
   * IS THERE ANYTHING TO REVIEW? — kept, but now frozen-aware (fixed
   * 2026-08-09: this previously called `crystalMilestone({invariantCount})`
   * unconditionally, which has no notion of `frozen` and would keep saying
   * "Candidate Crystal constituted" forever, even on an already-frozen
   * crystal — the exact contradictory-vocabulary defect this pass exists to
   * close).
   */
  let crystalSubject: { reviewable: boolean; milestone: string; statement: string; guidance: string };
  if (isFrozen && artifact) {
    crystalSubject = {
      reviewable: true,
      milestone: 'Frozen',
      statement: `Crystal vP1 (${artifact.id}) is frozen. See lifecycle.crystal and frozenCrystal for the verified manifest.`,
      guidance: 'The crystal is frozen. Assess it via frozenCrystal and reviewMandate, then submit an Observer Decision — not a pre-freeze readiness recommendation.',
    };
  } else {
    try {
      const { runCrystalFreezeRecommendation } = await import('@/services/research/crystalFreezeRecommendation');
      const { crystalMilestone, isReviewableScientificObject, EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT } = await import(
        '@/services/research/crystalDomains'
      );
      const rec = await runCrystalFreezeRecommendation({ experimentId: VALIDATION_PROGRAMME_EXPERIMENT_ID });
      const invariantCount = rec.readiness?.invariantCount ?? 0;
      const milestone = crystalMilestone({ invariantCount });
      const reviewable = isReviewableScientificObject({ invariantCount });
      crystalSubject = {
        reviewable,
        milestone: milestone.label,
        statement: milestone.statement,
        guidance: reviewable
          ? 'The crystal holds invariants and is a reviewable scientific object. Assess it.'
          : EMPTY_PACKAGE_IS_PROVENANCE_NOT_SUBJECT,
      };
    } catch (e) {
      crystalSubject = {
        reviewable: false,
        milestone: 'Unknown',
        statement: `The crystal's readiness could not be read (${e instanceof Error ? e.message : String(e)}).`,
        guidance:
          'Could not determine whether there is anything to review. This is not a statement that the crystal is ' +
          'empty, and it is not permission to proceed as though it were populated. Re-read before assessing.',
      };
    }
  }

  // 'irl-os-cartridge' is the real codex id (data/codex-configs.ts:
  // IRL_OS_CARTRIDGE) — the embed route's bare-slug suffix-guessing only
  // ever tries '-codex' or '-cartridge' on an EXPLICIT existing suffix and
  // otherwise appends '-codex', so a bare 'irl-os' resolves to the
  // nonexistent 'irl-os-codex' and 404s client-side ("Failed to load
  // codex"). Fixed 2026-08-09 alongside the same bug in
  // services/constitutional/guidedOnboarding.ts's passportDeepLinks.
  const journeyUrl = `${origin}/triad/embed/codex/irl-os-cartridge?tab=irl-os-validation-programme`;

  /*
   * ── CURRENT ASSIGNMENT — what to do RIGHT NOW, personalized to this
   * caller (fixed 2026-08-09, second review pass). The rest of this package
   * correctly carries BOTH pre-freeze and post-freeze instructions (both are
   * real, and the crystal-review stage's description below still names the
   * pre-freeze reports) — a delegated agent should not have to infer which
   * half currently applies. This block states it directly, and personalizes
   * `requiredAction` to whether THIS caller has already decided.
   */
  let currentAssignment: {
    state: 'PRE_FREEZE_REVIEW' | 'AWAITING_OBSERVER_ASSIGNMENT' | 'POST_FREEZE_OBSERVER_REVIEW';
    objective: string;
    requiredAction: string;
    optionalAction: string;
    notRequiredNow: string[];
  };
  if (!isFrozen) {
    currentAssignment = {
      state: 'PRE_FREEZE_REVIEW',
      objective: 'Inspect the Crystal Readiness Report, Crystal Statistics, and Freeze Recommendation at crystalReviewEndpoint.',
      requiredAction: 'None required yet. You may comment, recommend a change, or contest a finding via QubeTalk/Locker.',
      optionalAction: 'None.',
      notRequiredNow: ['submitting an Observer Decision', 'protocol ratification', 'experiment execution'],
    };
  } else if (!observerPackage) {
    currentAssignment = {
      state: 'AWAITING_OBSERVER_ASSIGNMENT',
      objective: 'The crystal is frozen, but no Observer Review round has been assigned to you yet.',
      requiredAction: 'None — wait for a research-steward/principal-investigator to assign the round.',
      optionalAction: 'Inspect `frozenCrystal` and `experimentDesign` in the meantime.',
      notRequiredNow: ['a pre-freeze readiness recommendation', 'protocol ratification', 'experiment execution'],
    };
  } else {
    const callerDecided = (callerObserverStatus?.callerDecisionStatus ?? 'not-decided') !== 'not-decided';
    currentAssignment = {
      state: 'POST_FREEZE_OBSERVER_REVIEW',
      objective: 'Assess frozen Crystal vP1 against `reviewMandate`, respecting `reviewability`.',
      requiredAction: callerDecided
        ? `Already submitted: '${callerObserverStatus?.callerDecisionStatus}'. No further action required unless you wish to revise — resubmission replaces your own decision only, never adds a vote.`
        : 'Submit one Observer Decision to `observerReview.decisionSubmissionEndpoint`.',
      optionalAction: 'Upload a structured findings report to the Locker and reference it in your decision\'s evidenceRefs.',
      notRequiredNow: ['a pre-freeze readiness recommendation', 'protocol ratification', 'experiment execution'],
    };
  }

  /*
   * ── §8 / §9 OBSERVER REVIEW — hash-bound package + decision schema, now
   * with the CALLER-SCOPED status the observer-independence fix requires
   * (SPEC point 8). Never embeds another observer's rationale/outcome — it
   * never did (only the aggregate `resolution` was ever projected here), and
   * `callerObserverStatus` makes that boundary explicit rather than implicit.
   */
  const observerReview = observerPackage
    ? {
        packageHash: observerPackage.packageHash,
        roundPolicy: observerPackage.roundPolicy,
        // RESERVED FOR STEWARD/ADMIN (fixed 2026-08-09, second review pass):
        // the ref list and the unredacted resolution (which carries
        // outstandingObserverRefs and a ref-naming `detail` string) are
        // exactly what let a 2-observer round's "who's outstanding" become
        // "who specifically" by elimination. A bare reviewer gets only
        // `callerObserverStatus` below — counts and booleans about OTHERS,
        // never their refs.
        ...(mayViewFullObserverDetail
          ? { assignedObserverRefs: [...observerPackage.assignedObserverRefs], resolution: observerRoundResolution }
          : { resolution: observerRoundResolution ? projectResolutionForCaller(observerRoundResolution, false) : null }),
        callerObserverStatus,
        roundStatus,
        decisionSubmissionEndpoint: `${origin}/api/research/observer-review/${VALIDATION_PROGRAMME_EXPERIMENT_ID}/decision`,
        decisionSchema: {
          decision: OBSERVER_DECISION_KINDS,
          rationale: 'string, required — an accepted rationale MAY include non-blocking observations, see reviewOutputGuidance',
          evidenceRefs: 'string[], optional — e.g. a Locker reference to your structured review report',
          submittedByAgentRef:
            'string, optional — records that a delegated agent assisted; the decision is still attributed to ' +
            'the calling persona alone and never creates an additional vote',
          proposedChange: "string, required only when decision === 'changes_requested'",
        },
        changeProposalEndpoint: `${origin}/api/research/observer-review/${VALIDATION_PROGRAMME_EXPERIMENT_ID}/change-proposal`,
      }
    : null;

  /*
   * ── §10 MACHINE CONTRACT — schema version, generated timestamp, and the
   * method/auth expectations for every actionable endpoint this package
   * names, so a delegated agent can validate the package shape and its own
   * next call before acting.
   */
  const machineContract = {
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    generatedAt,
    authExpectation:
      'Every endpoint below requires the SAME authenticated session that fetched this package (Bearer/session ' +
      'cookie per the platform\'s identity spine) — there is no separate API key.',
    endpoints: [
      { id: 'crystalReview', method: 'GET', path: `/api/research/crystal/${VALIDATION_PROGRAMME_EXPERIMENT_ID}`, authRequired: true, note: 'Pre-freeze readiness/statistics/recommendation report. Frozen-aware (never reports READY_FOR_FREEZE once frozen).' },
      { id: 'observerRoundStatus', method: 'GET', path: `/api/research/observer-review/${VALIDATION_PROGRAMME_EXPERIMENT_ID}`, authRequired: true, note: 'Your own round status, blinded per SPEC point 8.' },
      { id: 'submitObserverDecision', method: 'POST', path: `/api/research/observer-review/${VALIDATION_PROGRAMME_EXPERIMENT_ID}/decision`, authRequired: true, note: 'Self-service, persona-scoped. Requires an authorized Independent Reviewer Agreement.' },
      { id: 'reviewerAgreement', method: 'POST', path: '/api/research/reviewer-agreement', authRequired: true, note: 'Authorize the Independent Reviewer Agreement — required before a decision submission is admitted.' },
      { id: 'lockerUpload', method: 'GET/POST', path: '/api/polity-passport/locker', authRequired: true, note: 'Upload a structured review report; supply its reference in your decision\'s evidenceRefs.' },
    ],
  };

  return NextResponse.json({
    ok: true,
    package: {
      schemaVersion: PACKAGE_SCHEMA_VERSION,
      generatedAt: machineContract.generatedAt,
      programme: {
        id: programmeWorkspace?.id ?? null,
        title: programmeWorkspace?.title ?? null,
        description: programmeWorkspace?.description ?? null,
        institutionRefs: programmeWorkspace?.institutionRefs ?? [],
      },
      experiment: {
        id: VALIDATION_PROGRAMME_EXPERIMENT_ID,
        workspaceId: VALIDATION_PROGRAMME_WORKSPACE_ID,
        label: experimentWorkspace ? researchWorkspaceLabel(experimentWorkspace) : VALIDATION_PROGRAMME_EXPERIMENT_ID,
        family: experiment?.family ?? null,
        hypothesis: experiment?.hypothesis ?? null,
        currentStage: experimentWorkspace?.currentStage ?? null,
        crystalDomain: crystalDomainForExperiment(VALIDATION_PROGRAMME_EXPERIMENT_ID)?.domain ?? null,
      },
      reviewer: {
        personaRef: callerRef,
        role: grant?.role ?? (isAdmin ? 'admin-preview' : null),
        allowedExperiments: grant?.allowedExperiments ?? (isAdmin ? 'all' : []),
        isSteward,
        note: isAdmin && !grant
          ? 'Admin preview — this caller holds platform admin rights, not a scoped research-lab grant. An invited reviewer\'s real grant will show a role from access_grants instead.'
          : null,
      },
      permittedAuthority: authority,
      stages: VALIDATION_PROGRAMME_JOURNEY.stages.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        permittedActions: s.permittedActions,
        completionEvidence: s.completionEvidence,
      })),
      journeyUrl,
      documentResources,

      lifecycle,
      frozenCrystal,
      experimentDesign,
      reviewMandate: { ...REVIEW_MANDATE, reviewability },
      scientificLimitations: SCIENTIFIC_LIMITATIONS,
      governingResources,
      reviewerReadiness,
      reviewOutputGuidance: REVIEW_OUTPUT_GUIDANCE,
      currentAssignment,
      observerReview,

      crystalReviewEndpoint: `${origin}/api/research/crystal/${VALIDATION_PROGRAMME_EXPERIMENT_ID}`,
      crystalSubject,
      // Not actionable for a reviewer/observer or their delegated agent —
      // this is the ADMIN-ONLY automated dual-model (R1/R2) review pipeline,
      // a distinct mechanism from `observerReview` above. Labeled rather
      // than presented as a plain callable endpoint (fixed 2026-08-09,
      // second review pass) so a reader doesn't reasonably infer they can
      // call it.
      reviewQueue: {
        endpoint: `${origin}/api/research/review`,
        accessible: false,
        note: 'Admin-only automated dual-model (R1/R2) review pipeline. Reviewers and their delegated agents act through `observerReview`, not here.',
      },
      agreement: agreementStatus
        ? {
            id: agreementStatus.agreementId,
            version: agreementStatus.version,
            canonicalHash: agreementStatus.canonicalHash,
            authorizationStatus: agreementStatus.authorizationStatus,
            authorizedHash: agreementStatus.authorizedHash,
            hashMatch: agreementStatus.hashMatch,
            requiresReauthorization: agreementStatus.requiresReauthorization,
            authorizedAt: agreementStatus.authorizedAt,
            conflictDeclared: agreementStatus.conflictDeclared,
            message: agreementStatus.message,
            consentModel: CONSENT_BINDS_EXACT_TERMS,
            authorizeEndpoint: `${origin}/api/research/reviewer-agreement`,
          }
        : {
            authorizationStatus: 'unavailable',
            message:
              'Agreement status could not be read on this request. This does not affect any authorization already given.',
          },
      agreementAndAcknowledgement: {
        mechanism:
          'Programme ACCESS is claimed through the Locker\'s x409/access-invitation claim (LockerTab, Invitation section). The Independent Reviewer AGREEMENT is a separate, canonical, experiment-scoped act with its own endpoint and its own durable record — see the `agreement` block above. The two are distinct: claiming an invitation admits you to the programme; authorizing the agreement is what permits a review SUBMISSION.',
        claimAccessInvitationEndpoint: `${origin}/api/participation/claim`,
        reviewerAgreementEndpoint: `${origin}/api/research/reviewer-agreement`,
        claimAgreementEndpoint: `${origin}/api/polity-passport/locker/claim-agreement`,
        lockerReadEndpoint: `${origin}/api/polity-passport/locker`,
      },
      qubetalk: {
        channelsEndpoint: `${origin}/api/qubetalk/passport-channels`,
        note:
          'Persona-scoped citizen ↔ delegated-agent channels — populated once the reviewer has claimed their invitation and a delegation exists. No workspace-wide channel id exists separately from this.',
      },
      expectedReviewOutput:
        'Pre-freeze: comments, recommendations, and contested-finding flags against the Crystal Readiness Report, ' +
        'Crystal Statistics, and Freeze Recommendation served at crystalReviewEndpoint. Post-freeze: a structured ' +
        'Observer Decision against `frozenCrystal`, evaluated against `reviewMandate` — see the `observerReview` ' +
        'block for the exact schema and `reviewOutputGuidance` for how to report nuance beyond one prose field. The ' +
        'automated dual-review pipeline (POST /api/research/review, admin-only) remains a distinct mechanism.',
      submissionMechanism:
        'Pre-freeze deliberation: Peer Exchange (QubeTalk) and Upload to Locker, inside the Submit Review stage\'s ' +
        'LockerTab render. Post-freeze structured decision: POST to `observerReview.decisionSubmissionEndpoint` — ' +
        'see `reviewOutputGuidance` for the recommended structured-report-plus-Locker-upload pattern for anything ' +
        'beyond a one-line rationale.',
      prohibitions: PROHIBITIONS,
      machineContract,
    },
  });
}
