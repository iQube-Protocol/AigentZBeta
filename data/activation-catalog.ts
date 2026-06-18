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

/**
 * Metric class — distinguishes activity volume (what the operator
 * is doing) from outcome signal (what's actually being achieved).
 * The UI renders outcomes with stronger emphasis so the operator
 * can see lagging value at a glance, not just leading effort.
 *
 *   - 'activity' — counts of actions taken (default; leading indicator)
 *   - 'outcome'  — counts of value-bearing events that an outside party
 *                  responded to (replies, accepts, remixes, conversions)
 *   - 'standing' — accumulated reputation / position metrics
 */
export type ActivationMetricClass = 'activity' | 'outcome' | 'standing';

export interface ActivationMetric {
  /** Metric key — unique per activationId (`weekly_actives`). */
  metric: string;
  label: string;
  /** Default unit (overridable on the KPI record). */
  defaultUnit?: string;
  /** Activity / outcome / standing. Default 'activity'. */
  class?: ActivationMetricClass;
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
      // Activity — what the operator is doing in canvas
      { metric: 'entries_published', class: 'activity', label: 'Entries published', defaultUnit: 'entries', query: { kind: 'receipts', eventType: 'mycanvas.entry.published' } },
      { metric: 'invites_sent',      class: 'activity', label: 'Invites sent',      defaultUnit: 'invites', query: { kind: 'receipts', eventType: 'mycanvas.invite.sent' } },
      // Outcome — what others did with the canvas (the real signal)
      { metric: 'entries_liked',     class: 'outcome',  label: 'Entries liked',     defaultUnit: 'likes',   query: { kind: 'receipts', eventType: 'mycanvas.entry.liked' } },
      { metric: 'entries_sparked',   class: 'outcome',  label: 'Entries sparked',   defaultUnit: 'sparks',  query: { kind: 'receipts', eventType: 'mycanvas.entry.sparked' } },
      { metric: 'entries_remixed',   class: 'outcome',  label: 'Entries remixed',   defaultUnit: 'remixes', query: { kind: 'receipts', eventType: 'mycanvas.entry.remixed' } },
    ],
    actions: [
      { action: 'draft-canvas-entry', label: 'Draft a new canvas entry', rationale: 'Capture a thought before it slips. Aigent C drafts the canvas entry; you publish when ready.', specialist: 'aigent-c' },
    ],
  },
  {
    id: 'order-of-metaye',
    label: 'KNYT',
    description: 'Active surface of the KNYT world — Order rituals, missions, and standing.',
    longDescription:
      'The participation layer of the KNYT cartridge. Surfaces the KNYT tab and its sub-tabs (rituals, standing, and missions) directly inside metaMe. (Activation id `order-of-metaye` retained for back-compat — labelled "KNYT" in the metaMe surface per 2026-05-30 operator decision.)',
    gate: 'open',
    tabSlug: 'order-of-metaye',
    sourceCartridge: 'knyt',
    icon: 'Shield',
    color: 'amber',
    metrics: [
      // Activity — participation volume
      { metric: 'rituals_completed', class: 'activity', label: 'Rituals completed', defaultUnit: 'rituals',  query: { kind: 'receipts', eventType: 'knyt.ritual.completed' } },
      { metric: 'missions_active',   class: 'activity', label: 'Active missions',   defaultUnit: 'missions', query: { kind: 'receipts', eventType: 'knyt.mission.advanced' } },
      { metric: 'votes_cast',        class: 'activity', label: 'Votes cast',        defaultUnit: 'votes',    query: { kind: 'receipts', eventType: 'knyt.vote.cast' } },
      { metric: 'contributions_made',class: 'activity', label: 'Contributions',     defaultUnit: 'contribs', query: { kind: 'receipts', eventType: 'knyt.contribution.recorded' } },
      // Outcome — value the Order acknowledged
      { metric: 'missions_completed',class: 'outcome',  label: 'Missions completed',defaultUnit: 'missions', query: { kind: 'receipts', eventType: 'knyt.mission.completed' } },
      // Standing — accumulated position
      { metric: 'standing_score',    class: 'standing', label: 'Standing score',    defaultUnit: 'pts',      query: { kind: 'receipts', eventType: 'knyt.standing.granted' } },
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
      // Activity — builder work
      { metric: 'intents_queued',    class: 'activity', label: 'Intents queued',    defaultUnit: 'intents',   query: { kind: 'receipts', eventType: 'intent.created' } },
      { metric: 'artifacts_created', class: 'activity', label: 'Artifacts created', defaultUnit: 'artifacts', query: { kind: 'receipts', eventType: 'artifact.created' } },
      // Outcome — developer adoption signal
      { metric: 'agents_deployed',     class: 'outcome',  label: 'Agents deployed',     defaultUnit: 'agents',    query: { kind: 'receipts', eventType: 'agent.deployed' } },
      { metric: 'referrals_instigated',class: 'outcome',  label: 'Referrals instigated',defaultUnit: 'referrals', query: { kind: 'receipts', eventType: 'agentiqos.referral.sent' } },
      { metric: 'sdk_downloads',       class: 'outcome',  label: 'SDK downloads',       defaultUnit: 'downloads', query: { kind: 'receipts', eventType: 'agentiqos.sdk.downloaded' } },
      { metric: 'repo_forks',          class: 'outcome',  label: 'Repo forks',          defaultUnit: 'forks',     query: { kind: 'receipts', eventType: 'agentiqos.repo.forked' } },
    ],
    actions: [
      { action: 'build-agent',       label: 'Build a new agent', rationale: 'Spin up a custom agent and bind it to iQubes you own.', specialist: 'aigent-z' },
    ],
  },
  {
    id: 'aigent-z',
    label: 'aigentZ',
    description: 'Development Command Center — consequence-engineered building with aigentZ.',
    longDescription:
      'Activate the aigentZ Development Command Center — the consequence-engineering workflow that turns raw intent into validated builds. Distill intents, assemble context packs, analyze capability gaps, model consequences, and validate implementations against them, with aigentZ as your copilot through the full dev loop.',
    gate: 'open',
    tabSlug: 'aigent-z',
    sourceCartridge: 'metame',
    icon: 'Cpu',
    color: 'green',
    metrics: [
      // Activity — dev loop motion
      { metric: 'intents_distilled',    class: 'activity', label: 'Intents distilled',    defaultUnit: 'intents',     query: { kind: 'receipts', eventType: 'devloop.intent.distilled' } },
      { metric: 'gap_analyses_run',     class: 'activity', label: 'Gap analyses run',     defaultUnit: 'analyses',    query: { kind: 'receipts', eventType: 'devloop.gap_analysis.completed' } },
      { metric: 'canvases_modeled',     class: 'activity', label: 'Consequence canvases', defaultUnit: 'canvases',    query: { kind: 'receipts', eventType: 'devloop.canvas.modeled' } },
      // Outcome — builds that landed
      { metric: 'validations_passed',   class: 'outcome',  label: 'Validations passed',   defaultUnit: 'validations', query: { kind: 'receipts', eventType: 'devloop.validation.passed' } },
      { metric: 'loops_completed',      class: 'outcome',  label: 'Dev loops completed',  defaultUnit: 'loops',       query: { kind: 'receipts', eventType: 'devloop.completed' } },
    ],
    actions: [
      { action: 'start-dev-intent',   label: 'Start a development intent', rationale: 'aigentZ distills what you want to build into structured intent with users, constraints, and success criteria.', specialist: 'aigent-z' },
      { action: 'validate-build',     label: 'Validate a build',           rationale: 'Run the post-prompt consequence validation against the active canvas.', specialist: 'aigent-z', approvalRequired: true },
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
      // Activity — editorial work
      { metric: 'briefs_published', class: 'activity', label: 'Briefs published', defaultUnit: 'briefs', query: { kind: 'receipts', eventType: 'qriptopian.brief.published' } },
      { metric: 'angles_drafted',   class: 'activity', label: 'Angles drafted',   defaultUnit: 'angles', query: { kind: 'receipts', eventType: 'qriptopian.angle.drafted' } },
      // Outcome — editorial pickup
      { metric: 'brief_readership', class: 'outcome',  label: 'Brief reads',      defaultUnit: 'reads',  query: { kind: 'receipts', eventType: 'qriptopian.brief.read' } },
      { metric: 'angles_picked_up', class: 'outcome',  label: 'Angles picked up', defaultUnit: 'pickups',query: { kind: 'receipts', eventType: 'qriptopian.angle.picked_up' } },
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
      'Operate your venture through the metaMe Venture Lab α surfaces — track KPIs, manage priority partners and campaigns, generate venture progress reports, and run the alpha-activation checkpoints with Aigent Z.',
    gate: 'gated',
    tabSlug: 'venture-lab',
    sourceCartridge: 'mvl',
    icon: 'TrendingUp',
    color: 'emerald',
    metrics: [
      // Activity — venture motion
      { metric: 'workstreams_in_progress', class: 'activity', label: 'Workstreams in progress', defaultUnit: 'workstreams', query: { kind: 'receipts', eventType: 'workstream.advanced' } },
      { metric: 'partners_declared',       class: 'activity', label: 'Partners declared',       defaultUnit: 'partners',    query: { kind: 'sql',      table: 'crm_investors', where: { status: 'active' } } },
      { metric: 'progress_reports',        class: 'activity', label: 'Progress reports',        defaultUnit: 'reports',     query: { kind: 'receipts', eventType: 'venture.progress_report' } },
      // Outcome — venture growth + development markers
      { metric: 'workstreams_completed',   class: 'outcome',  label: 'Workstreams completed',   defaultUnit: 'workstreams', query: { kind: 'receipts', eventType: 'workstream.completed' } },
      { metric: 'milestones_hit',          class: 'outcome',  label: 'Milestones hit',          defaultUnit: 'milestones',  query: { kind: 'receipts', eventType: 'venture.milestone.hit' } },
      { metric: 'partner_conversions',     class: 'outcome',  label: 'Partner conversions',     defaultUnit: 'partners',    query: { kind: 'receipts', eventType: 'venture.partner.converted' } },
      { metric: 'runway_extended_events',  class: 'outcome',  label: 'Runway-extending events', defaultUnit: 'events',      query: { kind: 'receipts', eventType: 'venture.runway.extended' } },
      // Standing — stage position
      { metric: 'stage_advances',          class: 'standing', label: 'Stage advances',          defaultUnit: 'stages',      query: { kind: 'receipts', eventType: 'stage.advanced' } },
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
      // Activity — outbound motion
      { metric: 'campaigns_active', class: 'activity', label: 'Active campaigns', defaultUnit: 'campaigns', query: { kind: 'sql',      table: 'crm_campaigns', where: { status: 'active' } } },
      { metric: 'emails_sent',      class: 'activity', label: 'Emails sent',      defaultUnit: 'emails',    query: { kind: 'receipts', eventType: 'marketa.email.sent' } },
      // Outcome — campaign result signals
      { metric: 'partner_replies',     class: 'outcome', label: 'Partner replies',     defaultUnit: 'replies',     query: { kind: 'receipts', eventType: 'marketa.reply.received' } },
      { metric: 'meetings_booked',     class: 'outcome', label: 'Meetings booked',     defaultUnit: 'meetings',    query: { kind: 'receipts', eventType: 'marketa.meeting.booked' } },
      { metric: 'proposals_accepted',  class: 'outcome', label: 'Proposals accepted',  defaultUnit: 'proposals',   query: { kind: 'receipts', eventType: 'marketa.proposal.accepted' } },
      { metric: 'partnerships_closed', class: 'outcome', label: 'Partnerships closed', defaultUnit: 'partnerships',query: { kind: 'receipts', eventType: 'marketa.partnership.closed' } },
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
      // Activity — authorship work
      { metric: 'experiences_authored', class: 'activity', label: 'Experiences authored', defaultUnit: 'experiences', query: { kind: 'receipts', eventType: 'experience.authored' } },
      { metric: 'studio_artifacts',     class: 'activity', label: 'Studio artifacts',     defaultUnit: 'artifacts',   query: { kind: 'receipts', eventType: 'studio.artifact.created' } },
      // Outcome — experiences that landed
      { metric: 'experiences_launched',     class: 'outcome', label: 'Experiences launched',     defaultUnit: 'experiences', query: { kind: 'receipts', eventType: 'experience.launched' } },
      { metric: 'experiences_remixed',      class: 'outcome', label: 'Experiences remixed',      defaultUnit: 'remixes',     query: { kind: 'receipts', eventType: 'experience.remixed' } },
      { metric: 'experiences_completed_by', class: 'outcome', label: 'Experiences completed by users', defaultUnit: 'completions', query: { kind: 'receipts', eventType: 'experience.completed' } },
    ],
    actions: [
      { action: 'author-experience', label: 'Author a new experience', rationale: 'Open the Studio composer and start an ExperienceQube.', specialist: 'aigent-z' },
    ],
  },
  {
    id: 'polity-passport',
    label: 'Polity Passport',
    description: 'Identity sovereignty — apply for a Polity Passport, manage ENS, delegate to agents.',
    longDescription:
      'Activate the Polity Passport Bureau surfaces inside metaMe — apply for an anonymous Citizen Passport, mint a gasless ENS subname, manage your self-custody Locker, grant bounded delegations to agents, and access human mobility services. Irrevocable proof of personhood with privacy-preserving identity.',
    gate: 'open',
    tabSlug: 'passport-bureau-apply',
    sourceCartridge: 'polity-passport-bureau',
    icon: 'ShieldCheck',
    color: 'violet',
    metrics: [
      { metric: 'passports_issued', class: 'outcome', label: 'Passports issued', defaultUnit: 'passports', query: { kind: 'receipts', eventType: 'passport.issued' } },
      { metric: 'delegations_granted', class: 'activity', label: 'Delegations granted', defaultUnit: 'delegations', query: { kind: 'receipts', eventType: 'passport.delegation.granted' } },
      { metric: 'ens_names_minted', class: 'outcome', label: 'ENS names minted', defaultUnit: 'names', query: { kind: 'receipts', eventType: 'passport.ens.minted' } },
      { metric: 'locker_items_stored', class: 'activity', label: 'Locker items stored', defaultUnit: 'items', query: { kind: 'receipts', eventType: 'passport.locker.stored' } },
    ],
    actions: [
      { action: 'apply-passport', label: 'Apply for a Citizen Passport', rationale: 'Start the passport application flow — anonymous, self-custody, irrevocable.', specialist: 'aigent-z' },
      { action: 'mint-ens', label: 'Mint an ENS subname', rationale: 'Claim a gasless L2 ENS identity under polity.eth.', specialist: 'aigent-z' },
    ],
  },
  {
    id: 'standing-cartridge',
    label: 'Standing Cartridge',
    description: 'Your personal capability & standing ledger — evidence-derived, principal-verified, anchored to your Polity Passport.',
    longDescription:
      'The Standing Cartridge is your reusable capability and standing primitive. Upload evidence documents — CVs, publications, patents, media appearances, speaking engagements, reference letters — and the system extracts candidate facts for your review. Once approved and compiled, your Verified Standing Profile (VSP) becomes the authoritative source for mobility applications, immigration petitions, professional biographies, CVs, investor profiles, and future Polity services. The Standing Cartridge is anchored to your KybeDID and travels across your entire persona estate.',
    gate: 'open',
    tabSlug: 'standing',
    sourceCartridge: 'standing-cartridge',
    icon: 'Star',
    color: 'violet',
    metrics: [
      { metric: 'facts_approved', class: 'outcome', label: 'Facts approved', defaultUnit: 'facts', query: { kind: 'receipts', eventType: 'vsp.fact.approved' } },
      { metric: 'profiles_compiled', class: 'outcome', label: 'Profiles compiled', defaultUnit: 'profiles', query: { kind: 'receipts', eventType: 'vsp.profile.compiled' } },
      { metric: 'outputs_generated', class: 'activity', label: 'Outputs generated', defaultUnit: 'outputs', query: { kind: 'receipts', eventType: 'vsp.output.generated' } },
    ],
    actions: [
      { action: 'add-evidence', label: 'Add evidence document', rationale: 'Upload a document — CV, publication, patent, reference letter — for fact extraction.', specialist: 'aigent-z' },
      { action: 'compile-vsp', label: 'Compile Verified Standing Profile', rationale: 'Lock approved facts into a portable VSP anchored to your Polity Passport.', specialist: 'aigent-z', approvalRequired: true },
      { action: 'generate-output', label: 'Generate professional output', rationale: 'Derive a biography, CV, or capability assessment from your compiled VSP.', specialist: 'aigent-z' },
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
 * Return every activation id whose `gate` is `open` — these are the
 * surfaces a persona auto-grants on first read (no explicit consent
 * required). Used by the admin/assistant diag routes and the
 * personaActivations bootstrap to populate the open-gate set.
 */
export function listAutoGrantActivationIds(): string[] {
  return ACTIVATION_CATALOG.filter((e) => e.gate === 'open').map((e) => e.id);
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
