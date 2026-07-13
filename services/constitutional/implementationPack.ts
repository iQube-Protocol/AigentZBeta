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
    validationPlan: [
      'esbuild parse gates on touched files',
      'existing test suite',
      'coherence/canary checks where applicable',
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
    preflight = {
      disposition: forecast.forcesEscalation ? 'escalate' : 'proceed',
      forcesEscalation: forecast.forcesEscalation,
      enables: forecast.enables,
      constrains: forecast.constrains,
      contradicts: forecast.contradicts,
      rationale: forecast.rationale,
      risk: { score: risk.overall_score, flags: risk.risk_flags, basis: 'heuristic' },
      value: { workPotentialQc: value.work_potential_qc, basis: 'heuristic' },
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
    ...fields,
  };
}
