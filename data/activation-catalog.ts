/**
 * Activation catalog — the canonical list of runtime surfaces a persona
 * can switch on inside the metaMe cartridge.
 *
 * Each entry maps to:
 *   - the tab/group it surfaces in the metaMe codex
 *   - the gate that controls activation
 *   - whether the surface auto-grants on first read
 *
 * `tabSlug` is the slug in the metaMe codex that should become visible
 * when the activation is `active` for the persona. `CodexPanelDynamic`
 * reads this mapping to gate tab visibility.
 *
 * The catalog is static — adding or removing entries is a code change.
 * Cohort definitions and payment / token gating live elsewhere; the
 * `gate` here is just the high-level mode.
 */

import type { ActiveCartridgeSlug } from '@/services/iqube/experienceQube';

export type ActivationGate = 'open' | 'gated';

// ── Activation-exposed metrics + actions (Phase 2 B.1 / B.2) ───────────
//
// Each activation entry below optionally declares the KPIs and NBAs it
// makes available. The KPI editor and NBA catalogue read these directly
// from the catalog at runtime, filtered to the activations the persona
// has in `active` status. Adding a new activation (or a new metric /
// action on an existing one) is a one-row edit here — no other code
// change needed in the KPI / NBA layers.
//
// This is what makes the cockpit dynamically driven by the persona's
// own Activations tab configuration: framework lives in code, content
// is whatever the persona has plugged in.

export type ActivationMetricQuery =
  | { kind: 'receipts'; eventType: string }
  | { kind: 'sql'; table: string; where?: Record<string, string> };

export interface ActivationMetric {
  /** Metric key — unique per activationId (`weekly_actives`). */
  metric: string;
  label: string;
  /** Default unit (overridable on the KPI record). */
  defaultUnit?: string;
  query: ActivationMetricQuery;
}

export interface ActivationAction {
  /** Action key — unique per activationId (`draft-outreach`). */
  action: string;
  label: string;
  /** One-line rationale displayed on the action card. */
  rationale: string;
  /** Which specialist takes the hand-off (when present). */
  specialist?: 'marketa' | 'quill' | 'kn0w1' | 'aigent-z' | 'aigent-c' | 'aigent-nakamoto';
  /** Approval required before queueing. */
  approvalRequired?: boolean;
}

export interface ActivationCatalogEntry {
  /** Stable id — persisted in persona_activations.activation_id. */
  id: string;
  label: string;
  description: string;
  longDescription: string;
  gate: ActivationGate;
  tabSlug: string;
  sourceCartridge: ActiveCartridgeSlug | 'metame';
  icon?: string;
  color?: string;
  /** KPI metrics this activation exposes. Empty / undefined = none. */
  metrics?: ActivationMetric[];
  /** NBAs this activation exposes. Empty / undefined = none. */
  actions?: ActivationAction[];
}

export const ACTIVATION_CATALOG: ActivationCatalogEntry[] = [
  {
    id: 'mycanvas',
    label: 'myCanvas',
    description: 'Your private publishing surface for works-in-progress and ideas.',
    longDescription:
      'A personal surface to publish drafts, half-formed thoughts, and works-in-progress that aigentMe or the Studio produces with you. Private by default — invite specific people, or later republish into a community surface or social platform.',
    gate: 'open',
    tabSlug: 'mycanvas',
    sourceCartridge: 'metame',
    icon: 'PenSquare',
    color: 'violet',
    metrics: [
      { metric: 'entries_published', label: 'Entries published', defaultUnit: 'entries', query: { kind: 'receipts', eventType: 'mycanvas.entry.published' } },
      { metric: 'invites_sent',      label: 'Invites sent',      defaultUnit: 'invites', query: { kind: 'receipts', eventType: 'mycanvas.invite.sent' } },
    ],
    actions: [
      { action: 'draft-canvas-entry', label: 'Draft a new canvas entry', rationale: 'Capture a thought before it slips. Aigent C drafts the canvas entry; you publish when ready.', specialist: 'aigent-c' },
    ],
  },
  {
    id: 'order-of-metaye',
    label: 'Order of Metayé',
    description: 'Active surface of the KNYT world — Order rituals, missions, and standing.',
    longDescription:
      'The participation layer of the KNYT cartridge. Surfaces the Order tab and its sub-tabs (rituals, standing, and missions) directly inside metaMe.',
    gate: 'open',
    tabSlug: 'order-of-metaye',
    sourceCartridge: 'knyt',
    icon: 'Shield',
    color: 'amber',
    metrics: [
      { metric: 'rituals_completed', label: 'Rituals completed', defaultUnit: 'rituals', query: { kind: 'receipts', eventType: 'knyt.ritual.completed' } },
      { metric: 'missions_active',   label: 'Active missions',   defaultUnit: 'missions', query: { kind: 'receipts', eventType: 'knyt.mission.advanced' } },
      { metric: 'standing_score',    label: 'Standing score',    defaultUnit: 'pts',     query: { kind: 'receipts', eventType: 'knyt.standing.granted' } },
    ],
    actions: [
      { action: 'advance-mission',   label: 'Advance the next mission', rationale: 'Aigent Kn0w1 surfaces the next Order mission you can act on.', specialist: 'kn0w1' },
      { action: 'claim-standing',    label: 'Claim earned standing', rationale: 'Convert eligible work into Order standing.', specialist: 'kn0w1', approvalRequired: true },
    ],
  },
  {
    id: 'agentiq-os',
    label: 'AgentiQ OS',
    description: 'Build, bind, and deploy your own agents on the AgentiQ runtime.',
    longDescription:
      'Activate the AgentiQ OS surfaces — Home, Docs, Build, Bind, Deploy, Missions, and Community — so you can spin up your own agents, connect them to iQubes, and ship them into the network from inside metaMe.',
    gate: 'open',
    tabSlug: 'agentiqos',
    sourceCartridge: 'metame',
    icon: 'Cpu',
    color: 'cyan',
    metrics: [
      { metric: 'intents_queued',    label: 'Intents queued',    defaultUnit: 'intents',   query: { kind: 'receipts', eventType: 'intent.created' } },
      { metric: 'artifacts_created', label: 'Artifacts created', defaultUnit: 'artifacts', query: { kind: 'receipts', eventType: 'artifact.created' } },
      { metric: 'agents_deployed',   label: 'Agents deployed',   defaultUnit: 'agents',    query: { kind: 'receipts', eventType: 'agent.deployed' } },
    ],
    actions: [
      { action: 'build-agent',       label: 'Build a new agent', rationale: 'Spin up a custom agent and bind it to iQubes you own.', specialist: 'aigent-z' },
    ],
  },
  {
    id: 'qriptopian',
    label: 'Qriptopian',
    description: 'The editorial surface — frame moments, briefs, and angles with Quill.',
    longDescription:
      'Activate the Qriptopian active surfaces so you can collaborate with Quill on editorial angles, issue briefs, and longer-form narrative work that ties back to your venture motion.',
    gate: 'open',
    tabSlug: 'qriptopian',
    sourceCartridge: 'qriptopian',
    icon: 'Globe',
    color: 'slate',
    metrics: [
      { metric: 'briefs_published', label: 'Briefs published', defaultUnit: 'briefs', query: { kind: 'receipts', eventType: 'qriptopian.brief.published' } },
      { metric: 'angles_drafted',   label: 'Angles drafted',   defaultUnit: 'angles', query: { kind: 'receipts', eventType: 'qriptopian.angle.drafted' } },
    ],
    actions: [
      { action: 'draft-angle', label: 'Draft an editorial angle', rationale: 'Quill drafts an angle on a moment you want to frame.', specialist: 'quill' },
      { action: 'publish-brief', label: 'Publish a brief', rationale: 'Move a drafted brief through review and into the feed.', specialist: 'quill', approvalRequired: true },
    ],
  },
  {
    id: 'venture-lab',
    label: 'Venture Lab',
    description: 'Venture-building workspace — KPIs, partners, and runway moves.',
    longDescription:
      'Operate your venture through the AgentiQ Venture Lab α surfaces — track KPIs, manage priority partners and campaigns, generate venture progress reports, and run the alpha-activation checkpoints with Aigent Z.',
    gate: 'gated',
    tabSlug: 'venture-lab',
    sourceCartridge: 'avl',
    icon: 'TrendingUp',
    color: 'emerald',
    metrics: [
      { metric: 'workstreams_in_progress', label: 'Workstreams in progress', defaultUnit: 'workstreams', query: { kind: 'receipts', eventType: 'workstream.advanced' } },
      { metric: 'partners_declared',       label: 'Partners declared',       defaultUnit: 'partners',    query: { kind: 'sql',      table: 'crm_investors', where: { status: 'active' } } },
      { metric: 'progress_reports',        label: 'Progress reports',        defaultUnit: 'reports',     query: { kind: 'receipts', eventType: 'venture.progress_report' } },
    ],
    actions: [
      { action: 'generate-venture-report', label: 'Generate venture progress report', rationale: 'Snapshot operational + commercial KPI movement, blockers, and the next moves.', specialist: 'aigent-z' },
      { action: 'advance-stage',           label: 'Advance to the next stage', rationale: 'Check stage criteria and promote when ready.', specialist: 'aigent-z', approvalRequired: true },
    ],
  },
  {
    id: 'marketa',
    label: 'Marketa',
    description: 'Campaign + partner motion — sequences, proposals, and outreach.',
    longDescription:
      'Activate the Marketa surfaces to draft partner proposals with the Marketa agent, run campaign sequences, and route outreach through the connector pipeline. Invite-only during alpha.',
    gate: 'gated',
    tabSlug: 'marketa',
    sourceCartridge: 'marketa',
    icon: 'Megaphone',
    color: 'rose',
    metrics: [
      { metric: 'campaigns_active', label: 'Active campaigns', defaultUnit: 'campaigns', query: { kind: 'sql',      table: 'crm_campaigns', where: { status: 'active' } } },
      { metric: 'emails_sent',      label: 'Emails sent',      defaultUnit: 'emails',    query: { kind: 'receipts', eventType: 'marketa.email.sent' } },
      { metric: 'partner_replies',  label: 'Partner replies',  defaultUnit: 'replies',   query: { kind: 'receipts', eventType: 'marketa.reply.received' } },
    ],
    actions: [
      { action: 'draft-outreach',    label: 'Draft partner outreach',     rationale: 'Marketa drafts an outreach email to a priority partner.', specialist: 'marketa' },
      { action: 'launch-sequence',   label: 'Launch a campaign sequence', rationale: 'Activate the next campaign sequence; gated by approval.', specialist: 'marketa', approvalRequired: true },
    ],
  },
  {
    id: 'metame-studio',
    label: 'metaMe Studio',
    description: 'Author experiences, briefs, and runtime artifacts at full depth.',
    longDescription:
      'The full-depth authoring surface — build StudioArtifacts (briefs, post-sets, image prompts, video scripts, slide outlines) that flow into your codex and runtime. Invite-only during alpha.',
    gate: 'gated',
    tabSlug: 'metame-studio',
    sourceCartridge: 'metame',
    icon: 'PenTool',
    color: 'indigo',
    metrics: [
      { metric: 'experiences_authored', label: 'Experiences authored', defaultUnit: 'experiences', query: { kind: 'receipts', eventType: 'experience.authored' } },
      { metric: 'studio_artifacts',     label: 'Studio artifacts',     defaultUnit: 'artifacts',   query: { kind: 'receipts', eventType: 'studio.artifact.created' } },
    ],
    actions: [
      { action: 'author-experience', label: 'Author a new experience', rationale: 'Open the Studio composer and start an ExperienceQube.', specialist: 'aigent-z' },
    ],
  },
];

export function getActivationEntry(id: string): ActivationCatalogEntry | null {
  return ACTIVATION_CATALOG.find((e) => e.id === id) ?? null;
}

export function activationIdForTabSlug(slug: string): string | null {
  const hit = ACTIVATION_CATALOG.find((e) => e.tabSlug === slug);
  return hit?.id ?? null;
}

/**
 * Return every metric exposed by activations the persona has in `active`
 * status. Used by the KPI editor's source picker and the resolver.
 */
export function metricsForActiveActivations(
  activeIds: Iterable<string>,
): Array<{ activationId: string; activationLabel: string; metric: ActivationMetric }> {
  const set = new Set(activeIds);
  const out: Array<{ activationId: string; activationLabel: string; metric: ActivationMetric }> = [];
  for (const entry of ACTIVATION_CATALOG) {
    if (!set.has(entry.id)) continue;
    for (const m of entry.metrics ?? []) {
      out.push({ activationId: entry.id, activationLabel: entry.label, metric: m });
    }
  }
  return out;
}

/**
 * Return every action exposed by activations the persona has in `active`
 * status. Used by the NBA catalogue and the Active Work surface.
 */
export function actionsForActiveActivations(
  activeIds: Iterable<string>,
): Array<{ activationId: string; activationLabel: string; cartridge: ActiveCartridgeSlug | 'metame'; action: ActivationAction }> {
  const set = new Set(activeIds);
  const out: Array<{ activationId: string; activationLabel: string; cartridge: ActiveCartridgeSlug | 'metame'; action: ActivationAction }> = [];
  for (const entry of ACTIVATION_CATALOG) {
    if (!set.has(entry.id)) continue;
    for (const a of entry.actions ?? []) {
      out.push({ activationId: entry.id, activationLabel: entry.label, cartridge: entry.sourceCartridge, action: a });
    }
  }
  return out;
}

/**
 * Lookup helpers used by the KPI resolver.
 */
export function findActivationMetric(activationId: string, metric: string): ActivationMetric | null {
  const entry = getActivationEntry(activationId);
  if (!entry) return null;
  return (entry.metrics ?? []).find((m) => m.metric === metric) ?? null;
}
