/**
 * Stage Orchestrator — Operation Chrysalis Phase 1A (ICE engine)
 *
 * Makes the dev loop stages real: the aigent-z copilot produces structured
 * stage artifacts (intent, context pack, gap report, consequence canvas,
 * implementation brief, validation report) as fenced ```stage_data JSON
 * blocks in its replies. The chat route extracts them server-side and
 * returns them as `stage_proposals`; the Dev Command Center renders each
 * as a pending approval card inside the matching capability capsule
 * (mirroring aigentMe's artifact-pill approval pattern). Only on operator
 * Approve does the artifact commit to DevLoopState and the stage advance.
 *
 * Isomorphic module: no fs, no DB — safe for both the chat route (prompt
 * building + extraction) and the client tab (apply on approve).
 */

import type {
  DevLoopState,
  DevLoopStage,
  StructuredDevIntent,
  ContextPackItem,
  ContextSourceKind,
  ConsequenceEntry,
  ConsequenceValidationItem,
  RemediationEntry,
  RemediationPlan,
  DeploymentAuthorization,
} from '@/types/devCommandCenter';
import { createEmptyIntent, refineIntent } from './intentDistillation';
import { createEmptyContextPack, addContextItem, estimateTokens } from './contextPackGenerator';
import { createEmptyGapAnalysis, addExistingCapability, addMissingCapability } from './capabilityGapAnalyzer';
import { createEmptyCanvas, createConsequenceEntry, addShouldHappen, addShouldNeverHappen } from './consequenceCanvas';
import { createEmptyValidationReport, addValidationItem } from './consequenceValidator';

// ─── Proposal contract ──────────────────────────────────────────────────────

export type StageProposalKind =
  | 'intent'
  | 'context_pack'
  | 'gap_analysis'
  | 'consequence_canvas'
  | 'implementation_brief'
  | 'validation_report'
  | 'remediation_plan'
  | 'deployment_authorization';

export interface StageProposal {
  kind: StageProposalKind;
  /** One-line label for the approval card header. */
  summary: string;
  /** Stage-specific payload — validated and coerced on apply. */
  data: Record<string, unknown>;
}

const PROPOSAL_KINDS = new Set<string>([
  'intent',
  'context_pack',
  'gap_analysis',
  'consequence_canvas',
  'implementation_brief',
  'validation_report',
  'remediation_plan',
  'deployment_authorization',
]);

/** Which proposal kind each stage produces. */
export const STAGE_PROPOSAL_KIND: Record<DevLoopStage, StageProposalKind | null> = {
  intent_capture: 'intent',
  context_assembly: 'context_pack',
  gap_analysis: 'gap_analysis',
  consequence_modeling: 'consequence_canvas',
  implementation: 'implementation_brief',
  consequence_validation: 'validation_report',
  remediation: 'remediation_plan',
  deployment_authorization: 'deployment_authorization',
  complete: null,
};

/** Which capability capsule a proposal kind lands in (right-pane chip ids). */
export const PROPOSAL_KIND_TO_CAPSULE: Record<StageProposalKind, string> = {
  intent: 'intent',
  context_pack: 'context',
  gap_analysis: 'gap-analysis',
  consequence_canvas: 'consequence-canvas',
  implementation_brief: 'implementation',
  validation_report: 'validation',
  remediation_plan: 'remediation',
  deployment_authorization: 'deployment-authorization',
};

/**
 * Which capability capsule a dev-loop STAGE renders in — derived from the two
 * canary-pinned maps above, never a third routing table. This is the
 * advance→next-capsule mapping the approval flow-through uses (operator
 * finding 3, 2026-07-06): on Approve, the loop advances and the right pane
 * auto-opens the NEW session stage's capsule so it flows with the loop.
 */
export function stageCapsuleId(stage: DevLoopStage): string | null {
  const kind = STAGE_PROPOSAL_KIND[stage];
  return kind ? PROPOSAL_KIND_TO_CAPSULE[kind] : null;
}

// ─── Operator stage-request detection ───────────────────────────────────────

/**
 * Ordered, conservative patterns: the FIRST match wins, so validation
 * outranks everything ("validate the implementation" is a validation
 * request) and gap analysis outranks implementation ("the gaps in the
 * implementation" is a gap request — the 2026-07-06 regression: bare
 * `implement`/`implementation` ranked above `gaps` hijacked gap-analysis
 * requests to the implementation stage, so the Gaps card never received a
 * proposal). Implementation matches only phrase-level signals. Anything
 * ambiguous returns null and the viewed-capsule / session stage decides.
 */
const STAGE_REQUEST_PATTERNS: Array<{ stage: DevLoopStage; re: RegExp }> = [
  // Remediation outranks validation so "remediate the validation failures"
  // routes to the Remediation stage rather than re-running validation.
  { stage: 'remediation', re: /\bremediat|\bremed(y|ies)\b/i },
  { stage: 'deployment_authorization', re: /\bdeploy(ment)?\b|\bauthoriz(e|ation) (the )?deploy|\bconstitutional threshold\b/i },
  { stage: 'consequence_validation', re: /\bvalidat/i },
  { stage: 'gap_analysis', re: /\b(capability )?gaps?\b/i },
  { stage: 'consequence_modeling', re: /\bconsequence/i },
  {
    stage: 'implementation',
    re: /\bimplementation (brief|pack|plan|stage|phase)\b|\bstart (the )?(implementation|development|dev work|building)\b|\bbegin (the )?implementation\b|\bdevelopment phase\b|\bwrite the code\b/i,
  },
  { stage: 'context_assembly', re: /\bcontext pack\b|\bassemble (the )?context\b/i },
  { stage: 'intent_capture', re: /\bnew (development )?intent\b/i },
];

/**
 * Detect which dev-loop stage the operator's message is asking for.
 * Fixes the capsule-override trap: a "validate the build" request typed
 * while the Consequence Canvas capsule is open must produce a
 * validation_report proposal (which then routes to — and auto-opens — the
 * Validation capsule), not another consequence_canvas.
 *
 * A detected stage is a HINT, never a suppressor: the chat route passes it
 * as the primary stage and the capsule/session stage as the alternate, and
 * buildStageInstructionBlock presents BOTH schemas so a misfired pattern
 * can't stop the LLM from emitting the stage the operator actually meant.
 */
export function detectRequestedStage(message: string): DevLoopStage | null {
  if (!message || typeof message !== 'string') return null;
  for (const { stage, re } of STAGE_REQUEST_PATTERNS) {
    if (re.test(message)) return stage;
  }
  return null;
}

// ─── Stage instruction blocks (server-side prompt addendum) ─────────────────

const SCHEMAS: Record<StageProposalKind, string> = {
  intent: `{
  "kind": "intent",
  "summary": "<one-line label>",
  "data": {
    "rawInput": "<the user's original request, verbatim>",
    "goal": "<single sentence project goal>",
    "users": ["<primary user group>", ...],
    "desiredOutcomes": ["<outcome>", ...],
    "successCriteria": ["<measurable criterion>", ...],
    "constraints": ["<constraint incl. sovereignty requirements>", ...],
    "relatedCartridges": ["<existing cartridge slug>", ...],
    "relatedVentures": ["<venture name>", ...],
    "priority": "critical|high|medium|low"
  }
}`,
  context_pack: `{
  "kind": "context_pack",
  "summary": "<one-line label>",
  "data": {
    "items": [{
      "sourceKind": "prd|architecture|update|cartridge|governance|registry_asset|prior_decision|receipt|codebase|claude_md",
      "sourcePath": "<repo path or registry asset id — ONLY paths/assets you saw in your ground truth, never invented>",
      "title": "<short title>",
      "relevanceScore": <0..1>,
      "excerpt": "<why this matters for the intent, 1-3 sentences>",
      "reuseSignal": "reuse|extend|reference"
    }, ...]
  }
}`,
  gap_analysis: `{
  "kind": "gap_analysis",
  "summary": "<one-line label>",
  "data": {
    "existing": [{
      "name": "<capability>",
      "location": "<repo path or registry asset id from ground truth>",
      "description": "<what it does>",
      "reuseStrategy": "use_directly|extend|wrap|adapt",
      "confidence": <0..1>
    }, ...],
    "missing": [{
      "name": "<capability>",
      "description": "<what must be built>",
      "estimatedComplexity": "trivial|small|medium|large",
      "dependencies": ["<dependency>", ...],
      "suggestedLocation": "<repo path where it should live>"
    }, ...]
  }
}`,
  consequence_canvas: `{
  "kind": "consequence_canvas",
  "summary": "<one-line label>",
  "data": {
    "shouldHappen": [{ "description": "<expected consequence>", "category": "workflow|data|governance|permission|integration|user_experience", "severity": "critical|high|medium|low" }, ...],
    "shouldNeverHappen": [{ "description": "<forbidden consequence>", "category": "...", "severity": "..." }, ...],
    "workflowsActivated": ["<workflow>", ...],
    "systemsAffected": ["<system>", ...],
    "permissionsRequired": ["<permission>", ...],
    "successState": "<one-paragraph description of the completed state>"
  }
}`,
  implementation_brief: `{
  "kind": "implementation_brief",
  "summary": "<one-line label>",
  "data": {
    "brief": "<full markdown: ## PRD, ## Architecture Plan, ## Task List (with repository targets per task), ## Claude Code Instructions>"
  }
}`,
  validation_report: `{
  "kind": "validation_report",
  "summary": "<one-line label>",
  "data": {
    "items": [{
      "consequenceId": "<id from the canvas, or empty>",
      "description": "<consequence being checked>",
      "verdict": "satisfied|unresolved|unintended|partial",
      "evidence": "<what shows this verdict>",
      "severity": "critical|high|medium|low"
    }, ...],
    "workflowImpacts": ["<impact>", ...],
    "governanceImpacts": ["<impact>", ...],
    "testingRequirements": ["<requirement>", ...]
  }
}`,
  remediation_plan: `{
  "kind": "remediation_plan",
  "summary": "<one-line label>",
  "data": {
    "remedies": [{
      "consequenceId": "<id of the failed/partial consequence from the validation report>",
      "description": "<the consequence that failed or partially failed>",
      "remedy": "<the concrete fix that resolves it>",
      "learningNote": "<the lesson captured from this failure — the feedback-loop-for-learning>"
    }, ...],
    "residualRisk": "<honest statement of any risk that remains after these remedies>",
    "revalidationRequired": true
  }
}`,
  deployment_authorization: `{
  "kind": "deployment_authorization",
  "summary": "<one-line label>",
  "data": {
    "authorized": true,
    "constitutionalThresholdMet": true,
    "rationale": "<why deployment is (or is not) authorized — cite the consequence test outcome>",
    "blockingConsequences": ["<consequence id still blocking deployment>", ...]
  }
}`,
};

const STAGE_BEHAVIOR: Record<DevLoopStage, string> = {
  intent_capture:
    'Distill the operator\'s request into structured intent. Ask at most ONE round of clarifying questions if the goal, users, or success criteria are genuinely unknowable from the conversation — otherwise produce the proposal immediately. Sovereignty requirements belong in constraints.',
  context_assembly:
    'Assemble the context pack from your Platform Knowledge ground truth: relevant cartridges/tabs (data/codex-configs.ts), API routes, services, registry assets, iQube schemas, pack docs, and CLAUDE.md rules. Every sourcePath MUST come from your ground truth — never invent a path. Classify each item reuse/extend/reference.',
  gap_analysis:
    'Compare the intent\'s capability requirements against the context pack and registry assets. THE GOLDEN RULE: never Create when Extend is possible; never Extend when Reuse is possible. Every "missing" entry must state why no existing capability covers it.',
  consequence_modeling:
    'Model the consequences of implementing this intent. shouldNeverHappen MUST include duplicate-capability creation, sovereignty violations, policy/governance violations, and registry conflicts when relevant. Define a concrete successState.',
  implementation:
    'Produce the implementation brief: a PRD, an architecture plan honoring the gap analysis (reuse > extend > create), a task list with repository targets, and a Claude Code instruction package. Cite the consequence guardrails as hard constraints.',
  consequence_validation:
    'Run the CONSTITUTIONAL CONSEQUENCE TEST: validate the implementation against the consequence canvas — each shouldHappen/shouldNeverHappen entry gets a verdict with evidence. Also check the original intent\'s success criteria and governance constraints. Surface unintended consequences explicitly. This is the constitutional gate: a high/critical must-not-happen consequence that comes back unintended or partial MUST be remedied (it forks to Remediation), never accepted as "validated".',
  remediation:
    'Remediate the failed / partial high-severity consequences the Constitutional Validation surfaced. For EACH, propose a concrete remedy AND a learningNote (the captured lesson — the feedback loop for learning). State the residual risk honestly. Set revalidationRequired=true when the remedies must be re-checked by another validation pass; set it false only when the residual risk is explicitly acceptable and no re-validation is needed.',
  deployment_authorization:
    'Author the DEPLOYMENT AUTHORIZATION record (CFS-016 D1): consequence-test-before-deploy. Authorize deployment ONLY when the constitutional threshold is met (the consequence test passed with no unresolved high/critical must-not-happen failures). If it is not met, set authorized=false and list the blocking consequence ids. Execution stays human: the receipt is the authorization record; the code runs in Claude Code and is pushed manually.',
  complete: '',
};

/**
 * Build the per-stage instruction addendum for the aigent-z system prompt.
 * Tells the LLM how to behave at this stage and the exact stage_data fence
 * format for its structured proposal.
 *
 * `altStageInput` (optional) is the SECOND candidate stage — the viewed
 * capsule's / session's stage when the operator's message was detected as
 * requesting a different one. Both schemas are presented and the LLM picks
 * the one the operator's request actually means, so neither a keyword
 * misfire nor the capsule override can suppress the right proposal kind.
 */
export function buildStageInstructionBlock(
  stageInput: DevLoopStage | string | undefined,
  altStageInput?: DevLoopStage | string | null,
): string {
  const stage: DevLoopStage =
    typeof stageInput === 'string' && stageInput in STAGE_PROPOSAL_KIND
      ? (stageInput as DevLoopStage)
      : 'intent_capture';
  const kind = STAGE_PROPOSAL_KIND[stage];
  if (!kind) {
    return '\n\n## Dev loop complete\n\nThe loop is complete. Help the operator review outcomes or start a new intent (a new intent proposal is allowed at any time).';
  }

  const altStage: DevLoopStage | null =
    typeof altStageInput === 'string' && altStageInput in STAGE_PROPOSAL_KIND && altStageInput !== stage
      ? (altStageInput as DevLoopStage)
      : null;
  const altKind = altStage ? STAGE_PROPOSAL_KIND[altStage] : null;

  const altSection =
    altStage && altKind
      ? `\n\nAlternate stage (subordinate — emit ONE of the two schemas, never both): the operator's current capsule/session context is the **${altStage}** stage. Default to the primary ${kind} schema above; ONLY if the operator's request is unambiguously about the ${altStage} stage instead, emit its ${altKind} proposal in the same fence format:

\`\`\`stage_data
${SCHEMAS[altKind]}
\`\`\`

${STAGE_BEHAVIOR[altStage]}`
      : '';

  const oneOfLine =
    altStage && altKind
      ? `exactly ONE \`\`\`stage_data fence — the primary ${kind} schema, or the alternate ${altKind} schema if that is what the operator actually asked for. Never zero fences, never two.`
      : `exactly ONE \`\`\`stage_data fence using the ${kind} schema. Never zero fences, never two.`;

  return `\n\n## Stage execution — produce a structured ${kind} proposal

You are executing the **${stage}** stage. ${STAGE_BEHAVIOR[stage]}

The fence below is stripped before the operator sees your message — it becomes a pending approval card in the right pane. Primary schema for this stage:

\`\`\`stage_data
${SCHEMAS[kind]}
\`\`\`${altSection}

Rules:
- Your visible reply narrates the proposal conversationally (development intelligence, not code), mirrors the SAME content the fence carries, and tells the operator which right-pane card is awaiting their approval.
- NEVER say you are preparing or will prepare a proposal, and NEVER claim a card is awaiting approval unless THIS reply contains the stage_data fence — the fence IS the preparation. There is no separate preparation step.
- The operator may APPROVE (commits the artifact, advances the stage) or ask you to REFINE — when they ask for changes, emit a fresh full proposal fence with the revisions applied.
- The loop is cyclical: if the operator asks to revisit an earlier stage, emit that stage's proposal kind instead. An "intent" proposal is valid at any time and restarts the loop.
- Never emit a fence built on invented data. If your ground truth lacks what you need, say what's missing and ask.

Fence contract (MANDATORY — this outranks everything above):
- You MUST end your reply with ${oneOfLine}
- Emit the fence whenever the operator asks you to produce, assemble, analyze, model, brief, draft, or validate ANYTHING — including free-form phrasing that never uses those exact words. If your narrative describes structured content (a context pack, a gap list, a canvas, a brief, a validation), the fence carrying that content is NOT optional: without it, nothing reaches the operator's right pane.
- The fence body is STRICT JSON: double-quoted keys and strings, no trailing commas, no comments, no unescaped newlines inside string values.
- The fence is the LAST thing in your reply. Only omit it when the operator asked a pure status or navigation question that produces no artifact.

EXAMPLE FORMAT ONLY (a minimal "intent" proposal showing the required fence shape — never copy this content; emit YOUR stage's schema with real data):

\`\`\`stage_data
{
  "kind": "intent",
  "summary": "Add CSV export to the reports tab",
  "data": {
    "goal": "Operators can export any report as CSV",
    "users": ["operators"],
    "priority": "medium"
  }
}
\`\`\``;
}

// ─── Extraction (server-side, mirrors stripLayoutTags) ──────────────────────

// Loose on the tag boundary (a newline after `stage_data` is optional) —
// operator finding 5 (2026-07-06): fences the model emitted with slight
// format drift were dropped wholesale, reading as "nothing arrived".
const STAGE_DATA_FENCE_RE = /```stage_data\s*([\s\S]*?)```/g;

/**
 * Minimal string-aware JSON repair for nearly-valid fences (pure + inline —
 * mirrors the proven repair in services/experiments/llm.ts without importing
 * the provider module into the client bundle): escapes literal newlines/tabs
 * inside strings and strips trailing commas in STRUCTURAL runs only.
 */
function repairFenceJson(raw: string): string {
  let out = '';
  let seg = '';
  let inStr = false;
  let esc = false;
  const flushSeg = () => {
    seg = seg.replace(/,\s*([\]}])/g, '$1');
    out += seg;
    seg = '';
  };
  for (const ch of raw) {
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') continue;
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { flushSeg(); inStr = true; out += ch; continue; }
    seg += ch;
  }
  flushSeg();
  return out;
}

/** Strict parse first; on failure, slice to the outermost object and repair. */
function parseFenceBody(body: string): Record<string, unknown> | null {
  const trimmed = body.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const sliced = start > -1 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  try {
    return JSON.parse(sliced) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(repairFenceJson(sliced)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export function extractStageProposals(text: string): {
  cleanText: string;
  proposals: StageProposal[];
} {
  const proposals: StageProposal[] = [];
  const cleanText = text
    .replace(STAGE_DATA_FENCE_RE, (_match, body: string) => {
      const parsed = parseFenceBody(body);
      if (!parsed) {
        // Malformed beyond repair — the narrative reply still stands, but
        // NEVER silently: this is exactly the "nothing arrived" failure mode.
        console.warn(
          '[stageOrchestrator] dropped unrepairable stage_data fence:',
          body.trim().slice(0, 200),
        );
        return '';
      }
      const kind = typeof parsed.kind === 'string' ? parsed.kind : '';
      if (PROPOSAL_KINDS.has(kind) && parsed.data && typeof parsed.data === 'object') {
        proposals.push({
          kind: kind as StageProposalKind,
          summary: typeof parsed.summary === 'string' ? parsed.summary : kind,
          data: parsed.data as Record<string, unknown>,
        });
      } else {
        console.warn('[stageOrchestrator] dropped stage_data fence with unknown kind:', kind || '(none)');
      }
      return '';
    })
    .trim();

  return { cleanText, proposals };
}

// ─── Promise-without-production heuristic (server-side fence enforcement) ──

// Operator field report 2026-07-06 (deployed test, gpt-4o-mini): the copilot
// NARRATED creating a stage proposal ("I will now prepare a context
// proposal… This proposal is now awaiting your approval") while emitting
// ZERO ```stage_data fences — so no pending card appeared and the loop
// stalled. The lenient fence repair above only fixes fences that ARRIVE;
// this heuristic detects the zero-fence promise so the chat route can make
// ONE follow-up provider call demanding the fence alone.
const PROPOSAL_PROMISE_RE =
  /\b(prepar(e|ing)|propos(al|e|ing)|awaiting your approval|hold on|will (now )?(create|draft|generate|assemble|produce))\b/i;

/**
 * True when a reply's visible text promises a stage proposal it did not
 * produce. Pure — exported for canary tests. Text that still carries a
 * ```stage_data fence never triggers (the route checks
 * proposals.length === 0 first, but the helper is safe standalone too).
 */
export function looksLikeUnfulfilledProposalPromise(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  if (text.includes('```stage_data')) return false;
  return PROPOSAL_PROMISE_RE.test(text);
}

// ─── Coercion helpers ───────────────────────────────────────────────────────

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function objArr(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
    : [];
}

/**
 * First non-empty object array under any of the candidate keys — field-name
 * tolerance for payload variants the model emits despite the schema (operator
 * finding 5, 2026-07-06: `existingCapabilities`/`missingCapabilities` instead
 * of `existing`/`missing` applied as an EMPTY gap analysis).
 */
function pickObjArr(d: Record<string, unknown>, keys: string[]): Array<Record<string, unknown>> {
  for (const k of keys) {
    const arr = objArr(d[k]);
    if (arr.length > 0) return arr;
  }
  return [];
}

// ─── Apply (client-side, on operator Approve) ───────────────────────────────

const SOURCE_KINDS: readonly ContextSourceKind[] = [
  'prd', 'architecture', 'update', 'cartridge', 'governance',
  'registry_asset', 'prior_decision', 'receipt', 'codebase', 'claude_md',
];
const CONSEQUENCE_CATEGORIES = ['workflow', 'data', 'governance', 'permission', 'integration', 'user_experience'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

function requireIntentId(session: DevLoopState): string {
  return session.intent?.intentId ?? `dci-orphan-${session.sessionId}`;
}

/**
 * Commit an approved proposal into the session. Pure: returns a new
 * DevLoopState. Stage advancement is the caller's choice (canAdvance/
 * advanceStage) so the UI stays in control of the strip.
 */
export function applyStageProposal(session: DevLoopState, proposal: StageProposal): DevLoopState {
  const now = new Date().toISOString();
  const d = proposal.data;

  switch (proposal.kind) {
    case 'intent': {
      const base = createEmptyIntent(str(d.rawInput, proposal.summary));
      const intent: StructuredDevIntent = refineIntent(base, {
        goal: str(d.goal, proposal.summary),
        users: strArr(d.users),
        desiredOutcomes: strArr(d.desiredOutcomes),
        successCriteria: strArr(d.successCriteria),
        constraints: strArr(d.constraints),
        relatedCartridges: strArr(d.relatedCartridges),
        relatedVentures: strArr(d.relatedVentures),
        priority: oneOf(d.priority, ['critical', 'high', 'medium', 'low'] as const, 'medium'),
        status: 'refined',
      });
      // A new intent restarts the loop: downstream artifacts are stale.
      return {
        ...session,
        stage: 'intent_capture',
        intent,
        contextPack: null,
        gapAnalysis: null,
        consequenceCanvas: null,
        validationReport: null,
        implementationBrief: null,
        updatedAt: now,
      };
    }

    case 'context_pack': {
      let pack = createEmptyContextPack(requireIntentId(session));
      for (const raw of objArr(d.items)) {
        const item: ContextPackItem = {
          sourceKind: oneOf(raw.sourceKind, SOURCE_KINDS, 'codebase'),
          sourcePath: str(raw.sourcePath),
          title: str(raw.title, str(raw.sourcePath)),
          relevanceScore: Math.max(0, Math.min(1, num(raw.relevanceScore, 0.5))),
          excerpt: str(raw.excerpt),
          reuseSignal: oneOf(raw.reuseSignal, ['reuse', 'extend', 'reference'] as const, 'reference'),
        };
        if (!item.sourcePath) continue;
        pack = addContextItem(pack, item);
      }
      pack = {
        ...pack,
        totalTokenEstimate: pack.items.reduce((acc, i) => acc + estimateTokens(i.excerpt), 0),
      };
      return { ...session, contextPack: pack, updatedAt: now };
    }

    case 'gap_analysis': {
      let analysis = createEmptyGapAnalysis(requireIntentId(session));
      for (const raw of pickObjArr(d, ['existing', 'existingCapabilities', 'existing_capabilities'])) {
        analysis = addExistingCapability(analysis, {
          name: str(raw.name),
          location: str(raw.location),
          description: str(raw.description),
          reuseStrategy: oneOf(raw.reuseStrategy, ['use_directly', 'extend', 'wrap', 'adapt'] as const, 'extend'),
          confidence: Math.max(0, Math.min(1, num(raw.confidence, 0.5))),
        });
      }
      for (const raw of pickObjArr(d, ['missing', 'missingCapabilities', 'missing_capabilities'])) {
        analysis = addMissingCapability(analysis, {
          name: str(raw.name),
          description: str(raw.description),
          estimatedComplexity: oneOf(raw.estimatedComplexity, ['trivial', 'small', 'medium', 'large'] as const, 'medium'),
          dependencies: strArr(raw.dependencies),
          suggestedLocation: str(raw.suggestedLocation),
        });
      }
      return { ...session, gapAnalysis: analysis, updatedAt: now };
    }

    case 'consequence_canvas': {
      let canvas = createEmptyCanvas(requireIntentId(session));
      for (const raw of objArr(d.shouldHappen)) {
        canvas = addShouldHappen(canvas, coerceConsequenceEntry(raw));
      }
      for (const raw of objArr(d.shouldNeverHappen)) {
        canvas = addShouldNeverHappen(canvas, coerceConsequenceEntry(raw));
      }
      canvas = {
        ...canvas,
        workflowsActivated: strArr(d.workflowsActivated),
        systemsAffected: strArr(d.systemsAffected),
        permissionsRequired: strArr(d.permissionsRequired),
        successState: str(d.successState),
      };
      return { ...session, consequenceCanvas: canvas, updatedAt: now };
    }

    case 'implementation_brief': {
      return { ...session, implementationBrief: str(d.brief) || null, updatedAt: now };
    }

    case 'validation_report': {
      const intentId = requireIntentId(session);
      let report = createEmptyValidationReport(intentId, session.consequenceCanvas?.intentId ?? intentId);
      for (const raw of objArr(d.items)) {
        const item: ConsequenceValidationItem = {
          consequenceId: str(raw.consequenceId),
          description: str(raw.description),
          verdict: oneOf(raw.verdict, ['satisfied', 'unresolved', 'unintended', 'partial'] as const, 'unresolved'),
          evidence: str(raw.evidence),
          severity: oneOf(raw.severity, SEVERITIES, 'medium'),
        };
        if (!item.description) continue;
        report = addValidationItem(report, item);
      }
      report = {
        ...report,
        workflowImpacts: strArr(d.workflowImpacts),
        governanceImpacts: strArr(d.governanceImpacts),
        testingRequirements: strArr(d.testingRequirements),
      };
      return { ...session, validationReport: report, updatedAt: now };
    }

    case 'remediation_plan': {
      const remedies: RemediationEntry[] = objArr(d.remedies)
        .map((raw) => ({
          consequenceId: str(raw.consequenceId),
          description: str(raw.description),
          remedy: str(raw.remedy),
          learningNote: str(raw.learningNote),
        }))
        .filter((r) => r.remedy || r.description);
      const plan: RemediationPlan = {
        intentId: requireIntentId(session),
        remedies,
        residualRisk: str(d.residualRisk),
        // Default to requiring re-validation — the safe constitutional default.
        revalidationRequired: typeof d.revalidationRequired === 'boolean' ? d.revalidationRequired : true,
        createdAt: now,
      };
      return { ...session, remediationPlan: plan, updatedAt: now };
    }

    case 'deployment_authorization': {
      const auth: DeploymentAuthorization = {
        intentId: requireIntentId(session),
        authorized: d.authorized === true,
        constitutionalThresholdMet: d.constitutionalThresholdMet === true,
        rationale: str(d.rationale),
        blockingConsequences: strArr(d.blockingConsequences),
        authorizedAt: now,
      };
      return { ...session, deploymentAuthorization: auth, updatedAt: now };
    }

    default:
      return session;
  }
}

function coerceConsequenceEntry(raw: Record<string, unknown>): ConsequenceEntry {
  return createConsequenceEntry(
    str(raw.description),
    oneOf(raw.category, CONSEQUENCE_CATEGORIES, 'workflow'),
    oneOf(raw.severity, SEVERITIES, 'medium'),
  );
}
