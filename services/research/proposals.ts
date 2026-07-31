/**
 * Research proposal engine — IRL Phase C2.1 (CFS-019).
 *
 * The ICE pattern (services/devCommandCenter/stageOrchestrator.ts) applied to
 * the research copilot: aigentZ, operating on the `irl-research` surface,
 * produces structured research objects as fenced ```research_data JSON blocks
 * in its replies. The chat route extracts them server-side and returns them as
 * `stage_proposals` (the shared copilot proposal channel); the copilot tab
 * renders each as a pending approval card (preview-before-approve). Only on
 * operator Approve does `applyResearchProposal` commit the object into the
 * tab's in-memory research state — NOTHING auto-commits.
 *
 * Constitutional discipline mirrored from the dev loop:
 *  - SUGGEST-ONLY: apply is pure, returns new state, never side-effects
 *    (no DB, no receipt, no DVN). Persistence + `research_lifecycle_transition`
 *    receipting is a NAMED follow-on, exactly as the dev loop deferred it.
 *  - LIFECYCLE-LEGAL: a proposal is a CREATE at a lifecycle's entry state, or
 *    an ADVANCE by one legal step. An illegal experiment transition is
 *    REJECTED on apply (isLegalExperimentTransition), never silently committed.
 *  - T2-SAFE: proposal payloads carry only experiment ids, families, claims,
 *    hash-commitment evidence refs, and invariant seed ids — NEVER T0
 *    identifiers (personaId, authProfileId, rootDid).
 *
 * Isomorphic: no fs, no DB — safe for the chat route (prompt + extraction) and
 * the client tab (apply on approve). The lenient fence parser is REUSED from
 * stageOrchestrator (parseFenceBody → repairFenceJson) — not forked.
 */

import {
  EXPERIMENT_REGISTRY,
  FINDING_LIFECYCLE,
  PUBLICATION_KINDS,
  isLegalExperimentTransition,
  type ConstitutionalLayer,
  type ExperimentLifecycleState,
  type FindingLifecycleState,
  type PublicationKind,
  type PublicationLifecycleState,
  type ResearchExperiment,
  type ResearchFinding,
  type ResearchPublication,
} from '@/types/research';
import { parseFenceBody } from '@/services/devCommandCenter/stageOrchestrator';

// ─── Proposal contract ──────────────────────────────────────────────────────

export type ResearchProposalKind =
  | 'experiment_proposal'
  | 'protocol_draft'
  | 'finding'
  | 'publication_draft';

export interface ResearchProposal {
  kind: ResearchProposalKind;
  /** One-line label for the approval card header. */
  summary: string;
  /** Kind-specific payload — validated and coerced on apply. */
  data: Record<string, unknown>;
}

const PROPOSAL_KINDS = new Set<string>([
  'experiment_proposal',
  'protocol_draft',
  'finding',
  'publication_draft',
]);

/**
 * The lifecycle effect of each proposal kind — canary-pinned. A proposal
 * CREATES a research object at its lifecycle entry state, or ADVANCES an
 * experiment by one legal step. This map is the single source of truth for
 * "what does approving this proposal do to the object model".
 */
export interface ResearchProposalEffect {
  /** The object created or advanced. */
  object: 'experiment' | 'finding' | 'publication';
  /** 'create' seeds a new object at `entryState`; 'advance' moves an existing
   *  experiment from `fromState` to `toState` (legality-checked). */
  action: 'create' | 'advance';
  /** For create: the lifecycle state the object enters at. */
  entryState?: ExperimentLifecycleState | FindingLifecycleState | PublicationLifecycleState;
  /** For advance: the required current state and the target state. */
  fromState?: ExperimentLifecycleState;
  toState?: ExperimentLifecycleState;
}

export const RESEARCH_PROPOSAL_EFFECT: Record<ResearchProposalKind, ResearchProposalEffect> = {
  // Create an experiment at the lifecycle entry state 'designed'.
  experiment_proposal: { object: 'experiment', action: 'create', entryState: 'designed' },
  // Advance an existing 'designed' experiment to 'protocol-ratified'.
  protocol_draft: { object: 'experiment', action: 'advance', fromState: 'designed', toState: 'protocol-ratified' },
  // Create a finding at the lifecycle entry state 'observed'.
  finding: { object: 'finding', action: 'create', entryState: 'observed' },
  // Create a publication at the lifecycle entry state 'draft'.
  publication_draft: { object: 'publication', action: 'create', entryState: 'draft' },
};

// ─── In-memory research object state (accumulator, mirrors DevLoopState) ─────

export interface ProposedExperiment {
  experiment: ResearchExperiment;
  lifecycle: ExperimentLifecycleState;
}

export interface ResearchProposalState {
  experiments: ProposedExperiment[];
  findings: ResearchFinding[];
  publications: ResearchPublication[];
  updatedAt: string;
}

export function createEmptyResearchState(): ResearchProposalState {
  return { experiments: [], findings: [], publications: [], updatedAt: new Date().toISOString() };
}

/**
 * The verdict of applying a proposal. `committed=false` with a `rejection`
 * reason means an ILLEGAL lifecycle transition (or missing prerequisite) — the
 * returned state is UNCHANGED. Callers surface the rejection to the operator;
 * they never silently drop it. This differs from stageOrchestrator's
 * `applyStageProposal` (which returns state directly) precisely because
 * lifecycle-legality enforcement is C2.1's whole point.
 */
export interface ResearchApplyResult {
  state: ResearchProposalState;
  committed: boolean;
  rejection?: string;
}

// ─── Fence schemas (mirror stageOrchestrator's SCHEMAS style) ────────────────

const SCHEMAS: Record<ResearchProposalKind, string> = {
  experiment_proposal: `{
  "kind": "experiment_proposal",
  "summary": "<one-line label>",
  "data": {
    "id": "<EXP-NNN — a NEW id not already in the registry, or reuse a registry id only to re-design it>",
    "layer": "I|II|III",
    "family": "<the property family being tested, e.g. Semantic Fidelity>",
    "seriesId": "<FVS|PSE|... an existing series id from the ground truth>",
    "hypothesis": "<the falsifiable hypothesis, one sentence>",
    "protocolRef": "<repo path where the protocol/design doc lives — provenance, never invented>",
    "governingInvariants": ["inv.<...>", ...]
  }
}`,
  protocol_draft: `{
  "kind": "protocol_draft",
  "summary": "<one-line label>",
  "data": {
    "experimentId": "<EXP-NNN of a DESIGNED experiment being ratified>",
    "protocolRef": "<repo path of the ratified protocol doc>",
    "evidence": "<what makes this protocol ready to ratify — the design review outcome>"
  }
}`,
  finding: `{
  "kind": "finding",
  "summary": "<one-line label>",
  "data": {
    "experimentId": "<EXP-NNN the observation came from>",
    "claim": "<the observed finding, stated as a claim>",
    "evidenceRefs": ["<canonical result hash-commitment prefix or result id — NEVER a raw persona/case id>", ...],
    "governingInvariants": ["inv.<...>", ...]
  }
}`,
  publication_draft: `{
  "kind": "publication_draft",
  "summary": "<one-line label>",
  "data": {
    "title": "<publication title>",
    "publicationKind": "working|technical|white|note|conference",
    "sourceArtifacts": ["<EXP-NNN / result hash / FIND-id contributing to this publication>", ...],
    "abstract": "<one-paragraph abstract grounded in the canonical record — never invented results>"
  }
}`,
};

const KIND_BEHAVIOR: Record<ResearchProposalKind, string> = {
  experiment_proposal:
    'Design a NEW experiment: a falsifiable hypothesis, the property family it tests, the series it belongs to, a protocolRef path, and the governing invariants it operates under. Approval creates the experiment at lifecycle `designed`. Never assert results — a designed experiment has run nothing yet.',
  protocol_draft:
    'Ratify the protocol of a DESIGNED experiment: cite the design-review evidence and the ratified protocolRef. Approval advances the experiment `designed → protocol-ratified`. This is legal ONLY for an experiment currently at `designed`; if it is already ratified or running, say so and do not emit the proposal.',
  finding:
    'Record an OBSERVED finding from an experiment: the claim plus evidence references (canonical result hash commitments / result ids — never raw identifiers). Approval creates the finding at lifecycle `observed`. A finding earns `replicated`/`canonized-as-invariant` only through the lifecycle, never by assertion — do not overstate maturity.',
  publication_draft:
    'Draft a publication from the canonical record: title, kind, the source artifacts (experiment ids / result hashes / finding ids) it draws on, and an abstract grounded in what actually exists. Approval creates the publication at lifecycle `draft`. Never cite a result that is not in the ground truth.',
};

const PROPOSAL_KIND_LABEL: Record<ResearchProposalKind, string> = {
  experiment_proposal: 'Experiment Design',
  protocol_draft: 'Protocol Ratification',
  finding: 'Research Finding',
  publication_draft: 'Publication Draft',
};

export function researchProposalKindLabel(kind: ResearchProposalKind): string {
  return PROPOSAL_KIND_LABEL[kind] ?? kind;
}

// ─── Instruction block (server-side prompt addendum) ─────────────────────────

/**
 * Build the research-proposal instruction addendum for the aigentZ system
 * prompt on the irl-research surface. Mirrors buildStageInstructionBlock:
 * presents the fence schema(s) and the hard-won strict-JSON fence contract +
 * never-promise rule. When `kind` is omitted, ALL four schemas are offered and
 * aigentZ picks the one the operator's request means (the research copilot is
 * not a linear stage machine — any object may be proposed at any time).
 */
export function buildResearchInstructionBlock(kind?: ResearchProposalKind): string {
  const kinds: ResearchProposalKind[] = kind
    ? [kind]
    : ['experiment_proposal', 'protocol_draft', 'finding', 'publication_draft'];

  const schemaBlocks = kinds
    .map(
      (k) => `### ${PROPOSAL_KIND_LABEL[k]} (\`${k}\`)
${KIND_BEHAVIOR[k]}

\`\`\`research_data
${SCHEMAS[k]}
\`\`\``,
    )
    .join('\n\n');

  return `\n\n## Research proposal — produce a structured, operator-approvable research object

When the operator asks you to DESIGN an experiment, RATIFY a protocol, RECORD a finding, or DRAFT a publication, produce it as a structured proposal. The fence below is stripped before the operator sees your message — it becomes a pending approval card in the right pane. On Approve, the object commits to the lab's working state at its lifecycle entry (or advances one legal step); NOTHING commits without approval.

${schemaBlocks}

Rules:
- Your visible reply narrates the proposal in research language (what the object is, why it matters, how it sits in the programme), mirrors the SAME content the fence carries, and tells the operator which right-pane card is awaiting approval.
- NEVER say you are preparing or will prepare a proposal, and NEVER claim a card is awaiting approval unless THIS reply contains the research_data fence — the fence IS the preparation. There is no separate preparation step.
- LIFECYCLE-LEGALITY IS CONSTITUTIONAL: an experiment enters at \`designed\`; a protocol_draft ratifies ONLY a currently-\`designed\` experiment (designed → protocol-ratified); a finding enters at \`observed\`; a publication enters at \`draft\`. Never propose a transition that skips a step or moves backward — it will be rejected on apply. Never assert a result, run, or maturity level not present in the ground truth.
- The operator may APPROVE (commits the object) or ask you to REFINE — when they ask for changes, emit a fresh full proposal fence with the revisions applied.

RUNNING an experiment is NOT a proposal and has NO fence. Experiments are EXECUTED in the Experiment Lab runner UI (the EXP-001…005 tabs), not through you. When the operator asks how to run — or to run — an experiment, answer in one or two sentences: name the Experiment Lab tab that runs it and what the run produces (a canonical, hash-committed result that advances the experiment's lifecycle). Then, only if it fits, offer the closest proposal you CAN make (e.g. "I can draft the protocol for EXP-00X if it isn't ratified yet"). Do NOT emit a fence for a run request, and do NOT loop describing the mechanics — point to the runner and stop.

Fence contract — CONDITIONAL (narration stays your primary mandate; the fence is the EXCEPTION, not the rule):
- Emit ${kind ? `exactly ONE \`\`\`research_data fence using the ${kind} schema` : 'exactly ONE ```research_data fence, choosing the ONE schema of the four above that matches the request (never mix schemas)'} IF AND ONLY IF the operator asked you to DESIGN an experiment, RATIFY a protocol, RECORD a finding, or DRAFT a publication. When you do emit one, it is the LAST thing in your reply.
- For EVERYTHING ELSE — narrating lab state, answering a status/how-to/what-is question, or a request to RUN an experiment — emit NO fence. Narration with no fence is the correct, complete answer. Never force a fence when no proposal kind matches the request; a request with no matching proposal kind (like "run an experiment") is answered by narration alone.
- When you do emit a fence, its body is STRICT JSON: double-quoted keys and strings, no trailing commas, no comments, no unescaped newlines inside string values.`;
}

// ─── Extraction (server-side, reuses the exact stageOrchestrator parser) ─────

// Loose on the tag boundary (a newline after `research_data` is optional) —
// same drift tolerance the dev loop learned (stageOrchestrator finding 5).
const RESEARCH_DATA_FENCE_RE = /```research_data\s*([\s\S]*?)```/g;

/**
 * Pull structured research_data proposals out of an aigentZ reply. Mirrors
 * extractStageProposals exactly — same lenient parseFenceBody (which owns the
 * repairFenceJson string-aware repair), same never-silent drop warnings — with
 * the research fence tag and kind set. A nearly-valid fence (literal newlines
 * in strings, a trailing comma) still parses; a fence beyond repair or with an
 * unknown kind is dropped with a console.warn, never silently.
 */
export function extractResearchProposals(text: string): {
  cleanText: string;
  proposals: ResearchProposal[];
} {
  const proposals: ResearchProposal[] = [];
  if (!text || typeof text !== 'string') return { cleanText: text ?? '', proposals };

  const cleanText = text
    .replace(RESEARCH_DATA_FENCE_RE, (_match, body: string) => {
      const parsed = parseFenceBody(body);
      if (!parsed) {
        console.warn(
          '[researchProposals] dropped unrepairable research_data fence:',
          body.trim().slice(0, 200),
        );
        return '';
      }
      const kind = typeof parsed.kind === 'string' ? parsed.kind : '';
      if (PROPOSAL_KINDS.has(kind) && parsed.data && typeof parsed.data === 'object') {
        proposals.push({
          kind: kind as ResearchProposalKind,
          summary: typeof parsed.summary === 'string' ? parsed.summary : kind,
          data: parsed.data as Record<string, unknown>,
        });
      } else {
        console.warn('[researchProposals] dropped research_data fence with unknown kind:', kind || '(none)');
      }
      return '';
    })
    .trim();

  return { cleanText, proposals };
}

// ─── Coercion helpers (mirror stageOrchestrator) ─────────────────────────────

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

const LAYERS: readonly ConstitutionalLayer[] = ['I', 'II', 'III'];

function slugId(prefix: string, seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
  return `${prefix}-${base || Math.random().toString(36).slice(2, 8)}`;
}

// ─── T2 safety (identifier-tier guard for network/DB-bound payloads) ─────────

/**
 * The five identifier classes that MUST NEVER ride a research payload
 * (CLAUDE.md identity spine, T0 tier). Matched key-wise, case-insensitively,
 * with `_`/`-` separators normalised (so `persona_id` is caught too).
 */
export const FORBIDDEN_IDENTIFIER_KEYS = [
  'personaId',
  'authProfileId',
  'rootDid',
  'fioHandle',
  'kybeAttestation',
] as const;

const FORBIDDEN_NORMALISED = new Set(
  FORBIDDEN_IDENTIFIER_KEYS.map((k) => k.toLowerCase().replace(/[_-]/g, '')),
);

/**
 * T2-safety rejection predicate — Phase C2.2. Walks a proposal payload (any
 * nesting, arrays included) and returns the FIRST key that names a forbidden
 * T0 identifier, or null when the payload is clean. The objects route rejects
 * any payload for which this returns non-null BEFORE it touches the DB, a
 * receipt, or the response — research_objects payloads are T2-safe by
 * construction AND by gate.
 */
export function findForbiddenIdentifierKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findForbiddenIdentifierKey(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_NORMALISED.has(key.toLowerCase().replace(/[_-]/g, ''))) return key;
      const hit = findForbiddenIdentifierKey(nested);
      if (hit) return hit;
    }
  }
  return null;
}

// ─── Apply (pure — commit an approved proposal into the state) ───────────────

/**
 * Commit an approved research proposal into the in-memory state. PURE: returns
 * a new ResearchProposalState, no side-effects (no DB, no receipt, no DVN).
 * Illegal lifecycle transitions are REJECTED (committed=false, state unchanged)
 * — never silently applied.
 */
export function applyResearchProposal(
  state: ResearchProposalState,
  proposal: ResearchProposal,
): ResearchApplyResult {
  const now = new Date().toISOString();
  const d = proposal.data;
  const reject = (rejection: string): ResearchApplyResult => ({ state, committed: false, rejection });

  switch (proposal.kind) {
    case 'experiment_proposal': {
      const id = str(d.id) || slugId('EXP', str(d.family, proposal.summary));
      const experiment: ResearchExperiment = {
        id,
        layer: oneOf(d.layer, LAYERS, 'I'),
        family: str(d.family, proposal.summary),
        seriesId: str(d.seriesId),
        hypothesis: str(d.hypothesis, proposal.summary),
        protocolRef: str(d.protocolRef),
        governingInvariants: strArr(d.governingInvariants),
      };
      const entryState = RESEARCH_PROPOSAL_EFFECT.experiment_proposal.entryState as ExperimentLifecycleState;
      // Re-designing an existing session experiment resets it to `designed`.
      const experiments = state.experiments.some((e) => e.experiment.id === id)
        ? state.experiments.map((e) => (e.experiment.id === id ? { experiment, lifecycle: entryState } : e))
        : [...state.experiments, { experiment, lifecycle: entryState }];
      return { state: { ...state, experiments, updatedAt: now }, committed: true };
    }

    case 'protocol_draft': {
      const experimentId = str(d.experimentId);
      if (!experimentId) return reject('protocol_draft requires an experimentId');
      const effect = RESEARCH_PROPOSAL_EFFECT.protocol_draft;
      const target = effect.toState as ExperimentLifecycleState;

      const existing = state.experiments.find((e) => e.experiment.id === experimentId);
      // The `from` state is the experiment's ACTUAL current lifecycle when it
      // exists in session state; otherwise the effect's required entry state.
      const from: ExperimentLifecycleState = existing ? existing.lifecycle : (effect.fromState as ExperimentLifecycleState);

      if (!isLegalExperimentTransition(from, target)) {
        return reject(`illegal transition ${from} → ${target} for ${experimentId} (protocol_draft ratifies a designed experiment only)`);
      }

      if (existing) {
        const experiments = state.experiments.map((e) =>
          e.experiment.id === experimentId
            ? {
                experiment: { ...e.experiment, protocolRef: str(d.protocolRef, e.experiment.protocolRef) },
                lifecycle: target,
              }
            : e,
        );
        return { state: { ...state, experiments, updatedAt: now }, committed: true };
      }

      // Not yet in session state — seed from the pinned registry if known, so a
      // registry experiment can be ratified through the copilot without first
      // re-proposing it. Unknown ids are rejected (never fabricate an experiment).
      const registry = EXPERIMENT_REGISTRY.find((e) => e.id === experimentId);
      if (!registry) {
        return reject(`unknown experiment '${experimentId}' — propose the experiment (design) before ratifying its protocol`);
      }
      const seeded: ProposedExperiment = {
        experiment: { ...registry, protocolRef: str(d.protocolRef, registry.protocolRef) },
        lifecycle: target,
      };
      return { state: { ...state, experiments: [...state.experiments, seeded], updatedAt: now }, committed: true };
    }

    case 'finding': {
      const experimentId = str(d.experimentId);
      const claim = str(d.claim, proposal.summary);
      if (!claim) return reject('finding requires a claim');
      const finding: ResearchFinding = {
        id: slugId('FIND', claim),
        experimentId,
        claim,
        evidenceRefs: strArr(d.evidenceRefs),
        lifecycle: FINDING_LIFECYCLE[0], // 'observed' — entry state, never asserted higher
        governingInvariants: strArr(d.governingInvariants),
      };
      return { state: { ...state, findings: [...state.findings, finding], updatedAt: now }, committed: true };
    }

    case 'publication_draft': {
      const title = str(d.title, proposal.summary);
      if (!title) return reject('publication_draft requires a title');
      const publication: ResearchPublication = {
        id: slugId('PUB', title),
        kind: oneOf(d.publicationKind, PUBLICATION_KINDS, 'working') as PublicationKind,
        title,
        sourceArtifacts: strArr(d.sourceArtifacts),
        abstract: str(d.abstract),
        lifecycle: 'draft', // entry state
      };
      return { state: { ...state, publications: [...state.publications, publication], updatedAt: now }, committed: true };
    }

    default:
      return reject(`unknown research proposal kind '${(proposal as ResearchProposal).kind}'`);
  }
}
