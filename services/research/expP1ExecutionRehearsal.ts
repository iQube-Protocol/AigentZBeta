/**
 * EXP-P1 execution rehearsal — the genuine per-arm model-execution layer
 * (2026-09-07, "freeze Arm B treatment and implement the genuine execution/
 * evidence-of-use rehearsal layer").
 *
 * ── WHAT THIS ADDS OVER `expP1Rehearsal.ts` ──────────────────────────────────
 *
 * `expP1Rehearsal.ts` measures SELECTED-SET recall — which invariants an arm
 * was offered, never what a generated answer actually used. This module
 * executes the task against each arm's ACTUAL treatment via a real model call
 * (`services/experiments/llm.ts::callChatWithUsage` — the SAME provider-
 * calling seam every `services/experiments/exp00N.ts` harness already uses;
 * no parallel inference system is built here), then extracts evidence-of-use
 * from the model's OWN generated text — never inferring "used" merely because
 * an invariant was supplied.
 *
 * ── FREEZE: Arm B selector is PINNED to `task-scoped-v1` ────────────────────
 *
 * `selectTaskScopedInvariants` (`services/invariants/taskScopedSelection.ts`)
 * is frozen at `FROZEN_ARM_B_SELECTOR_VERSION` for this experimental stage.
 * `assertFrozenSelectorVersion` refuses to run if the module's own
 * `TASK_SCOPED_SELECTOR_VERSION` has moved without a deliberate update here —
 * this is the auditable proof that a run's Arm B context came from the
 * selector version this file claims, never a silently-drifted one. Per
 * operator instruction: "Do not tune its relevance, graph-expansion, standing,
 * budgeting or other selection behaviour in response to v2/v3 outcomes" — no
 * change was made to `taskScopedSelection.ts` to produce this module; the
 * selector's own commit history predates the v3 results this module's task
 * set was authored after.
 *
 * ── THE CORRECTED ORDER, PRESERVED (Arm B, unchanged from the audited fix) ──
 *
 *   intent -> relevance/functional role -> relational completion -> standing
 *   calibration -> [Stage 5: consequence/value calibration, NAMED NO-OP] ->
 *   bounded representation.
 *
 * Stage 5 stays non-operative here too: `valueEstimate`/`riskOfRepairEstimate`
 * on every `TaskScopedSelectionItem` this module reads are `null`, untouched,
 * un-invented. No Lehigh/value/risk coefficient is computed or consulted
 * anywhere in this file.
 *
 * ── B REMAINS STRUCTURALLY DISTINCT FROM C, WITHOUT INVENTING A NEW MDE
 *    MECHANISM ──────────────────────────────────────────────────────────────
 *
 * The registered protocol's Mechanistic Difference Enumeration (README §3.4)
 * names the ONLY permitted differences between Arm B and Arm C: (i) per-task
 * live selection [load-bearing], (ii) crystal state timing [non-effect], (iii)
 * the post-call citation/standing return path [lifecycle — "cannot affect the
 * in-call answer"]. That last clause is binding on this design: standing,
 * confidence and reach are NEVER rendered into either arm's prompt — showing
 * them would inject a new, unauthorized in-call signal that could explain a
 * result without appearing in the MDE. `renderInvariantBlock` is therefore
 * the ONE shared serializer both arms call — marker + functional-role tag +
 * statement, verbatim, IDENTICAL formatting — so the only possible difference
 * between a B prompt and a C prompt is WHICH items are included (the load-
 * bearing MDE difference), never HOW an item is written. `armRepresentation`
 * persists the MECHANISM that produced each arm's context
 * (`live-task-scoped-selection` vs `fixed-flattened-slice`) — the real,
 * protocol-relevant distinction — rather than a cosmetic format label that
 * would exist even if B and C received identical content.
 *
 * ── EVIDENCE-OF-USE: STRUCTURED CITATION + INDEPENDENT VERIFICATION ─────────
 *
 * Every arm's system prompt instructs: cite the bracket marker of any offered
 * statement the answer materially relies on; never cite one not offered.
 * After generation, `extractDemonstratedUse` scans the answer text for
 * marker-shaped tokens and keeps ONLY those matching a marker the arm was
 * ACTUALLY offered (`selectedInvariantIds` for B/C, empty for A) — a marker
 * shaped like `[INV-XXXXXXXX]` that does not correspond to anything offered is
 * a FABRICATED citation, counted (`citationDiagnostics`, per task/arm) and
 * excluded from `actuallyGroundedInvariantIds`. This is the "minimum
 * auditable" mechanism honestly stated: it verifies citation VALIDITY (was
 * this genuinely among what was offered — a model cannot claim credit for
 * something it was never given) but NOT citation TRUTHFULNESS in the deeper
 * sense (whether the model's answer would actually change if the cited
 * statement were removed — an ablation study, explicitly out of scope for a
 * "minimum" mechanism and left as a documented limitation, never silently
 * assumed). Arm A never has anything to cite (empty offered set — any
 * marker-shaped text in its answer is, by construction, fabricated and
 * excluded). Arm D's prose carries no markers by protocol definition — its
 * `actuallyGroundedInvariantIds` stays `null` (not measured — there is
 * nothing discrete to measure), exactly as `expP1Rehearsal.ts` already
 * established for that arm.
 *
 * ── SCORING — STILL NO REAL JUDGE, STILL HONEST ABOUT IT ─────────────────────
 *
 * No judge-config, rubric, or answer-key exists in this codebase for EXP-P1
 * (Austin's deliverable). `score` for A/B/C is `demonstratedUseRecall` — the
 * fraction of a task's ground truth the arm ACTUALLY cited, a genuine step up
 * from `expP1Rehearsal.ts`'s retrieval-only recall, but still a mechanical
 * proxy, never adjudicated correctness. Arm D's `score` remains
 * `keywordCoverageScore`, now computed against the FIXED PROSE TEXT (D never
 * changes its input; there is nothing else to score it against). A separate,
 * uniform `answerKeywordCoverage` is computed identically for ALL FOUR arms
 * against each arm's own GENERATED ANSWER TEXT — the one number that is
 * meaningfully comparable arm-for-arm, labeled explicitly as a directional,
 * non-confirmatory "did the answer engage with the task's substance" proxy,
 * never a correctness judgment.
 *
 * ── PROVIDER/MODEL HELD CONSTANT ─────────────────────────────────────────────
 *
 * ONE pinned provider/model/temperature/max-tokens for every arm and every
 * task in a run (`EXP_P1_EXECUTION_*` constants below) — causal comparability
 * requires this; a per-arm provider difference would be an unauthorized
 * confound. Mirrors `services/experiments/exp004.ts`'s
 * `SOVEREIGN_CLASS`/`SOVEREIGN_PROVIDER` pin pattern. If the pinned provider's
 * key is not configured, EVERY arm/task call fails the same honest way
 * (`executionOutcome: 'provider_unavailable'`) — never a silent fallback to a
 * different provider mid-run, which would break the pin.
 *
 * ── SCIENTIFIC BOUNDARIES, UNCHANGED ──────────────────────────────────────
 *
 * Every run this module writes is `runExecutionDesignation: 'internal-
 * rehearsal'`, `confirmatoryEligible: false`, unconditionally (enforced by
 * `recordExecutionRun` itself). Never touches Crystal vP2. Never invites
 * Austin. Nothing here migrates into a confirmatory dataset.
 *
 * Server-only.
 */

import { callChatWithUsage, providerAvailable, type ExperimentProvider } from '@/services/experiments/llm';
import { selectTaskScopedInvariants, TASK_SCOPED_SELECTOR_VERSION } from '@/services/invariants/taskScopedSelection';
import { crystalDomainForExperiment } from '@/services/research/crystalDomains';
import {
  latestFrozenCrystalArtifact,
  recordExecutionRun,
  startExecutionRun,
  checkpointExecutionRun,
  getExecutionRun,
  listExecutionRuns,
} from '@/services/research/artifacts';
import {
  REHEARSAL_ARM_LABELS,
  rehearsalEligibility,
  buildFixedArmCSlice,
  buildProvisionalArmDProse,
  keywordCoverageScore,
  idRecallScore,
  type ProvisionalTaskSet,
  type RehearsalTaskDefinition,
} from '@/services/research/expP1Rehearsal';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';
import type {
  ExecutionRunArtifact,
  RehearsalArmTaskResult,
  RehearsalExecutionOutcome,
  RehearsalTaskResult,
  ArmRepresentationKind,
} from '@/types/research';

/** Pinned provider/model — reuses `SOVEREIGN_PROVIDER`'s convention
 *  (`services/experiments/exp004.ts`), never invented per-run. Overridable
 *  only by editing this constant, never by an env var or request body — a
 *  runtime-configurable model would break "hold model/provider constant". */
export const EXP_P1_EXECUTION_PROVIDER: ExperimentProvider = 'venice';
export const EXP_P1_EXECUTION_MODEL = 'llama-3.3-70b';
export const EXP_P1_EXECUTION_TEMPERATURE = 0;
export const EXP_P1_EXECUTION_MAX_TOKENS = 700;
/** Bumped only when the PROMPT TEMPLATE (system/user construction, citation
 *  instruction wording) changes — never for a data or task-set change. */
export const EXP_P1_EXECUTION_PROMPT_VERSION = 'exp-p1-execution-prompt-v1';
/** The Arm B selector version this experimental stage is frozen against. See
 *  module header "FREEZE". */
export const FROZEN_ARM_B_SELECTOR_VERSION = 'task-scoped-v1';

function assertFrozenSelectorVersion(): string | null {
  if (TASK_SCOPED_SELECTOR_VERSION !== FROZEN_ARM_B_SELECTOR_VERSION) {
    return (
      `Arm B selector version drift: this execution rehearsal is frozen against ` +
      `'${FROZEN_ARM_B_SELECTOR_VERSION}' but taskScopedSelection.ts now reports ` +
      `'${TASK_SCOPED_SELECTOR_VERSION}' — update FROZEN_ARM_B_SELECTOR_VERSION deliberately ` +
      `before running, never silently`
    );
  }
  return null;
}

/**
 * A fourth, UNSEEN provisional set (2026-09-07) — authored for the execution
 * rehearsal, never reusing v3 (`LARGER_REHEARSAL_TASK_SET`... the 16-task
 * one is actually `UNSEEN_REHEARSAL_TASK_SET` in expP1Rehearsal.ts — its
 * selection results have already been OBSERVED and reported, so it may not
 * serve as the primary evaluation set for this new execution treatment. Every
 * keyword/phrase below is DELIBERATELY DISTINCT from every keyword used in
 * v1/v2/v3 — fresh thematic ground (regulatory authorities, financial
 * intelligence, unauthorized access, counter-terrorism financing, financial
 * institution stability, the Qripto ecosystem, free flow of information,
 * financial instruments) — verified, by a live SQL count against
 * `EXP-P1/crystal-vP2`'s actual persisted `memberSnapshot` (never eyeballed),
 * BEFORE authoring the task prompts. Real hit counts at authoring time:
 * regulatory authorities 1, financial intelligence 4, unauthorized access 1,
 * counter-terrorism financing 1, stability and soundness 1, Qripto ecosystem
 * 1, free flow of information 1, financial instruments 2, assessments and
 * monitoring 1, local regulations 1, cyber threats 1, custody services 2,
 * financial institutions 5, regulatory standards 1. Not authored by tuning
 * against, or in response to, any observed v3 outcome.
 */
export const UNSEEN_EXECUTION_REHEARSAL_TASK_SET: ProvisionalTaskSet = {
  id: 'EXP-P1/rehearsal-task-set-provisional-v4',
  provenance: 'provisional',
  tasks: [
    { id: 'rehearsal-v4-001', kind: 'recall', prompt: 'What does the governed record say about regulatory authorities?', keywords: ['regulatory authorities'] },
    { id: 'rehearsal-v4-002', kind: 'recall', prompt: 'What does the governed record say about financial intelligence?', keywords: ['financial intelligence'] },
    { id: 'rehearsal-v4-003', kind: 'recall', prompt: 'What does the governed record say about unauthorized access?', keywords: ['unauthorized access'] },
    { id: 'rehearsal-v4-004', kind: 'recall', prompt: 'What does the governed record say about counter-terrorism financing?', keywords: ['counter-terrorism financing'] },
    { id: 'rehearsal-v4-005', kind: 'recall', prompt: 'What does the governed record say about the stability and soundness of financial institutions?', keywords: ['stability and soundness'] },
    { id: 'rehearsal-v4-006', kind: 'recall', prompt: 'What does the governed record say about the Qripto ecosystem?', keywords: ['Qripto ecosystem'] },
    { id: 'rehearsal-v4-007', kind: 'recall', prompt: 'What does the governed record say about the free flow of information?', keywords: ['free flow of information'] },
    { id: 'rehearsal-v4-008', kind: 'recall', prompt: 'What does the governed record say about financial instruments?', keywords: ['financial instruments'] },
    {
      id: 'rehearsal-v4-009',
      kind: 'derivation',
      prompt: 'How does the governed record relate regulatory authorities to their assessments and monitoring of financial institutions?',
      keywords: ['regulatory authorities', 'assessments and monitoring'],
    },
    {
      id: 'rehearsal-v4-010',
      kind: 'derivation',
      prompt: 'How does the governed record relate the free flow of information to compliance with local regulations?',
      keywords: ['free flow of information', 'local regulations'],
    },
    {
      id: 'rehearsal-v4-011',
      kind: 'derivation',
      prompt: 'How does the governed record relate unauthorized access to the cyber threats it exposes client assets to?',
      keywords: ['unauthorized access', 'cyber threats'],
    },
    {
      id: 'rehearsal-v4-012',
      kind: 'derivation',
      prompt: 'How does the governed record relate counter-terrorism financing obligations to custody services?',
      keywords: ['counter-terrorism financing', 'custody services'],
    },
    {
      id: 'rehearsal-v4-013',
      kind: 'derivation',
      prompt: 'How does the governed record relate the stability and soundness of financial institutions to their risk management arrangements?',
      keywords: ['stability and soundness', 'financial institutions'],
    },
    {
      id: 'rehearsal-v4-014',
      kind: 'derivation',
      prompt: 'How does the governed record relate financial instruments in the Qripto ecosystem to regulatory compliance?',
      keywords: ['Qripto ecosystem', 'financial instruments'],
    },
    {
      id: 'rehearsal-v4-015',
      kind: 'derivation',
      prompt: 'How does the governed record relate financial intelligence operations to regulatory standards?',
      keywords: ['financial intelligence', 'regulatory standards'],
    },
    {
      id: 'rehearsal-v4-016',
      kind: 'derivation',
      prompt: 'How does the governed record relate the soundness of financial institutions to broader regulatory standards?',
      keywords: ['financial institutions', 'regulatory standards'],
    },
  ],
};

/** Stable per-invariant citation marker — deterministic from `id` alone, same
 *  convention shape as `services/experiments/exp003.ts`'s `[C-NNN]` markers. */
function markerForInvariant(id: string): string {
  return `[INV-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}]`;
}

const MARKER_PATTERN = /\[INV-[A-Z0-9]{1,8}\]/g;

/** The ONE shared per-item serializer for Arm B and Arm C — see module
 *  header "B REMAINS STRUCTURALLY DISTINCT FROM C". NEVER shows standing/
 *  confidence/reach (lifecycle-only per the MDE); DOES show the functional-
 *  role/type tag, since preserving typed decomposition is Arm C's own
 *  protocol definition, not a runtime-only signal. */
function renderInvariantBlock(items: { id: string; statement: string; functionalRole: string | null }[]): string {
  if (items.length === 0) return '';
  const lines = items.map((it) => `${markerForInvariant(it.id)} (${it.functionalRole ?? 'untyped'}) ${it.statement}`);
  return [
    'GOVERNING STATEMENTS — cite the bracket tag of any you materially rely on; never cite one not listed here:',
    ...lines,
  ].join('\n');
}

const SYSTEM_PROMPT =
  'You are a policy analyst. Answer the task using ONLY the governing material provided below, if any. ' +
  'If governing statements are listed, cite the bracket tag of every one you materially rely on, inline in ' +
  'your answer (e.g. [INV-AB12CD34]). Never cite a bracket tag that was not given to you, and never invent ' +
  'one. If no governing material is provided, answer from your own general reasoning and cite nothing. Be ' +
  'concise and direct.';

/** Independent verification step — see module header "EVIDENCE-OF-USE". A
 *  marker in the answer text counts ONLY if it matches something the arm was
 *  ACTUALLY offered; anything else is a fabricated citation, reported but
 *  never credited. */
function extractDemonstratedUse(
  answerText: string,
  offeredItems: { id: string }[],
): { actuallyGroundedInvariantIds: string[]; fabricatedCitationCount: number } {
  const offeredByMarker = new Map(offeredItems.map((it) => [markerForInvariant(it.id), it.id]));
  const foundMarkers = answerText.match(MARKER_PATTERN) ?? [];
  const grounded = new Set<string>();
  let fabricated = 0;
  for (const marker of foundMarkers) {
    const id = offeredByMarker.get(marker);
    if (id) grounded.add(id);
    else fabricated += 1;
  }
  return { actuallyGroundedInvariantIds: [...grounded], fabricatedCitationCount: fabricated };
}

interface ArmCallInput {
  armId: 'A' | 'B' | 'C' | 'D';
  armLabel: string;
  task: RehearsalTaskDefinition;
  contextBlock: string | null;
  offeredIds: string[];
  offeredItems: { id: string }[];
  armRepresentation: ArmRepresentationKind;
  availableInvariantIds: string[];
  selectedInvariantIds: string[];
  groundTruthInvariantIds: string[];
  /** D has no discrete offered set — its "usage" concept doesn't apply;
   *  `actuallyGroundedInvariantIds` stays `null`, never `[]`. */
  measuresUse: boolean;
}

async function executeArm(input: ArmCallInput): Promise<RehearsalArmTaskResult> {
  const user = input.contextBlock
    ? `TASK: ${input.task.prompt}\n\n${input.contextBlock}`
    : `TASK: ${input.task.prompt}`;

  const base: Omit<RehearsalArmTaskResult, 'generatedAnswerText' | 'promptTokens' | 'completionTokens' | 'actuallyGroundedInvariantIds' | 'demonstratedUseRecall' | 'answerKeywordCoverage' | 'executionOutcome' | 'score' | 'scoreMetric'> = {
    armId: input.armId,
    armLabel: input.armLabel,
    availableInvariantIds: input.availableInvariantIds,
    selectedInvariantIds: input.selectedInvariantIds,
    armRepresentation: input.armRepresentation,
  };

  if (!providerAvailable(EXP_P1_EXECUTION_PROVIDER)) {
    return {
      ...base,
      generatedAnswerText: null,
      promptTokens: null,
      completionTokens: null,
      actuallyGroundedInvariantIds: input.measuresUse ? [] : null,
      demonstratedUseRecall: input.measuresUse ? 0 : null,
      answerKeywordCoverage: null,
      executionOutcome: 'provider_unavailable',
      scoreMetric: input.measuresUse ? 'demonstrated-use-recall' : 'keyword-substring-coverage',
      score: 0,
    };
  }

  let outcome: RehearsalExecutionOutcome = 'completed';
  let text = '';
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  try {
    const result = await callChatWithUsage(
      EXP_P1_EXECUTION_PROVIDER,
      SYSTEM_PROMPT,
      user,
      EXP_P1_EXECUTION_MAX_TOKENS,
      EXP_P1_EXECUTION_MODEL,
      EXP_P1_EXECUTION_TEMPERATURE,
    );
    text = result.text;
    promptTokens = result.inputTokens;
    completionTokens = result.outputTokens;
    if (!text.trim()) outcome = 'empty_completion';
  } catch (err) {
    outcome = /timed out/i.test(err instanceof Error ? err.message : '') ? 'timed_out' : 'error';
  }

  if (outcome !== 'completed') {
    return {
      ...base,
      generatedAnswerText: null,
      promptTokens,
      completionTokens,
      actuallyGroundedInvariantIds: input.measuresUse ? [] : null,
      demonstratedUseRecall: input.measuresUse ? 0 : null,
      answerKeywordCoverage: null,
      executionOutcome: outcome,
      scoreMetric: input.measuresUse ? 'demonstrated-use-recall' : 'keyword-substring-coverage',
      score: 0,
    };
  }

  const answerKeywordCoverage = keywordCoverageScore(text, input.task.keywords);

  if (!input.measuresUse) {
    // Arm D — no discrete offered set; score is keyword coverage of the
    // GENERATED ANSWER (not the fixed prose input, which never varies).
    return {
      ...base,
      generatedAnswerText: text,
      promptTokens,
      completionTokens,
      actuallyGroundedInvariantIds: null,
      demonstratedUseRecall: null,
      answerKeywordCoverage,
      executionOutcome: 'completed',
      scoreMetric: 'keyword-substring-coverage',
      score: answerKeywordCoverage,
    };
  }

  const { actuallyGroundedInvariantIds } = extractDemonstratedUse(text, input.offeredItems);
  const demonstratedUseRecall = idRecallScore(actuallyGroundedInvariantIds, input.groundTruthInvariantIds);

  return {
    ...base,
    generatedAnswerText: text,
    promptTokens,
    completionTokens,
    actuallyGroundedInvariantIds,
    demonstratedUseRecall,
    answerKeywordCoverage,
    executionOutcome: 'completed',
    scoreMetric: 'demonstrated-use-recall',
    score: demonstratedUseRecall,
  };
}

export interface RunExecutionRehearsalResult {
  ok: boolean;
  error?: string;
  receiptId?: string | null;
  runId?: string;
  taskResults?: RehearsalTaskResult[];
  run?: ExecutionRunArtifact;
}

/** Per-run STATIC context — everything deterministic from the frozen crystal
 *  and pinned config, none of it dependent on which tasks have executed yet.
 *  Computed once by `startExpP1ExecutionRehearsal` and RE-derived (cheaply,
 *  no model calls, the crystal is frozen and immutable) by every
 *  `stepExpP1ExecutionRehearsal` call — so no extra fields need to be
 *  persisted on the run record just to survive between requests. */
interface StaticExecutionContext {
  eligibilityFrozenCrystalArtifactId: string;
  eligibilityFrozenCrystalContentHash: string | null;
  members: HashCoveredMember[];
  memberIds: Set<string>;
  domain: string | undefined;
  armCAvailableIds: string[];
  armCSelectedIds: string[];
  armCOfferedItems: { id: string; statement: string; functionalRole: string | null }[];
  armCContextBlock: string;
  armDContextBlock: string;
  executionConfiguration: Record<string, unknown>;
}

async function buildStaticExecutionContext(
  experimentId: string,
): Promise<{ ok: true; context: StaticExecutionContext } | { ok: false; error: string }> {
  const eligibility = await rehearsalEligibility(experimentId);
  if (!eligibility.eligible || !eligibility.frozenCrystalArtifactId) {
    return { ok: false, error: eligibility.reason ?? 'internal rehearsal is not eligible right now' };
  }
  const frozen = await latestFrozenCrystalArtifact(experimentId);
  const members: HashCoveredMember[] = frozen?.memberSnapshot ?? [];
  if (members.length === 0) {
    return { ok: false, error: `'${eligibility.frozenCrystalArtifactId}' has no persisted memberSnapshot` };
  }
  const memberIds = new Set(members.map((m) => m.id));
  const domain = crystalDomainForExperiment(experimentId)?.domain;

  const armCAvailableIds = members.map((m) => m.id);
  const armCSlice = buildFixedArmCSlice(members);
  const armCSelectedIds = armCSlice.map((m) => m.id);
  const armCOfferedItems = armCSlice.map((m) => ({ id: m.id, statement: m.statement, functionalRole: m.semanticType }));
  const armCContextBlock = renderInvariantBlock(armCOfferedItems);

  const armDProse = buildProvisionalArmDProse(members);
  const armDContextBlock = `EXPERT BACKGROUND (continuous prose, provisional, no citation markers):\n${armDProse}`;

  const executionConfiguration = {
    provider: EXP_P1_EXECUTION_PROVIDER,
    model: EXP_P1_EXECUTION_MODEL,
    temperature: EXP_P1_EXECUTION_TEMPERATURE,
    maxTokens: EXP_P1_EXECUTION_MAX_TOKENS,
    promptVersion: EXP_P1_EXECUTION_PROMPT_VERSION,
    frozenArmBSelectorVersion: FROZEN_ARM_B_SELECTOR_VERSION,
    assertedSelectorVersionAtRunTime: TASK_SCOPED_SELECTOR_VERSION,
  };

  return {
    ok: true,
    context: {
      eligibilityFrozenCrystalArtifactId: eligibility.frozenCrystalArtifactId,
      eligibilityFrozenCrystalContentHash: eligibility.frozenCrystalContentHash,
      members,
      memberIds,
      domain,
      armCAvailableIds,
      armCSelectedIds,
      armCOfferedItems,
      armCContextBlock,
      armDContextBlock,
      executionConfiguration,
    },
  };
}

/** Execute ONE task's four arms concurrently (bounded — never more than 4
 *  model calls at a time per task) and return its complete `RehearsalTaskResult`
 *  plus any fabricated-citation diagnostics observed. This is the ONE unit of
 *  work `stepExpP1ExecutionRehearsal` batches — a task is only ever persisted
 *  once ALL FOUR of its arms have a result, so a resumed run can never end up
 *  with a partially-armed task. */
async function executeOneTask(
  task: RehearsalTaskDefinition,
  ctx: StaticExecutionContext,
): Promise<{ taskResult: RehearsalTaskResult; citationDiagnostics: { taskId: string; armId: string; fabricatedCitationCount: number }[] }> {
  const groundTruthInvariantIds = ctx.members
    .filter((m) => task.keywords.some((k) => m.statement.toLowerCase().includes(k.toLowerCase())))
    .map((m) => m.id);
  const scorable = groundTruthInvariantIds.length > 0;
  const unscorableReason = scorable
    ? null
    : `no frozen invariant statement in '${ctx.eligibilityFrozenCrystalArtifactId}' matched this task's keyword set (${task.keywords.join(', ')}) — nothing to score recall against; raw per-arm scores below are diagnostics only`;

  const armBSelection = await selectTaskScopedInvariants({
    intentText: task.prompt,
    domains: ctx.domain ? [ctx.domain] : undefined,
    restrictToIds: [...ctx.memberIds],
  });
  const armBOfferedItems = armBSelection.items.map((it) => ({ id: it.id, statement: it.statement, functionalRole: it.functionalRole }));
  const armBContextBlock = renderInvariantBlock(armBOfferedItems);

  const [armA, armB, armC, armD] = await Promise.all([
    executeArm({
      armId: 'A',
      armLabel: REHEARSAL_ARM_LABELS.A,
      task,
      contextBlock: null,
      offeredIds: [],
      offeredItems: [],
      armRepresentation: 'none',
      availableInvariantIds: [],
      selectedInvariantIds: [],
      groundTruthInvariantIds,
      measuresUse: true,
    }),
    executeArm({
      armId: 'B',
      armLabel: REHEARSAL_ARM_LABELS.B,
      task,
      contextBlock: armBContextBlock,
      offeredIds: armBSelection.selectedIds,
      offeredItems: armBOfferedItems,
      armRepresentation: 'live-task-scoped-selection',
      availableInvariantIds: armBSelection.availableIds,
      selectedInvariantIds: armBSelection.selectedIds,
      groundTruthInvariantIds,
      measuresUse: true,
    }),
    executeArm({
      armId: 'C',
      armLabel: REHEARSAL_ARM_LABELS.C,
      task,
      contextBlock: ctx.armCContextBlock,
      offeredIds: ctx.armCSelectedIds,
      offeredItems: ctx.armCOfferedItems,
      armRepresentation: 'fixed-flattened-slice',
      availableInvariantIds: ctx.armCAvailableIds,
      selectedInvariantIds: ctx.armCSelectedIds,
      groundTruthInvariantIds,
      measuresUse: true,
    }),
    executeArm({
      armId: 'D',
      armLabel: REHEARSAL_ARM_LABELS.D,
      task,
      contextBlock: ctx.armDContextBlock,
      offeredIds: [],
      offeredItems: [],
      armRepresentation: 'expert-prose',
      availableInvariantIds: [],
      selectedInvariantIds: [],
      groundTruthInvariantIds,
      measuresUse: false,
    }),
  ]);

  const citationDiagnostics: { taskId: string; armId: string; fabricatedCitationCount: number }[] = [];
  for (const arm of [armA, armB, armC, armD]) {
    if (arm.generatedAnswerText) {
      const { fabricatedCitationCount } = extractDemonstratedUse(
        arm.generatedAnswerText,
        arm.armId === 'B' ? armBOfferedItems : arm.armId === 'C' ? ctx.armCOfferedItems : [],
      );
      if (fabricatedCitationCount > 0) {
        citationDiagnostics.push({ taskId: task.id, armId: arm.armId, fabricatedCitationCount });
      }
    }
  }

  return {
    taskResult: { taskId: task.id, taskKind: task.kind, groundTruthInvariantIds, scorable, unscorableReason, armResults: [armA, armB, armC, armD] },
    citationDiagnostics,
  };
}

function buildArmConfiguration(ctx: StaticExecutionContext): Record<string, unknown> {
  return {
    armA: { description: 'Cold — no grounding material by protocol definition' },
    armB: {
      domain: ctx.domain ?? null,
      selectorVersion: FROZEN_ARM_B_SELECTOR_VERSION,
      selectionProcedure:
        'selectTaskScopedInvariants (services/invariants/taskScopedSelection.ts), FROZEN at ' +
        FROZEN_ARM_B_SELECTOR_VERSION +
        ' — per-task live selection, rendered via the SAME shared serializer Arm C uses (marker + type + ' +
        'statement, never standing/confidence).',
      // Per-task diagnostics (available/selected set sizes, relevance-fallback
      // flags) are NOT aggregated here in the checkpointed execution model —
      // they are inspectable per task from each task's own persisted Arm B
      // result once the run completes, rather than accumulated redundantly
      // across steps (2026-09-08 durability fix; a deliberate simplification,
      // not an omission).
    },
    armC: {
      sliceFraction: ctx.armCSelectedIds.length / Math.max(ctx.members.length, 1),
      fixedSliceSize: ctx.armCSelectedIds.length,
      frozenPopulationSize: ctx.members.length,
    },
    armD: { proseSampleSize: 5, provenance: 'provisional-irl-authored' },
  };
}

const SCORING_CONFIGURATION: Record<string, unknown> = {
  'demonstrated-use-recall':
    'idRecallScore(actuallyGroundedInvariantIds, groundTruthInvariantIds) — the fraction of ground truth ' +
    'the arm DEMONSTRABLY cited in its own generated answer (marker-verified against what it was actually ' +
    'offered; a fabricated citation to something not offered is excluded and counted separately). Applies ' +
    'to A/B/C.',
  'keyword-substring-coverage':
    'keyword substring hits / task.keywords.length against Arm D\'s GENERATED ANSWER text — a text-coverage ' +
    'metric, NOT id-based, not comparable arm-for-arm with demonstrated-use-recall.',
  answerKeywordCoverage:
    'keyword substring coverage of each arm\'s OWN generated answer text against task.keywords — computed ' +
    'IDENTICALLY for all four arms (unlike score), the one number meaningfully comparable arm-for-arm; still ' +
    'mechanical, never a correctness judgment.',
  unscorableRule:
    'a task with an empty groundTruthInvariantIds set (no frozen invariant matched its keywords) is ' +
    'scorable:false and excluded from every aggregate; its raw per-arm scores are retained for diagnostics only',
  executionOutcomeRule:
    'a per-arm call that did not complete (provider_unavailable/timed_out/empty_completion/error) scores 0 ' +
    'but is VISIBLY flagged via executionOutcome — never silently indistinguishable from a real, low-scoring ' +
    'completed answer.',
  evidenceOfUseMethod:
    'structured self-citation (bracket marker inline in the generated answer) + independent verification ' +
    'that the cited marker corresponds to something the arm was ACTUALLY offered (never inferred from mere ' +
    'context presence). This verifies citation VALIDITY, not deeper citation TRUTHFULNESS (no ablation study ' +
    'is performed) — a documented limitation, not a silent assumption.',
};

function validateTaskSet(taskSet: ProvisionalTaskSet): string | null {
  if (taskSet.provenance === 'external-held-out') {
    return `an internal rehearsal may never load an 'external-held-out' task set — that provenance describes materials this codebase cannot construct`;
  }
  if (taskSet.tasks.length === 0) return `task set '${taskSet.id}' has no tasks`;
  return null;
}

export interface StartExecutionRehearsalResult {
  ok: boolean;
  error?: string;
  runId?: string;
  taskSetId?: string;
  totalTasks?: number;
  /** True when an already-`'executing'` run for this exact task set was
   *  found and reused instead of creating a new one — see the resume-in-
   *  place note below. Absent/false for a genuinely new run. */
  resumed?: boolean;
  /** Tasks already checkpointed on a RESUMED run — always 0 for a new one.
   *  Lets the caller show accurate progress immediately, before the first
   *  step() response arrives. */
  doneCount?: number;
}

/**
 * PHASE 1 — create the durable run identity, OR resume one already in
 * flight. Fast: reads the frozen crystal and asserts the selector-version
 * freeze, but calls NO model — safe to complete well within any gateway's
 * response envelope. Returns immediately with a `runId` the caller then
 * advances via `stepExpP1ExecutionRehearsal`.
 *
 * Resume-in-place (2026-09-08): before creating anything, this checks for an
 * existing `'executing'` run against the SAME task set. If the operator left
 * the page mid-run (browser closed, tab navigated away, an earlier step
 * errored out) and clicks the button again, this reuses that run's id rather
 * than starting a second, independent run that would re-execute tasks the
 * first run already completed. A run that has already reached `'executed'`
 * is NOT resumable (there is nothing left to resume) — a further call
 * genuinely starts a fresh run, which is the correct "run it again" behavior.
 */
export async function startExpP1ExecutionRehearsal(input: {
  personaId: string;
  experimentId: string;
  taskSet?: ProvisionalTaskSet;
}): Promise<StartExecutionRehearsalResult> {
  const versionError = assertFrozenSelectorVersion();
  if (versionError) return { ok: false, error: versionError };

  const taskSet = input.taskSet ?? UNSEEN_EXECUTION_REHEARSAL_TASK_SET;
  const taskSetError = validateTaskSet(taskSet);
  if (taskSetError) return { ok: false, error: taskSetError };

  const existingRuns = await listExecutionRuns(input.experimentId);
  const inProgress = existingRuns.find(
    (r) => r.runExecutionDesignation === 'internal-rehearsal' && r.lifecycle === 'executing' && r.taskSetId === taskSet.id,
  );
  if (inProgress) {
    return {
      ok: true,
      runId: inProgress.id,
      taskSetId: taskSet.id,
      totalTasks: inProgress.expectedTaskIds?.length ?? taskSet.tasks.length,
      resumed: true,
      doneCount: inProgress.taskResults.length,
    };
  }

  const built = await buildStaticExecutionContext(input.experimentId);
  if (!built.ok) return { ok: false, error: built.error };
  const ctx = built.context;

  const started = await startExecutionRun({
    personaId: input.personaId,
    experimentId: input.experimentId,
    runExecutionDesignation: 'internal-rehearsal',
    frozenCrystalArtifactId: ctx.eligibilityFrozenCrystalArtifactId,
    frozenCrystalContentHash: ctx.eligibilityFrozenCrystalContentHash,
    taskSetId: taskSet.id,
    taskSetProvenance: taskSet.provenance,
    armIds: ['A', 'B', 'C', 'D'],
    providerModel: `${EXP_P1_EXECUTION_PROVIDER}:${EXP_P1_EXECUTION_MODEL}`,
    confirmatoryEligible: false,
    armDProvenance: 'provisional-irl-authored',
    executionConfiguration: ctx.executionConfiguration,
    armConfiguration: buildArmConfiguration(ctx),
    scoringConfiguration: SCORING_CONFIGURATION,
    expectedTaskIds: taskSet.tasks.map((t) => t.id),
  });
  if (!started.ok) return { ok: false, error: started.error };
  return { ok: true, runId: started.runId, taskSetId: taskSet.id, totalTasks: taskSet.tasks.length };
}

/** Bounded default — `batchSize` tasks × 4 arms concurrent model calls per
 *  step (e.g. 3×4=12), comfortably under the ~30s gateway ceiling documented
 *  in `services/experiments/llm.ts` — never the 16×4=64 unbounded fan-out
 *  that caused the 2026-09-08 execution-apparatus incident. */
export const DEFAULT_STEP_BATCH_SIZE = 3;

export interface StepExecutionRehearsalResult {
  ok: boolean;
  error?: string;
  status?: 'executing' | 'executed';
  doneCount?: number;
  totalCount?: number;
  run?: ExecutionRunArtifact;
}

/**
 * PHASE 2 — advance an existing run by executing up to `batchSize` PENDING
 * tasks (never a task already present in the run's persisted `taskResults`
 * — idempotent by construction) and checkpointing the result. Safe to call
 * repeatedly (polling) until `status === 'executed'`; safe to call again
 * after a client-side timeout/disconnect — nothing is ever re-executed or
 * re-scored, and nothing is lost.
 */
export async function stepExpP1ExecutionRehearsal(input: {
  personaId: string;
  runId: string;
  taskSet: ProvisionalTaskSet;
  batchSize?: number;
}): Promise<StepExecutionRehearsalResult> {
  const existing = await getExecutionRun(input.runId);
  if (!existing) return { ok: false, error: `no execution-run '${input.runId}' found` };
  if (existing.lifecycle === 'executed') {
    return { ok: true, status: 'executed', doneCount: existing.taskResults.length, totalCount: existing.expectedTaskIds?.length ?? existing.taskResults.length, run: existing };
  }
  if (existing.lifecycle !== 'executing') {
    return { ok: false, error: `execution-run '${input.runId}' is in unexpected lifecycle '${existing.lifecycle}'` };
  }

  const doneIds = new Set(existing.taskResults.map((t) => t.taskId));
  const pendingTasks = input.taskSet.tasks.filter((t) => !doneIds.has(t.id));
  const totalCount = existing.expectedTaskIds?.length ?? input.taskSet.tasks.length;

  if (pendingTasks.length === 0) {
    // Nothing left to execute — finalize (idempotent no-op if already executed).
    const checkpointed = await checkpointExecutionRun({ personaId: input.personaId, runId: input.runId, newTaskResults: [] });
    if (!checkpointed.ok) return { ok: false, error: checkpointed.error };
    return {
      ok: true,
      status: checkpointed.completed ? 'executed' : 'executing',
      doneCount: checkpointed.artifact?.taskResults.length ?? 0,
      totalCount,
      run: checkpointed.artifact,
    };
  }

  const built = await buildStaticExecutionContext(existing.experimentId);
  if (!built.ok) return { ok: false, error: built.error };
  const ctx = built.context;

  const batchSize = input.batchSize ?? DEFAULT_STEP_BATCH_SIZE;
  const batch = pendingTasks.slice(0, batchSize);
  const executed = await Promise.all(batch.map((task) => executeOneTask(task, ctx)));
  const newTaskResults = executed.map((e) => e.taskResult);

  const checkpointed = await checkpointExecutionRun({ personaId: input.personaId, runId: input.runId, newTaskResults });
  if (!checkpointed.ok) return { ok: false, error: checkpointed.error };
  return {
    ok: true,
    status: checkpointed.completed ? 'executed' : 'executing',
    doneCount: checkpointed.artifact?.taskResults.length ?? 0,
    totalCount,
    run: checkpointed.artifact,
  };
}

/**
 * TEST/LOCAL CONVENIENCE ONLY — starts a run and steps it to completion in
 * one call, in a single batch covering every task at once. The PRODUCTION
 * route NEVER calls this: it uses `startExpP1ExecutionRehearsal` then
 * repeated, small-batch `stepExpP1ExecutionRehearsal` calls, exactly so no
 * single HTTP request ever needs to survive for the whole run (see this
 * module's header — the 2026-09-08 execution-apparatus incident this
 * function's old one-shot design caused).
 */
export async function runExpP1ExecutionRehearsal(input: {
  personaId: string;
  experimentId: string;
  taskSet?: ProvisionalTaskSet;
}): Promise<RunExecutionRehearsalResult> {
  const started = await startExpP1ExecutionRehearsal(input);
  if (!started.ok || !started.runId) return { ok: false, error: started.error };

  const taskSet = input.taskSet ?? UNSEEN_EXECUTION_REHEARSAL_TASK_SET;
  let status: 'executing' | 'executed' = 'executing';
  let run: ExecutionRunArtifact | undefined;
  while (status === 'executing') {
    const stepped = await stepExpP1ExecutionRehearsal({
      personaId: input.personaId,
      runId: started.runId,
      taskSet,
      batchSize: taskSet.tasks.length,
    });
    if (!stepped.ok || !stepped.status) return { ok: false, error: stepped.error };
    status = stepped.status;
    run = stepped.run;
  }
  return { ok: true, receiptId: run?.receiptId ?? null, runId: run?.id, taskResults: run?.taskResults, run };
}
