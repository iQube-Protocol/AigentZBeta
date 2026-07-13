/**
 * DCIR D2 — the Constitutional State Engine, observe-mode slice (CFS-020 §4, §6).
 *
 * Two pure functions over the D1 event stream:
 *
 *   - `buildStateSnapshot(events, surfaceContext)` — a compact
 *     ConstitutionalStateSnapshot hardened from what is honestly observable
 *     in-session: the active workflow position (stage + open capsule from the
 *     surface's own state), recent artefacts (DocumentCreated-class events),
 *     and recent operator decisions (accept/reject/undo-class events). Every
 *     other snapshot field stays at its honest D0 default (empty / null) —
 *     those fields harden against their organs in later D2 sub-increments,
 *     never by ad-hoc payloads here.
 *
 *   - `mineBehaviouralInvariants(events)` — deterministic pattern detection
 *     over the session event window, emitting BehaviouralInvariant records
 *     with status 'observed' and honest evidence counts. Only patterns that
 *     are genuinely detectable from session events are mined; below the
 *     per-pattern evidence threshold, nothing is emitted.
 *
 * RATIFICATION BOUNDARY (CFS-020 §6, inv.interaction.115, inv.cybernetics.111
 * — non-negotiable): everything this module emits is an OBSERVATION, never a
 * rule. `BehaviouralInvariant.status` here is always 'observed' — promotion
 * to 'proposed' is the invariant-substrate submission path (IRL governance,
 * CFS-019), and canonization is the operator's act alone; the type cannot
 * even express 'canonical'. Consumers (the chat-route ground branches) label
 * mined patterns as observations the copilot may gently adapt to, NEVER as
 * rules and NEVER as licence to act without operator confirmation.
 *
 * NO persistence, NO cross-session memory: this slice mines the in-session
 * ring buffer only. Persisting patterns or mining across sessions builds
 * behavioural memory of the operator — that is its own ratification (the
 * observe-mode-first discipline, CFS-020 §9), not a rider on this module.
 *
 * Tier discipline: inputs are DcirEvents (T0 inexpressible by contract);
 * outputs carry only labels, counts, and event ids. The snapshot's `persona`
 * field is deliberately never populated here — no persona input exists on
 * this seam, so no T0/T1 identifier can enter the snapshot.
 *
 * Isomorphic: no fs, no DB, no React — safe for the client tabs (snapshot +
 * mining per render) and the chat route (defensive rendering).
 */

import type { BehaviouralInvariant, ConstitutionalStateSnapshot, DcirEvent, DcirEventKind } from '@/types/dcir';
import { DCIR_OBSERVATION_LINE_MAX } from '@/services/dcir/eventStream';

// ─── Bounds (canary-pinned in tests/constitutional-contracts.test.ts) ───────

/** Most recent artefact labels kept on each of active/previous artefact lists. */
export const DCIR_SNAPSHOT_ARTEFACT_LIMIT = 4;

/** Most recent operator decisions kept on the snapshot. */
export const DCIR_SNAPSHOT_DECISION_LIMIT = 5;

/** Hard bound on any label carried by the snapshot — labels, never bodies. */
export const DCIR_SNAPSHOT_LABEL_MAX = 48;

/** How many mined patterns a surface forwards to the copilot (compact). */
export const DCIR_OBSERVED_PATTERN_LIMIT = 3;

// ─── Evidence thresholds — below these, NOTHING is emitted ───────────────────

/** Same proposal/artifact dismissed at least this many times. */
export const DCIR_MINE_DISMISSAL_THRESHOLD = 2;

/** Same capsule opened at least this many times (revisits). */
export const DCIR_MINE_REVISIT_THRESHOLD = 3;

/** Data refreshed at least this many times (refresh-heavy session). */
export const DCIR_MINE_REFRESH_THRESHOLD = 3;

/** Approvals needed before an approval-style pattern is honest. */
export const DCIR_MINE_APPROVAL_STYLE_THRESHOLD = 3;

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * The surface-owned workflow position. The surface knows its own stage and
 * open capsule authoritatively (React state) — the engine records, it does
 * not re-derive what the surface already knows.
 */
export interface DcirStateSurfaceContext {
  surface: string;
  workflowStage?: string | null;
  activeCapsule?: string | null;
}

/** Event kinds that record an operator decision (accept/reject/undo class). */
const DECISION_KINDS: readonly DcirEventKind[] = [
  'RecommendationAccepted',
  'RecommendationRejected',
  'ArtifactApproved',
  'ArtifactRejected',
  'UndoPerformed',
];

/** Event kinds that record an artefact entering the session (created class). */
const ARTEFACT_KINDS: readonly DcirEventKind[] = ['DocumentCreated'];

function label(event: DcirEvent): string {
  return (event.artefactRefs[0] ?? event.summary).slice(0, DCIR_SNAPSHOT_LABEL_MAX);
}

/**
 * Honest, bounded state confidence: observe-mode partial state never claims
 * high confidence. Grows slowly with observed evidence, hard-capped at 0.6.
 */
function observedConfidence(observedCount: number): number {
  return Math.min(0.6, Math.round((0.2 + observedCount * 0.008) * 100) / 100);
}

/**
 * Build a compact ConstitutionalStateSnapshot from the in-session event log
 * plus the surface's own workflow position. Pure except `capturedAt`
 * (stamped at build time). Fields not observable at this slice stay at their
 * honest defaults — never invented.
 */
export function buildStateSnapshot(
  events: readonly DcirEvent[],
  surfaceContext: DcirStateSurfaceContext,
): ConstitutionalStateSnapshot {
  const artefactLabels = events.filter((e) => ARTEFACT_KINDS.includes(e.kind)).map(label);
  const activeArtefacts = artefactLabels.slice(-DCIR_SNAPSHOT_ARTEFACT_LIMIT);
  const previousArtefacts = artefactLabels
    .slice(0, Math.max(0, artefactLabels.length - DCIR_SNAPSHOT_ARTEFACT_LIMIT))
    .slice(-DCIR_SNAPSHOT_ARTEFACT_LIMIT);

  const operatorDecisions = events
    .filter((e) => DECISION_KINDS.includes(e.kind))
    .slice(-DCIR_SNAPSHOT_DECISION_LIMIT)
    .map((e) => ({
      kind: e.kind,
      label: e.summary.slice(0, DCIR_SNAPSHOT_LABEL_MAX),
      capsuleScope: e.capsuleScope,
      at: e.occurredAt,
    }));

  return {
    intent: [], // Intent Objects harden against the intent organ (later D2 sub-increment)
    goals: [],
    policies: [],
    constraints: [],
    activeArtefacts,
    previousArtefacts,
    operatorDecisions,
    persona: null, // deliberately never populated on this seam — see module header
    standing: null,
    preferences: null,
    confidence: observedConfidence(events.length),
    taskGraph: null,
    experienceGraph: null,
    workflow: {
      surface: surfaceContext.surface,
      stage: surfaceContext.workflowStage ?? null,
      activeCapsule: surfaceContext.activeCapsule ?? null,
    },
    capturedAt: new Date().toISOString(),
  };
}

// ─── Behavioural-invariant mining (observed, never rules) ────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Deterministic constructor: id and firstObservedAt derive from the evidence. */
function observedInvariant(key: string, pattern: string, evidence: readonly DcirEvent[]): BehaviouralInvariant {
  return {
    id: `bi-observed-${key}`,
    pattern,
    evidenceCount: evidence.length,
    evidenceEventIds: evidence.map((e) => e.id),
    status: 'observed',
    firstObservedAt: evidence[0]?.occurredAt ?? '',
  };
}

/**
 * Mine behavioural invariants from the session event window. Deterministic:
 * same events (same order) always yield the same patterns, ids, and evidence
 * — no clock, no randomness. Only honestly detectable session patterns are
 * mined; each carries its evidence event count and ids. Below a pattern's
 * threshold, that pattern is simply not emitted.
 */
export function mineBehaviouralInvariants(events: readonly DcirEvent[]): BehaviouralInvariant[] {
  const out: BehaviouralInvariant[] = [];

  // 1. Repeated dismissal of the same proposal/artifact (grouped by summary label).
  const dismissals = events.filter(
    (e) => e.kind === 'RecommendationRejected' || e.kind === 'ArtifactRejected',
  );
  const dismissalGroups = new Map<string, DcirEvent[]>();
  for (const e of dismissals) {
    const group = dismissalGroups.get(e.summary) ?? [];
    group.push(e);
    dismissalGroups.set(e.summary, group);
  }
  for (const key of [...dismissalGroups.keys()].sort()) {
    const group = dismissalGroups.get(key) ?? [];
    if (group.length >= DCIR_MINE_DISMISSAL_THRESHOLD) {
      out.push(
        observedInvariant(
          `repeated-dismissal-${slugify(key)}`,
          `Operator dismissed the same proposal repeatedly this session (${key}) — ${group.length} dismissals.`,
          group,
        ),
      );
    }
  }

  // 2. Approval style: approve-without-edit vs edit-before-approve. Only an
  // all-one-way run is an honest pattern; mixed behaviour emits nothing.
  const indexed = events.map((e, i) => ({ e, i }));
  const approvals = indexed.filter(
    ({ e }) => e.kind === 'RecommendationAccepted' || e.kind === 'ArtifactApproved',
  );
  if (approvals.length >= DCIR_MINE_APPROVAL_STYLE_THRESHOLD) {
    const editIndexes = indexed.filter(({ e }) => e.kind === 'DocumentEdited').map(({ i }) => i);
    let previousApprovalIndex = -1;
    let editedFirst = 0;
    for (const { i } of approvals) {
      if (editIndexes.some((editIndex) => editIndex > previousApprovalIndex && editIndex < i)) {
        editedFirst += 1;
      }
      previousApprovalIndex = i;
    }
    const evidence = approvals.map(({ e }) => e);
    if (editedFirst === 0) {
      out.push(
        observedInvariant(
          'approves-without-edit',
          `Operator approves without editing first — ${approvals.length} approvals this session, none preceded by an edit.`,
          evidence,
        ),
      );
    } else if (editedFirst === approvals.length) {
      out.push(
        observedInvariant(
          'edits-before-approving',
          `Operator edits before approving — all ${approvals.length} approvals this session were preceded by an edit.`,
          evidence,
        ),
      );
    }
  }

  // 3. Repeated capsule revisits (grouped by the opened capsule's scope).
  const opens = events.filter(
    (e) => e.kind === 'NavigationOccurred' && e.summary.startsWith('capsule opened:'),
  );
  const openGroups = new Map<string, DcirEvent[]>();
  for (const e of opens) {
    const key = e.capsuleScope ?? e.summary;
    const group = openGroups.get(key) ?? [];
    group.push(e);
    openGroups.set(key, group);
  }
  for (const key of [...openGroups.keys()].sort()) {
    const group = openGroups.get(key) ?? [];
    if (group.length >= DCIR_MINE_REVISIT_THRESHOLD) {
      out.push(
        observedInvariant(
          `capsule-revisits-${slugify(key)}`,
          `Operator keeps returning to the ${key} capsule — ${group.length} opens this session.`,
          group,
        ),
      );
    }
  }

  // 4. Refresh-heavy behaviour (manual data refreshes).
  const refreshes = events.filter(
    (e) => e.kind === 'SystemEvent' && e.summary.startsWith('data refreshed'),
  );
  if (refreshes.length >= DCIR_MINE_REFRESH_THRESHOLD) {
    out.push(
      observedInvariant(
        'refresh-heavy',
        `Refresh-heavy session — ${refreshes.length} data refreshes; the operator may be watching for a change that has not landed.`,
        refreshes,
      ),
    );
  }

  return out;
}

/**
 * Compact mined invariants into short strings for a surface's groundContext
 * `observedPatterns` — at most DCIR_OBSERVED_PATTERN_LIMIT, each carrying
 * its evidence count and its observed-only status so the rendering side
 * never has to guess.
 */
export function compactBehaviouralInvariants(
  invariants: readonly BehaviouralInvariant[],
  limit: number = DCIR_OBSERVED_PATTERN_LIMIT,
): string[] {
  return invariants
    .slice(0, limit)
    .map((inv) => `${inv.pattern} [evidence: ${inv.evidenceCount} event(s) · status: ${inv.status}]`);
}

// ─── Defensive rendering (server-side, chat route) ───────────────────────────

/**
 * Render a groundContext `stateSnapshot` payload into bounded ground-truth
 * lines. Defensive on shape — the value arrives as untyped JSON from the
 * client: anything malformed yields []. Narrate-only: the caller labels
 * these as observed state, never as commands.
 */
export function renderStateSnapshotLines(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
  const s = snapshot as Record<string, unknown>;
  const lines: string[] = [];

  const workflow = s.workflow;
  if (workflow && typeof workflow === 'object' && !Array.isArray(workflow)) {
    const w = workflow as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof w.surface === 'string') parts.push(`surface=${w.surface}`);
    if (typeof w.stage === 'string') parts.push(`stage=${w.stage}`);
    if (typeof w.activeCapsule === 'string') parts.push(`open capsule=${w.activeCapsule}`);
    if (parts.length > 0) lines.push(`- Workflow position: ${parts.join(' · ')}`);
  }

  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  const active = strings(s.activeArtefacts);
  if (active.length > 0) lines.push(`- Active artefacts (observed): ${active.join('; ')}`);
  const previous = strings(s.previousArtefacts);
  if (previous.length > 0) lines.push(`- Previous artefacts (superseded, lineage kept): ${previous.join('; ')}`);

  if (Array.isArray(s.operatorDecisions)) {
    const decisions = s.operatorDecisions
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && !Array.isArray(d))
      .slice(0, DCIR_SNAPSHOT_DECISION_LIMIT)
      .map((d) => {
        const kind = typeof d.kind === 'string' ? d.kind : 'decision';
        const decisionLabel = typeof d.label === 'string' ? d.label : '';
        const scope = typeof d.capsuleScope === 'string' ? ` [${d.capsuleScope}]` : '';
        return `${kind}: ${decisionLabel}${scope}`;
      })
      .filter((d) => d.length > 0);
    if (decisions.length > 0) lines.push(`- Operator decisions (newest last): ${decisions.join(' · ')}`);
  }

  if (typeof s.confidence === 'number') {
    lines.push(`- State confidence: ${s.confidence} (observe-mode partial state — honest, capped)`);
  }

  return lines.map((line) => line.slice(0, DCIR_OBSERVATION_LINE_MAX));
}
