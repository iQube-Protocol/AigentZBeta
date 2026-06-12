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
  | 'validation_report';

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
]);

/** Which proposal kind each stage produces. */
export const STAGE_PROPOSAL_KIND: Record<DevLoopStage, StageProposalKind | null> = {
  intent_capture: 'intent',
  context_assembly: 'context_pack',
  gap_analysis: 'gap_analysis',
  consequence_modeling: 'consequence_canvas',
  implementation: 'implementation_brief',
  consequence_validation: 'validation_report',
  complete: null,
};

/** Which capability capsule a proposal kind lands in (right-pane chip ids). */
export const PROPOSAL_KIND_TO_CAPSULE: Record<StageProposalKind, string> = {
  intent: 'intent',
  context_pack: 'context',
  gap_analysis: 'gap-analysis',
  consequence_canvas: 'consequence-canvas',
  implementation_brief: 'project-overview',
  validation_report: 'validation',
};

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
    'Validate the implementation against the consequence canvas: each shouldHappen/shouldNeverHappen entry gets a verdict with evidence. Also check the original intent\'s success criteria and governance constraints. Surface unintended consequences explicitly.',
  complete: '',
};

/**
 * Build the per-stage instruction addendum for the aigent-z system prompt.
 * Tells the LLM how to behave at this stage and the exact stage_data fence
 * format for its structured proposal.
 */
export function buildStageInstructionBlock(stageInput: DevLoopStage | string | undefined): string {
  const stage: DevLoopStage =
    typeof stageInput === 'string' && stageInput in STAGE_PROPOSAL_KIND
      ? (stageInput as DevLoopStage)
      : 'intent_capture';
  const kind = STAGE_PROPOSAL_KIND[stage];
  if (!kind) {
    return '\n\n## Dev loop complete\n\nThe loop is complete. Help the operator review outcomes or start a new intent (a new intent proposal is allowed at any time).';
  }

  return `\n\n## Stage execution — produce a structured ${kind} proposal

You are executing the **${stage}** stage. ${STAGE_BEHAVIOR[stage]}

When you have enough grounded material, append a fenced block at the END of your reply in EXACTLY this format (the fence is stripped before the operator sees your message — it becomes a pending approval card in the right pane):

\`\`\`stage_data
${SCHEMAS[kind]}
\`\`\`

Rules:
- Valid JSON only inside the fence. One fence per reply, maximum.
- Your visible reply narrates the proposal conversationally (development intelligence, not code) and tells the operator the card is awaiting their approval in the right pane.
- The operator may APPROVE (commits the artifact, advances the stage) or ask you to REFINE — when they ask for changes, emit a fresh full proposal fence with the revisions applied.
- The loop is cyclical: if the operator asks to revisit an earlier stage, emit that stage's proposal kind instead. A "intent" proposal is valid at any time and restarts the loop.
- Never emit a fence built on invented data. If your ground truth lacks what you need, say what's missing and ask.`;
}

// ─── Extraction (server-side, mirrors stripLayoutTags) ──────────────────────

const STAGE_DATA_FENCE_RE = /```stage_data\s*\n([\s\S]*?)```/g;

export function extractStageProposals(text: string): {
  cleanText: string;
  proposals: StageProposal[];
} {
  const proposals: StageProposal[] = [];
  const cleanText = text
    .replace(STAGE_DATA_FENCE_RE, (_match, body: string) => {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const kind = typeof parsed.kind === 'string' ? parsed.kind : '';
        if (PROPOSAL_KINDS.has(kind) && parsed.data && typeof parsed.data === 'object') {
          proposals.push({
            kind: kind as StageProposalKind,
            summary: typeof parsed.summary === 'string' ? parsed.summary : kind,
            data: parsed.data as Record<string, unknown>,
          });
        }
      } catch {
        // malformed fence — drop silently, the narrative reply still stands
      }
      return '';
    })
    .trim();

  return { cleanText, proposals };
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
      for (const raw of objArr(d.existing)) {
        analysis = addExistingCapability(analysis, {
          name: str(raw.name),
          location: str(raw.location),
          description: str(raw.description),
          reuseStrategy: oneOf(raw.reuseStrategy, ['use_directly', 'extend', 'wrap', 'adapt'] as const, 'extend'),
          confidence: Math.max(0, Math.min(1, num(raw.confidence, 0.5))),
        });
      }
      for (const raw of objArr(d.missing)) {
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
