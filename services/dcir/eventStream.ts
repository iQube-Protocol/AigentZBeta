/**
 * DCIR D1 — the Event Stream + observation seam (CFS-020 §5, §9).
 *
 * Observe-mode ONLY: this module emits and buffers observations of what the
 * operator and the runtimes already did — it never blocks a render, never
 * intercepts an action, never mutates the surface it watches (the CFS-017
 * precedent, ratified in CFS-020 §9). Any future observation-informed gate
 * is its own ratification, never a rider on this seam.
 *
 * First (and at D1, only) instrumented surface: the Dev Command Center —
 * operator-ratified 2026-07-06 as "the most developed feedback loop and the
 * most vertically integrated surface, from the Bitcoin substrate to the
 * metaMe runtime". The `dev*Event` helpers below are that surface's typed
 * emission vocabulary.
 *
 * Tier discipline (Identity & Access Spine — non-negotiable): payloads carry
 * T2-safe summaries ONLY — event kind + capsule/stage ids + a short label.
 * NEVER personaId / authProfileId / rootDid, never full artefact bodies,
 * never raw storage URLs. The DcirEvent contract (types/dcir.ts) makes T0
 * inexpressible; this module keeps the summaries honest.
 *
 * Session scope (honest D1 limit): the log is in-session client state — a
 * capped ring buffer, no persistence, no receipts (receipts remain the
 * consequential subset per CFS-020 §8). Event ids are therefore
 * session-local at D1; the DcirEvent contract's "server-issued" id becomes
 * real when events gain a server lifecycle in a later increment.
 *
 * Isomorphic: no fs, no DB, no React — safe for the client tab (emission +
 * buffering) and the chat route (observation rendering).
 */

import type { DcirEvent, DcirEventKind, DcirEventTier, DcirRuntime } from '@/types/dcir';

// ─── Bounds (canary-pinned in tests/dev-command-center.test.ts) ─────────────

/** Ring-buffer cap: the in-session log never holds more than this many events. */
export const DCIR_EVENT_BUFFER_CAP = 50;

/** Hard bound on an event summary — a summary is a label, never a body. */
export const DCIR_EVENT_SUMMARY_MAX = 140;

/** How many events the observation seam feeds the next copilot turn. */
export const DCIR_OBSERVATION_WINDOW = 12;

/** Bound on a single rendered observation line in the ground truth block. */
export const DCIR_OBSERVATION_LINE_MAX = 200;

// ─── Emission ───────────────────────────────────────────────────────────────

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `dcir-evt-${Date.now().toString(36)}-${eventCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export interface EmitDcirEventInput {
  kind: DcirEventKind;
  runtime: DcirRuntime;
  /** T2-safe summary — kind + capsule/stage ids + short label ONLY. */
  summary: string;
  tier?: DcirEventTier;
  artefactRefs?: string[];
  capsuleScope?: string | null;
}

/**
 * Build a DcirEvent. Pure construction — no I/O, no global log: the caller
 * owns the buffer (React state on the client) via `appendDcirEvent`.
 * Summaries are truncated to the hard bound; the tier defaults to
 * 't1-browser-safe' (the session-scoped D1 ceiling — nothing here is
 * DVN-bound).
 */
export function emitDcirEvent(input: EmitDcirEventInput): DcirEvent {
  return {
    id: nextEventId(),
    kind: input.kind,
    runtime: input.runtime,
    summary: input.summary.slice(0, DCIR_EVENT_SUMMARY_MAX),
    tier: input.tier ?? 't1-browser-safe',
    artefactRefs: input.artefactRefs ?? [],
    capsuleScope: input.capsuleScope ?? null,
    occurredAt: new Date().toISOString(),
  };
}

/**
 * Append an event to the in-session log, enforcing the ring-buffer cap
 * (oldest events fall off). Pure: returns a new array — drop-in for a React
 * functional state update.
 */
export function appendDcirEvent(log: readonly DcirEvent[], event: DcirEvent): DcirEvent[] {
  const next = [...log, event];
  return next.length > DCIR_EVENT_BUFFER_CAP ? next.slice(next.length - DCIR_EVENT_BUFFER_CAP) : next;
}

// ─── Dev Command Center typed helpers (the D1 surface's vocabulary) ─────────
// Each wraps an EXISTING seam — no behavior change on the surface. Payloads
// are kind + capsule/stage ids + short label; nothing else travels.

/** aigentZ produced a structured stage proposal (ICE engine fence extracted). */
export function devStageProposalReceivedEvent(proposalKind: string, capsule: string): DcirEvent {
  return emitDcirEvent({
    kind: 'ToolOutputProduced',
    runtime: 'conversational',
    summary: `stage proposal received: ${proposalKind}`,
    capsuleScope: capsule,
  });
}

/** Operator approved a pending stage proposal. */
export function devProposalApprovedEvent(proposalKind: string, capsule: string): DcirEvent {
  return emitDcirEvent({
    kind: 'RecommendationAccepted',
    runtime: 'observation',
    summary: `proposal approved: ${proposalKind}`,
    capsuleScope: capsule,
  });
}

/** Operator dismissed a pending stage proposal. */
export function devProposalDismissedEvent(proposalKind: string, capsule: string): DcirEvent {
  return emitDcirEvent({
    kind: 'RecommendationRejected',
    runtime: 'observation',
    summary: `proposal dismissed: ${proposalKind}`,
    capsuleScope: capsule,
  });
}

/** The dev-loop stage strip advanced (any path: Advance, approve-with-advance, intent restart). */
export function devStageAdvancedEvent(fromStage: string, toStage: string): DcirEvent {
  return emitDcirEvent({
    kind: 'WorkflowAdvanced',
    runtime: 'observation',
    summary: `stage advanced: ${fromStage} → ${toStage}`,
    capsuleScope: null,
  });
}

/** Operator opened a capability capsule. */
export function devCapsuleOpenedEvent(capsule: string): DcirEvent {
  return emitDcirEvent({
    kind: 'NavigationOccurred',
    runtime: 'observation',
    summary: `capsule opened: ${capsule}`,
    capsuleScope: capsule,
  });
}

/** Operator closed a capability capsule (returned to the stack). */
export function devCapsuleClosedEvent(capsule: string): DcirEvent {
  return emitDcirEvent({
    kind: 'NavigationOccurred',
    runtime: 'observation',
    summary: `capsule closed: ${capsule}`,
    capsuleScope: capsule,
  });
}

/** The constitutional pipeline generated an implementation pack (artefact produced). */
export function devImplementationPackGeneratedEvent(): DcirEvent {
  return emitDcirEvent({
    kind: 'DocumentCreated',
    runtime: 'action',
    summary: 'implementation pack generated (constitutional pipeline)',
    capsuleScope: 'implementation',
  });
}

/** Operator recorded a deployment proposal (CFS-016 D1 provenance record). */
export function devDeploymentProposedEvent(): DcirEvent {
  return emitDcirEvent({
    kind: 'SystemEvent',
    runtime: 'action',
    summary: 'deployment proposed (provenance receipt recorded)',
    capsuleScope: 'implementation',
  });
}

/**
 * The auto-act control auto-executed a navigation affordance (opt-in policy,
 * ratified 2026-07-07). Observed so the DCIR seam sees every auto-act. T2-safe:
 * the affordance LABEL + capsule SCOPE only — never a T0 identifier, never a
 * body. `runtime: 'action'` marks that the runtime acted (bounded to the
 * navigation class by resolveAutoActable at the call site).
 */
export function devAutoActedEvent(label: string, scope: string): DcirEvent {
  return emitDcirEvent({
    kind: 'SystemEvent',
    runtime: 'action',
    summary: `auto-acted (navigation): ${label}`,
    capsuleScope: scope,
  });
}

// ─── Generic surface helpers (second-surface vocabulary, CFS-020 D1+) ───────
// Added by composition for the CCRL research copilot (CFS-019 C2): each is a
// thin wrapper over emitDcirEvent — the Dev Command Center helpers above are
// UNTOUCHED. The emitting surface rides capsuleScope so observations stay
// scoped to their surface (capsule containment applied to observation).
// Same observe-mode discipline: nothing blocks, summaries are T2-safe labels.

/** Operator opened an instrumented surface (tab mounted). */
export function surfaceOpenedEvent(surface: string): DcirEvent {
  return emitDcirEvent({
    kind: 'NavigationOccurred',
    runtime: 'observation',
    summary: `surface opened: ${surface}`,
    capsuleScope: surface,
  });
}

/** A surface's observed data refreshed — label is a count/summary, never a body. */
export function surfaceDataRefreshedEvent(surface: string, label: string): DcirEvent {
  return emitDcirEvent({
    kind: 'SystemEvent',
    runtime: 'observation',
    summary: `data refreshed: ${label}`,
    capsuleScope: surface,
  });
}

/** Operator selected a copilot quick prompt — the chip label only, never the prompt body. */
export function surfacePromptSelectedEvent(surface: string, label: string): DcirEvent {
  return emitDcirEvent({
    kind: 'ConversationTurn',
    runtime: 'conversational',
    summary: `quick prompt selected: ${label}`,
    capsuleScope: surface,
  });
}

/**
 * A Dev Command Center tool viewport was used (CFS-020 CDE — Terminal, GitHub,
 * DevTools, Linear). Observe-mode only: the runtime saw a read-only tool op.
 * T2-safe: the tool id + a short op label ONLY — NEVER command arguments, file
 * contents, env values, or any T0 identifier (the Terminal, e.g., passes the
 * first token `terminal: status`, never the full command line). `runtime:
 * 'action'` marks that a tool produced output; the ops are all read-only.
 */
export function devToolUsedEvent(tool: string, op: string): DcirEvent {
  return emitDcirEvent({
    kind: 'ToolOutputProduced',
    runtime: 'action',
    summary: `${tool}: ${op}`,
    capsuleScope: tool,
  });
}

// ─── aigentMe welcome surface typed helpers (CFS-020 D1+, first expansion) ──
// Second instrumented surface after the Dev Command Center (operator direction
// 2026-07: "once we're happy with DCIR we can then expand it to aigentMe and
// the studio composer"). Same observe-mode discipline: each wraps an EXISTING
// aigentMe seam — nothing blocks, nothing mutates the Capsule↔Layout contract.
// Payloads are kind + capsule + category labels (artifactType / destination /
// connector label / specialist id) — NEVER the artifact body, title, or any T0
// identifier. `capsule opened:` summaries align with the stateEngine revisit
// miner so aigentMe capsule revisits are observed the same way dev ones are.

/** Operator engaged an aigentMe Capsule (brief/move-forward/venture-progress/ask-specialists). */
export function aigentMeCapsuleEngagedEvent(capsule: string): DcirEvent {
  return emitDcirEvent({
    kind: 'NavigationOccurred',
    runtime: 'observation',
    summary: `capsule opened: ${capsule}`,
    capsuleScope: capsule,
  });
}

/** Operator sent a drafted artifact pill to its connector — category + destination only. */
export function aigentMeArtifactSentEvent(artifactType: string, destination: string): DcirEvent {
  return emitDcirEvent({
    kind: 'ArtifactApproved',
    runtime: 'action',
    summary: `artifact sent: ${artifactType} → ${destination}`,
    capsuleScope: 'brief',
  });
}

/** Operator dismissed a drafted artifact pill — category label only. */
export function aigentMeArtifactDismissedEvent(artifactType: string): DcirEvent {
  return emitDcirEvent({
    kind: 'ArtifactRejected',
    runtime: 'observation',
    summary: `artifact dismissed: ${artifactType}`,
    capsuleScope: 'brief',
  });
}

/** Operator granted the second-tier approval for an external connector action. */
export function aigentMeSecondTierApprovedEvent(connectorLabel: string): DcirEvent {
  return emitDcirEvent({
    kind: 'RecommendationAccepted',
    runtime: 'observation',
    summary: `second-tier approval granted: ${connectorLabel}`,
    capsuleScope: 'brief',
  });
}

/** Operator cancelled a pending second-tier approval. */
export function aigentMeSecondTierCancelledEvent(): DcirEvent {
  return emitDcirEvent({
    kind: 'RecommendationRejected',
    runtime: 'observation',
    summary: 'second-tier approval cancelled',
    capsuleScope: 'brief',
  });
}

/** Operator marked a queued NBA pill complete (explicit lifecycle control). */
export function aigentMePillCompletedEvent(): DcirEvent {
  return emitDcirEvent({
    kind: 'WorkflowAdvanced',
    runtime: 'observation',
    summary: 'pill marked complete',
    capsuleScope: 'move-forward',
  });
}

/** A specialist produced a consultation response — specialist id only, never the body. */
export function aigentMeSpecialistConsultedEvent(specialistId: string): DcirEvent {
  return emitDcirEvent({
    kind: 'ToolOutputProduced',
    runtime: 'conversational',
    summary: `specialist consulted: ${specialistId}`,
    capsuleScope: 'ask-specialists',
  });
}

// ─── Studio Composer typed helpers (CFS-020 D1+, third surface) ─────────────
// Third instrumented surface after the Dev Command Center and the aigentMe
// welcome (operator direction 2026-07: "once we're happy with DCIR we can
// then expand it to aigentMe and the studio composer"). Same observe-mode
// discipline: each wraps an EXISTING ComposerStudio seam as a side-effect —
// nothing blocks a render, gates an affordance, or auto-acts. Payloads are
// kind + short CATEGORY labels (template slug / skill kind / provider id /
// preview device) — NEVER an experience name, prompt body, asset URL, or any
// T0 identifier. The generic surface helpers above don't fit these moments
// (they are workflow/artefact/skill lifecycle, not open/refresh/prompt), so
// these are added by composition in the same style as the aigentMe set.

/** Operator started a composition session from a template — template slug only. */
export function studioSessionStartedEvent(templateKind: string): DcirEvent {
  return emitDcirEvent({
    kind: 'WorkflowAdvanced',
    runtime: 'observation',
    summary: `composition session started: ${templateKind}`,
    capsuleScope: 'composer-session',
  });
}

/** A composition session completed and produced an experience — template slug only, never the experience name. */
export function studioExperienceComposedEvent(templateKind: string): DcirEvent {
  return emitDcirEvent({
    kind: 'DocumentCreated',
    runtime: 'action',
    summary: `experience composed: ${templateKind}`,
    capsuleScope: 'composer-session',
  });
}

/** A generation skill produced output — skill kind + provider id only, never the prompt or asset URL. */
export function studioSkillOutputEvent(skillKind: string, provider?: string | null): DcirEvent {
  return emitDcirEvent({
    kind: 'ToolOutputProduced',
    runtime: 'action',
    summary: `skill output produced: ${skillKind}${provider ? ` (${provider})` : ''}`,
    capsuleScope: 'production',
  });
}

/** Operator published/handed off an experience to the registry (codex handoff). */
export function studioExperiencePublishedEvent(): DcirEvent {
  return emitDcirEvent({
    kind: 'SystemEvent',
    runtime: 'action',
    summary: 'experience published to registry',
    capsuleScope: 'publish',
  });
}

/** The runtime preview rendered — device class only. */
export function studioPreviewRenderedEvent(device: string): DcirEvent {
  return emitDcirEvent({
    kind: 'SystemEvent',
    runtime: 'observation',
    summary: `preview rendered: ${device}`,
    capsuleScope: 'preview',
  });
}

// ─── Registry asset-detail typed helpers (CFS-020 D4 frontier, fifth surface) ─
// The registry asset-detail panel is the first frontier surface adopted beyond
// the four hand-wired ones (Dev Command Center, aigentMe welcome, studio
// composer, CCRL research copilot) — the D4 "adopt via useDcirSeam by
// declaration" recipe applied to a cartridge-adjacent surface. Same observe-mode
// discipline: each wraps an EXISTING AssetDetailPanel action as a side-effect,
// nothing blocks a render or gates an affordance. Payloads are kind + short
// CATEGORY labels (asset class, trust band, agent display name) — NEVER an
// assetId, personaId, storage URL, or any T0 identifier. capsuleScope is the
// stable surface scope 'asset-detail' so the D3 generic derivation can surface a
// "review the asset-detail output" affordance after a validation runs.

/** Operator opened an asset in the detail panel — asset class only. */
export function registryAssetOpenedEvent(assetClass: string): DcirEvent {
  return emitDcirEvent({
    kind: 'NavigationOccurred',
    runtime: 'observation',
    summary: `registry asset opened: ${assetClass}`,
    capsuleScope: 'asset-detail',
  });
}

/** A validation qube was recomputed for the asset — produced output (review-able). */
export function registryValidationRunEvent(): DcirEvent {
  return emitDcirEvent({
    kind: 'ToolOutputProduced',
    runtime: 'action',
    summary: 'registry validation qube computed',
    capsuleScope: 'asset-detail',
  });
}

/** Operator submitted a trust review — requested band only, never the notes. */
export function registryReviewSubmittedEvent(requestedBand: string): DcirEvent {
  return emitDcirEvent({
    kind: 'ArtifactApproved',
    runtime: 'action',
    summary: `registry review submitted: ${requestedBand}`,
    capsuleScope: 'asset-detail',
  });
}

/** The asset was published to the registry. */
export function registryAssetPublishedEvent(): DcirEvent {
  return emitDcirEvent({
    kind: 'SystemEvent',
    runtime: 'action',
    summary: 'registry asset published',
    capsuleScope: 'asset-detail',
  });
}

/** Operator opened the asset copilot — agent display name only (T1-safe). */
export function registryCopilotOpenedEvent(agentName: string): DcirEvent {
  return emitDcirEvent({
    kind: 'NavigationOccurred',
    runtime: 'observation',
    summary: `registry asset copilot opened: ${agentName}`,
    capsuleScope: 'asset-detail',
  });
}

// ─── Observation seam (ground-context rendering) ────────────────────────────

/**
 * Compact the newest events into short strings for `copilotGroundContext.
 * recentEvents` — the observation the NEXT copilot turn reads. Newest last.
 */
export function compactDcirEvents(
  log: readonly DcirEvent[],
  limit: number = DCIR_OBSERVATION_WINDOW,
): string[] {
  return log
    .slice(-limit)
    .map((e) => `${e.kind} · ${e.summary}${e.capsuleScope ? ` [${e.capsuleScope}]` : ''}`);
}

/**
 * Bound and sanitise a groundContext `recentEvents` payload for the ground
 * truth block (server-side, chat route). Defensive on shape — the value
 * arrives as untyped JSON from the client: non-arrays yield [], non-string
 * entries are dropped, at most DCIR_OBSERVATION_WINDOW lines, each line
 * truncated to DCIR_OBSERVATION_LINE_MAX chars. Narrate-only: the caller
 * labels these as observations, never commands.
 */
export function renderObservationLines(
  recentEvents: unknown,
  limit: number = DCIR_OBSERVATION_WINDOW,
): string[] {
  if (!Array.isArray(recentEvents)) return [];
  return recentEvents
    .filter((e): e is string => typeof e === 'string' && e.length > 0)
    .slice(0, limit)
    .map((e) => e.slice(0, DCIR_OBSERVATION_LINE_MAX));
}
