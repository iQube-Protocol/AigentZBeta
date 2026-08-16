/**
 * Implementation Pack service (CFS-015, Strand Two, Phase 2).
 *
 * The Implementation Pack is the artifact produced immediately BEFORE the
 * implementation stage of the Constitutional Capability Pipeline (2026-07-06
 * amendment): it binds a capability goal to its governing invariants,
 * canonical terms, areas to touch, implementation mechanism, validation plan,
 * and receipt plan. Per CFS-015, what the pipeline produces is CAPABILITY,
 * not code — development is one implementation mechanism among several
 * (configuration, registry, prompts, policy, schemas, knowledge, automation,
 * documentation).
 *
 * This module is ONE constitutional service, not the pipeline: it composes
 * the frozen Phase-1 organs (assembleContextPack for grounding, callStage for
 * routed inference) and never forks them. On LLM failure it degrades to a
 * deterministic template pack (composedBy: 'template') built from the
 * ContextPack alone — it NEVER fabricates specifics the model didn't provide.
 *
 * Server-only.
 */

import { randomUUID } from 'node:crypto';
import type { ContextPack, ResolvedTerm } from '@/types/constitutional';
import { assembleContextPack } from '@/services/constitutional/ontologyResolver';
import { callStage } from '@/services/constitutional/modelRouter';
import { parseJsonLenient, callChatWithUsage, type ExperimentProvider } from '@/services/experiments/llm';
import { forecastConsequences, assessRiskHeuristic, assessValueHeuristic } from '@/services/consequence/stages';
import {
  IMPLEMENTATION_MECHANISMS,
  capabilityEvidenceBlock as evidenceBlock,
  areasFromEvidence as evidenceAreas,
  saveCapabilityEvidence,
  readLatestCapabilityEvidence,
  evidenceFreshnessFor,
  EVIDENCE_FRESHNESS_WINDOW_DAYS,
  type EvidenceFreshness,
  type ImplementationMechanism as Mechanism,
  type CapabilityEvidence as Evidence,
} from '@/services/constitutional/capabilityEvidence';
import {
  decideRealizationMechanism,
  isRealizationMechanism,
  type ConstitutionalDecision,
} from '@/services/constitutional/constitutionalDecision';
import { deriveForbiddenFiles } from '@/services/constitutional/protectedFiles';
import { routeExecution, type ExecutionRoute } from '@/services/constitutional/executionRouting';

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

// CFS-015: development is one mechanism among several. The mechanism
// vocabulary + the Capability Evidence primitive live in the leaf module
// (capabilityEvidence.ts) as of the 2026-07-13 CFS-029 re-homing — re-exported
// here so existing importers are unchanged.
export {
  capabilityEvidenceBlock,
  sessionFindingsBlock,
  areasFromEvidence,
  areasFromFindings,
} from '@/services/constitutional/capabilityEvidence';
export { IMPLEMENTATION_MECHANISMS };
export type {
  ImplementationMechanism,
  CapabilityEvidence,
  SessionFindings,
} from '@/services/constitutional/capabilityEvidence';

export interface InvariantBinding {
  /** DB id of the grounding invariant (from the ContextPack slice). */
  id: string;
  /** Seed id (e.g. inv.constitutional.011) when the invariant has one. */
  seedId: string | null;
  statement: string;
}

export interface ImplementationPack {
  id: string;
  intentId: string | null;
  goal: string;
  /** Governing invariants from the ContextPack slice. */
  invariantBindings: InvariantBinding[];
  /** Ontology resolution the goal was grounded against (resolution precedes reasoning). */
  resolvedTerms: ResolvedTerm[];
  /** File/dir globs or subsystem names — empty when unknown, never invented. */
  areasToTouch: string[];
  implementationMechanism: Mechanism;
  validationPlan: string[];
  receiptPlan: string[];
  canonVersion: string;
  generatedAt: string;
  composedBy: 'llm' | 'template';
  /** Consequence preflight over the binding invariants (CFS-006a organs) —
   * lights the risk/value/consequence pipeline stages. `basis: 'heuristic'`
   * keeps the honesty: these are the v1 heuristics, not the ratified
   * RiskQube/ValueQube. Null when the preflight could not run (best-effort —
   * pack generation never blocks on it). */
  preflight: PackPreflight | null;
  /** Capability Evidence (CFS-029: a persisted constitutional primitive, not
   * transient session data) — the what-exists-vs-what's-needed inventory the
   * pack was grounded in. Null only when no evidence was supplied AND none is
   * persisted for the goal. */
  capabilityEvidence: Evidence | null;
  /** Durable id of the persisted evidence row (capability_evidence table) —
   * evidence outlives sessions; this is the pointer future generations reuse. */
  capabilityEvidenceId: string | null;
  /** The Constitutional Decision (CFS-029): HOW the capability should be
   * realized, decided BEFORE the plan was drafted — over the nine mechanisms
   * plus 'none' (capability exists; compose, build nothing). */
  constitutionalDecision: ConstitutionalDecision;
  /** Freshness of the grounding evidence (CFS-029 §7.3): 'supplied' (live from
   * a session) · 'persisted-fresh' · 'persisted-stale' (older than the window
   * — re-inventory recommended, grounding proceeded LOUDLY) · 'none'. */
  evidenceFreshness: EvidenceFreshness;
  /** Phase F bounded-execution repair (operator-directed 2026-08-16): the
   * files an ordinary implementation actor may NEVER touch — derived from
   * CLAUDE.md's own protected-file lists
   * (`services/constitutional/protectedFiles.ts`), never a second
   * hand-written list. Ships on EVERY pack so the actor never has to
   * re-read repo-wide governance prose to reconstruct this boundary. */
  forbiddenFiles: string[];
  /** Pre-existing test/typecheck failures the implementation actor should
   * NOT spend turns rediscovering or attempting to fix (unless the pack's
   * own goal names them). Supplied by the caller (e.g. DevOn's dev-loop
   * validation pass) — never invented or live-derived here; empty when the
   * caller has no such evidence yet. */
  knownBaselineFailures: string[];
  /** The selected implementation-actor route (profile, provider, model,
   * execution budget) — computed from THIS pack's own risk/uncertainty/
   * protected-surface signals (`services/constitutional/executionRouting.ts`),
   * closing the forensic audit's "unpinned model, no budget" finding. */
  executionRoute: ExecutionRoute;
  /** Pack-coherence repair (2026-08-17, operator-directed): protected files
   * that the LLM draft or evidence-seeded `areasToTouch` proposed but that
   * were REMOVED before this pack shipped, because they are in
   * `forbiddenFiles` and were not explicitly authorized
   * (`authorizedProtectedFiles`). An "impossible surface declaration" — a
   * pack that simultaneously requests and forbids the same file — must never
   * reach an implementation actor; this is the audit trail of what was
   * excluded and why. Empty when nothing was excluded. */
  excludedProtectedAreas: string[];
}

export interface PackPreflight {
  disposition: 'proceed' | 'escalate';
  forcesEscalation: boolean;
  enables: number;
  constrains: number;
  contradicts: number;
  rationale: string;
  risk: { score: number; flags: string[]; basis: 'heuristic' };
  /** Q¢ integer cents (Q¢ canon) — display USD-primary. */
  value: { workPotentialQc: number; basis: 'heuristic' };
  /** Phase F (2026-08-16): specific, named uncertainties the implementation
   * actor should treat as KNOWN open questions rather than rediscovering —
   * e.g. "the owning cartridge for this surface was not resolved with
   * confidence." Empty when the preflight found nothing genuinely uncertain. */
  uncertaintyNotes: string[];
  /** Named conditions under which the actor MUST escalate
   * (`awaiting-escalation`) rather than proceed or silently expand scope —
   * distinct from `forcesEscalation` (a computed boolean gate): these are the
   * human-readable REASONS an escalation, if it happens, would be correct. */
  escalationConditions: string[];
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface LlmDraft {
  implementationMechanism?: unknown;
  areasToTouch?: unknown;
  validationPlan?: unknown;
  receiptPlan?: unknown;
}

function isMechanism(value: unknown): value is Mechanism {
  return typeof value === 'string' && (IMPLEMENTATION_MECHANISMS as readonly string[]).includes(value);
}

function asStringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 300))
    .slice(0, max);
}

const DRAFT_SYSTEM = `You are the consequence-stage drafter for the Constitutional Capability Pipeline (CFS-015). Given a capability goal and its invariant-grounded context, draft the Implementation Pack planning fields.

Respond with ONLY a JSON object matching EXACTLY this schema — no prose, no markdown fence:
{
  "implementationMechanism": "code" | "configuration" | "registry" | "prompt" | "policy" | "schema" | "knowledge" | "automation" | "documentation",
  "areasToTouch": string[],
  "validationPlan": string[],
  "receiptPlan": string[]
}

Rules:
- Development ("code") is ONE implementation mechanism among several — pick the mechanism that actually delivers the capability, not code by default.
- areasToTouch: file/directory globs or subsystem names likely touched. If you are not confident about a specific path or subsystem, OMIT it — an empty array is correct when unknown; never invent paths.
- validationPlan: concrete, checkable validation steps for this capability.
- receiptPlan: which receipts to emit and when during implementation.
- Output must parse with JSON.parse: no trailing commas, no comments.`;

function draftUserPrompt(
  goal: string,
  pack: ContextPack,
  evidence?: Evidence,
  decision?: ConstitutionalDecision,
  evidenceFreshness?: EvidenceFreshness,
): string {
  const lines: string[] = [`Capability goal:\n${goal}`, ...evidenceBlock(evidence)];
  if (evidenceFreshness === 'persisted-stale') {
    lines.push(
      `NOTE: the capability evidence above is PERSISTED and older than ${EVIDENCE_FRESHNESS_WINDOW_DAYS} days — treat paths/dispositions as possibly outdated and include a re-inventory step in the validation plan.`,
    );
  }
  if (decision) {
    lines.push(
      `CONSTITUTIONAL DECISION (already taken — the plan MUST realize the capability through it): ` +
        `mechanism='${decision.mechanism}'${decision.noBuildRequired ? ' — NO BUILD REQUIRED: plan the COMPOSITION of the existing capabilities, not construction' : ''}. Rationale: ${decision.rationale}`,
    );
  }
  if (pack.slice.items.length > 0) {
    lines.push(
      'Governing invariants (bind the plan to these):',
      ...pack.slice.items.map((i) => `- ${i.seedId ?? i.id}: ${i.statement}`),
    );
  }
  if (pack.resolvedTerms.length > 0) {
    lines.push(
      'Canonical terms in play (use these exact forms):',
      ...pack.resolvedTerms.map((t) => `- ${t.canonical}`),
    );
  }
  return lines.join('\n');
}

/** Deterministic fallback built from the ContextPack alone — no fabrication. */
function templateFields(): Pick<
  ImplementationPack,
  'areasToTouch' | 'implementationMechanism' | 'validationPlan' | 'receiptPlan' | 'composedBy'
> {
  return {
    composedBy: 'template',
    implementationMechanism: 'code',
    areasToTouch: [],
    // Phase F fix (2026-08-16): the prior default here — 'existing test
    // suite' — read literally as an instruction to run the WHOLE repo's
    // test suite on every template-fallback pack, regardless of scope. The
    // staged ladder below scopes validation to the touched surface first,
    // reserving a full regression for the final gate, run at most once.
    validationPlan: [
      'typecheck/esbuild parse gates on touched files',
      'targeted canaries named in the pack (none named — template fallback)',
      'affected-subsystem tests for the touched surface',
      'full regression exactly once, at the final validation gate',
    ],
    receiptPlan: [
      'implementation_pack_generated on generation',
      'stage receipts during implementation',
    ],
  };
}

export async function generateImplementationPack(input: {
  goal: string;
  intentId?: string;
  context?: { domains?: string[] };
  /** Capability Evidence (CFS-029) — the pipeline's what-exists-vs-needed
   * inventory. When supplied it is PERSISTED (evidence outlives sessions);
   * when omitted, the latest persisted evidence for the goal is read back. */
  capabilityEvidence?: Evidence;
  /** Legacy name for capabilityEvidence (transport-object era) — honoured
   * when the new field is absent. */
  sessionFindings?: Evidence;
  /** A Constitutional Decision ALREADY taken (the DCC Decision stage, CFS-029
   * §7.1) — when supplied and valid, the generator honours it instead of
   * re-deciding (one decision, taken once, travelling forward). */
  decision?: ConstitutionalDecision;
  /** Sovereignty-drill pin (EXP-004): route the draft through ONE explicit
   * provider instead of the per-stage router. The template fallback applies
   * identically — constitutional operation continues even if the pinned
   * provider fails. */
  providerPin?: ExperimentProvider;
  /** Phase F (2026-08-16): pre-existing test/typecheck failures the caller
   * already knows about (e.g. from DevOn's own dev-loop validation pass) —
   * carried onto the pack so the implementation actor never spends turns
   * rediscovering established baseline noise. Never computed here; supplied
   * or omitted (defaults to none known). */
  knownBaselineFailures?: string[];
  /** Phase F (2026-08-16): true when a prior implementation attempt on this
   * exact goal/branch already failed — routes to the 'remediation' execution
   * profile (a stronger model, a larger budget) rather than repeating the
   * same routine-tier attempt. Defaults to false (first attempt). */
  priorAttemptFailed?: boolean;
  /** Phase F (2026-08-16): protected files this SPECIFIC pack has been
   * explicitly, operator-approved to modify — narrows `forbiddenFiles` from
   * the full protected manifest. Never inferred; empty by default (the
   * maximally protective case). */
  authorizedProtectedFiles?: string[];
}): Promise<ImplementationPack> {
  let contextPack = await assembleContextPack(input.goal, {
    domains: input.context?.domains,
  });
  // Domain-filter fallback (fix 2026-07-13): a live canon with ZERO bindings
  // meant the caller's domain filter (e.g. the session's relatedCartridges)
  // matched no invariant rows — grounding then retries UNFILTERED. Honest
  // widening of scope, never invention; the canon itself is unchanged.
  if (contextPack.slice.items.length === 0 && (input.context?.domains?.length ?? 0) > 0) {
    contextPack = await assembleContextPack(input.goal, {});
  }

  const invariantBindings: InvariantBinding[] = contextPack.slice.items.map((item) => ({
    id: item.id,
    seedId: item.seedId,
    statement: item.statement,
  }));

  // ── Capability Evidence (CFS-029): persists across sessions ──
  // Fresh evidence is saved; absent evidence is read back from the store so a
  // pack generated OUTSIDE the originating session still knows what exists.
  const suppliedEvidence = input.capabilityEvidence ?? input.sessionFindings;
  let evidence: Evidence | null = suppliedEvidence ?? null;
  let evidenceId: string | null = null;
  let evidenceFreshness: EvidenceFreshness = suppliedEvidence ? 'supplied' : 'none';
  if (suppliedEvidence) {
    evidenceId = await saveCapabilityEvidence({
      goal: input.goal,
      intentRef: input.intentId ?? null,
      evidence: suppliedEvidence,
    });
  } else {
    const persisted = await readLatestCapabilityEvidence(input.goal);
    if (persisted) {
      evidence = persisted.evidence;
      evidenceId = persisted.id;
      // Freshness policy (CFS-029 §7.3): stale evidence still grounds, but
      // LOUDLY — flagged on the pack + a re-inventory line in the prompt.
      evidenceFreshness = evidenceFreshnessFor(persisted.createdAt, new Date().toISOString());
    }
  }

  // ── Constitutional Decision (CFS-029): HOW the capability is realized,
  // decided BEFORE any plan is drafted — over the nine mechanisms + 'none'.
  // A decision already taken at the DCC Decision stage is honoured verbatim.
  const decision =
    input.decision && isRealizationMechanism(input.decision.mechanism)
      ? input.decision
      : await decideRealizationMechanism(input.goal, evidence ?? undefined);

  let fields = templateFields();
  try {
    const routed = input.providerPin
      ? await callChatWithUsage(input.providerPin, DRAFT_SYSTEM, draftUserPrompt(input.goal, contextPack, evidence ?? undefined, decision, evidenceFreshness), 900)
      : await callStage('consequence', DRAFT_SYSTEM, draftUserPrompt(input.goal, contextPack, evidence ?? undefined, decision, evidenceFreshness), 900);
    const draft = parseJsonLenient<LlmDraft>(routed.text);
    // A draft without a valid mechanism is not a usable plan — degrade to
    // template rather than fabricating around it. Arrays the model omitted
    // stay empty (honest), never invented.
    if (isMechanism(draft.implementationMechanism)) {
      fields = {
        composedBy: 'llm',
        implementationMechanism: draft.implementationMechanism,
        areasToTouch: asStringArray(draft.areasToTouch),
        validationPlan: asStringArray(draft.validationPlan),
        receiptPlan: asStringArray(draft.receiptPlan),
      };
    } else {
      console.warn('[ImplementationPack] LLM draft missing valid mechanism — using template pack');
    }
  } catch (err) {
    console.warn(
      `[ImplementationPack] LLM draft failed — using template pack: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Consequence preflight (CFS-006a organs) over the binding invariants —
  // best-effort: any failure yields null and the pack ships without it.
  let preflight: PackPreflight | null = null;
  try {
    const forecast = await forecastConsequences(invariantBindings.map((b) => b.id));
    // 'coherent' is a real signal here: reachable contradictions in the
    // knowledge footprint = incoherent grounding (never assumed true).
    const coherent = forecast.contradicts === 0;
    const items = contextPack.slice.items;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const now = new Date().toISOString();
    const risk = assessRiskHeuristic({
      iqubeId: 'implementation-pack',
      aggregateConfidence: mean(items.map((i) => i.confidence)),
      knowledgeSize: invariantBindings.length,
      coherent,
      now,
    });
    const value = assessValueHeuristic({
      iqubeId: 'implementation-pack',
      aggregateStanding: mean(items.map((i) => i.standing)),
      knowledgeSize: invariantBindings.length,
      now,
    });
    // Phase F (2026-08-16): named, honest uncertainty signals — never
    // invented beyond what the forecast/evidence themselves already show.
    const uncertaintyNotes: string[] = [];
    if (evidenceFreshness === 'persisted-stale') {
      uncertaintyNotes.push('grounding evidence is persisted and stale — paths/dispositions may be outdated');
    }
    if (!coherent) {
      uncertaintyNotes.push(`${forecast.contradicts} reachable contradiction(s) in the invariant footprint`);
    }
    const escalationConditions: string[] = [
      'a genuinely unresolved constitutional question arises during implementation (escalate — never reload broad canon to self-resolve it)',
      'implementation would require modifying a file in forbiddenFiles',
      'the execution budget is exhausted before the goal is complete',
    ];
    preflight = {
      disposition: forecast.forcesEscalation ? 'escalate' : 'proceed',
      forcesEscalation: forecast.forcesEscalation,
      enables: forecast.enables,
      constrains: forecast.constrains,
      contradicts: forecast.contradicts,
      rationale: forecast.rationale,
      risk: { score: risk.overall_score, flags: risk.risk_flags, basis: 'heuristic' },
      value: { workPotentialQc: value.work_potential_qc, basis: 'heuristic' },
      uncertaintyNotes,
      escalationConditions,
    };
  } catch (err) {
    console.warn(
      `[ImplementationPack] consequence preflight failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // The evidence already named the paths — when the draft (LLM or template)
  // left areasToTouch empty, seed it deterministically from the evidence.
  // Pipeline-named paths, never invented ones (the No-Guessing line holds).
  // A 'none' decision touches nothing — composition, not construction.
  if (fields.areasToTouch.length === 0 && !decision.noBuildRequired) {
    fields = { ...fields, areasToTouch: evidenceAreas(evidence ?? undefined) };
  }

  // The decided mechanism is authoritative when the draft disagrees (the
  // decision was taken FIRST, with the evidence in view). 'none' keeps the
  // draft's mechanism field as its lightest legal value ('knowledge': the
  // realization is knowing what already exists) — the decision object is the
  // semantic truth and travels beside it.
  if (decision.mechanism !== 'none' && fields.implementationMechanism !== decision.mechanism) {
    fields = { ...fields, implementationMechanism: decision.mechanism };
  } else if (decision.mechanism === 'none') {
    fields = { ...fields, implementationMechanism: 'knowledge', areasToTouch: [] };
  }

  // Phase F (2026-08-16): forbiddenFiles + executionRoute are computed from
  // this pack's OWN signals — never a second, hand-authored classification.
  const forbiddenFiles = deriveForbiddenFiles(input.authorizedProtectedFiles ?? []);

  // Coherence repair (2026-08-17, operator-directed): "areasToTouch ∩
  // forbiddenFiles = ∅ unless a governed explicit protected-file
  // authorization exists." authorizedProtectedFiles already narrows
  // forbiddenFiles above, so an authorized file is never excluded here — only
  // an UNAUTHORIZED protected file is removed, loudly (excludedProtectedAreas
  // below), never silently. The pack that actually ships — what an
  // implementation actor reads as its surface — must never simultaneously
  // request and forbid the same file. This MUST run BEFORE routing: routing
  // reads areasToTouch as the pack's FINAL surface (see below).
  const excludedProtectedAreas = fields.areasToTouch.filter((a) => forbiddenFiles.includes(a));
  if (excludedProtectedAreas.length > 0) {
    fields = { ...fields, areasToTouch: fields.areasToTouch.filter((a) => !forbiddenFiles.includes(a)) };
  }

  // Routing correction (2026-08-18, operator-directed): route selection sees
  // the FINAL, post-filter surface — NOT the pre-filter draft/evidence one.
  // A protected file that was proposed but then EXCLUDED (unauthorized,
  // reference/evidence-only) is by now simply absent from areasToTouch and
  // must never, by itself, force the 'protected' profile — that would
  // escalate model/cost for a routine goal merely because retrieval
  // surfaced a protected reference, reopening the unpinned-cost risk Phase F
  // exists to close. An AUTHORIZED protected file, by contrast, remains in
  // this final areasToTouch and correctly escalates (selectExecutionProfile
  // checks the full protected-file manifest, independent of authorization —
  // see executionRouting.ts) — protected routing tracks genuine
  // protected-surface MODIFICATION, never a mere reference.
  const executionRoute: ExecutionRoute = routeExecution(
    { areasToTouch: fields.areasToTouch, forbiddenFiles, preflight },
    input.priorAttemptFailed ?? false,
  );

  return {
    id: randomUUID(),
    intentId: input.intentId ?? null,
    goal: input.goal,
    invariantBindings,
    resolvedTerms: contextPack.resolvedTerms,
    canonVersion: contextPack.canonVersion,
    generatedAt: new Date().toISOString(),
    preflight,
    capabilityEvidence: evidence,
    capabilityEvidenceId: evidenceId,
    constitutionalDecision: decision,
    evidenceFreshness,
    forbiddenFiles,
    knownBaselineFailures: input.knownBaselineFailures ?? [],
    executionRoute,
    excludedProtectedAreas,
    ...fields,
  };
}
