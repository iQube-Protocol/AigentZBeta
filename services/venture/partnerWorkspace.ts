/**
 * partnerWorkspace — the Partner Workspace registry (Venture Lab).
 *
 * The Partner Workspace is an ABSTRACTION, not an application: a pilot
 * workspace composed from existing Venture Lab capabilities (Partner,
 * Objectives, Collaborate, Operate, Evidence, Communicate). Nothing here
 * invents a capability — the registry only names the partner instance and
 * points at the platform surfaces that already deliver each concern.
 *
 * THIS LIST IS THE SINGLE AUTHORITATIVE SOURCE (inv.engineering.036) for
 * partner workspaces. Every surface that renders partner-programme state
 * (PartnerProgrammesTab today; any future surface) derives from it — a second
 * partner list anywhere is a defect (inv.engineering.037). The canary lives
 * in tests/partner-workspace.test.ts.
 *
 * First instantiation: Horizen — Pilot Series 001 (CRP-003a / CFSP, Chrysalis
 * tracker #98; constitutional context #80). Instantiating the next partner
 * (Project Liberty, Lamina1, Secret, BlockC) is ONE new entry here — same
 * architecture, different participants.
 *
 * Identity note (operator ruling, 2026-07-26): the KNYT campaign Wave-1
 * partner "Horizen" and this pilot's partner ARE the same organization, and
 * the relationship is an AgentiQ/metaMe partnership (not a KNYT one) — the
 * previously-open question recorded in tracker #80 is resolved. The
 * `partnershipContext` field records this ruling as data.
 */

import { RUNTIME_AGENT_IDS } from '@/services/metame/agentLlmOrchestra';
import { getAigentQubeSource } from '@/services/iqube/legibility/sources/aigentQubeSource';
import type { AgentRoleId } from '@/types/orchestration';
import type { HorizenNetwork } from '@/services/horizen/identity';

// ─── Layer model — the ratified agent division of labour, AS DATA ────────────

export const PARTNER_WORKSPACE_LAYERS = [
  'operations',
  'relationship',
  'financial-services',
  'knowledge',
  'customer-experience',
  'governance',
] as const;
export type PartnerWorkspaceLayer = (typeof PARTNER_WORKSPACE_LAYERS)[number];

/**
 * A layer owner is a REAL agent identifier from the codebase's canonical
 * vocabulary — either a runtime aigent (`RUNTIME_AGENT_IDS`, the LLM-bound
 * orchestra ids) or one of the two orchestration/constitutional role ids that
 * have no LLM runtime binding today:
 *
 *  - 'aigent-c'        — AgentRoleId (types/orchestration.ts) + SpecialistId
 *                        (services/agents/specialistRouter.ts). Customer guide.
 *  - 'metame-guardian' — AgentRoleId (types/orchestration.ts) + the
 *                        runtimeRoleId of METAME_GUARDIAN in
 *                        services/governance/sovereignAgentRoles.ts.
 *
 * `Extract` ties the two role ids to the real AgentRoleId union so a rename
 * upstream breaks this type rather than silently orphaning the owner id.
 * Never an invented id — layers with no real owner id are recorded as null.
 */
export type PartnerLayerOwnerId =
  | (typeof RUNTIME_AGENT_IDS)[number]
  | Extract<AgentRoleId, 'aigent-c' | 'metame-guardian'>;

/**
 * The pilot phase ladder, IN ORDER, as a runtime value.
 *
 * Declared as a const array (and the type derived from it) rather than as a
 * bare union, for the same reason `PARTNER_WORKSPACE_LAYERS` is: the shared
 * lifecycle registry (`services/experiments/workspaceLifecycle.ts`) needs the
 * venture ladder at RUNTIME to build the `venture-pilot` template, and a
 * hand-copied stage list there would be the stale-duplicate defect
 * `tests/source-of-truth-parity.test.ts` indexes. The union type is unchanged
 * in every member and in order, so nothing that consumes
 * `PartnerWorkspacePhase` is affected.
 */
export const PARTNER_WORKSPACE_PHASES = [
  'exploration',
  'agreement',
  'integration',
  'operation',
  'evidence',
] as const;
export type PartnerWorkspacePhase = (typeof PARTNER_WORKSPACE_PHASES)[number];

// ─── Link descriptors — consumed ONLY via buildCodexUrl() ────────────────────

/**
 * A deep link into the existing home of a capability. Descriptors carry the
 * codex slug + tab slug; the SURFACE builds the URL with `buildCodexUrl()`
 * (utils/codex-nav.ts) so identity propagation (personaId/isAdmin) follows the
 * canonical inter-cartridge rule. Raw URLs are never stored here.
 *
 * `area` maps the link onto the workspace's sub-surfaces so those sections
 * also derive from this registry rather than declaring their own lists.
 */
export interface PartnerWorkspaceLink {
  id: string;
  label: string;
  description: string;
  /** Codex slug/id accepted by buildCodexUrl (e.g. 'alpha-knyt', 'marketa'). */
  codexSlug: string;
  /** Tab slug inside the target codex; omit to land on the codex default. */
  tab?: string;
  area: 'overview' | 'operate' | 'evidence' | 'communicate';
}

// ─── External agent identities this workspace's evidence chain covers ────────

/**
 * A partner-side agent identity whose joined evidence chain this workspace
 * surfaces (Slice B).
 *
 * NETWORK-QUALIFIED, ALWAYS. `services/horizen/identity.ts` §4.4: the same
 * tokenId names DIFFERENT agents on Base Sepolia and Base Mainnet, so there is
 * no `registryAlias`-only form of this descriptor — the network is part of the
 * identity, not a qualifier on it.
 *
 * `registryAlias` is the registry's own hex rendering; the read path normalises
 * it to the canonical decimal tokenId. Storing the alias rather than the
 * tokenId keeps this list in the vocabulary the Registry REST API accepts, so
 * no caller has to convert before reading.
 */
export interface PartnerReferenceAgent {
  /** Registry hex alias, e.g. `0x1eba` (Horizen brief §2.4.1 / §3). */
  registryAlias: string;
  network: HorizenNetwork;
  /** Operator-facing name for the row. Never a claim about the agent. */
  label: string;
}

// ─── The workspace shape ─────────────────────────────────────────────────────

export interface PartnerWorkspace {
  id: string;
  partnerName: string;
  /** Pilot series identifier (e.g. '001'). */
  series: string;
  objectives: string[];
  phase: PartnerWorkspacePhase;
  /** Workspace owner + orchestrator (Chief of Staff). */
  ownerAgentId: PartnerLayerOwnerId;
  /**
   * Which platform relationship the partnership lives under (operator ruling
   * 2026-07-26: Horizen is an AgentiQ/metaMe partnership).
   */
  partnershipContext: 'agentiq-metame';
  /** The ratified agent division of labour; null = no real owner id exists. */
  layerOwners: Record<PartnerWorkspaceLayer, PartnerLayerOwnerId | null>;
  /** Partner contacts — omitted until verified contact data has a real home. */
  contacts?: { name: string; role?: string }[];
  /**
   * Partner-side agent identities whose evidence chain this workspace surfaces.
   * Absent (not empty) for a workspace that ingests no external agent evidence
   * — the Evidence surface then renders nothing rather than an empty promise.
   */
  referenceAgents?: PartnerReferenceAgent[];
  links: PartnerWorkspaceLink[];
}

// ─── The registry — ONE authoritative list ───────────────────────────────────

export const PARTNER_WORKSPACES: PartnerWorkspace[] = [
  {
    id: 'horizen-pilot-series-001',
    partnerName: 'Horizen',
    series: '001',
    phase: 'integration',
    ownerAgentId: 'aigent-z',
    partnershipContext: 'agentiq-metame',
    // Objectives are drawn from the ratified pilot material (CRP-003a / CFSP,
    // tracker #98; CFI-002 context #80) — not invented.
    objectives: [
      'Prove the Constitutional Agreement primitive (CFI-002) in live delegated execution — the 409 gate on every delegated capability call',
      'Deliver the Financial Services Capability Suite through the canonical 12-step constitutional service pattern',
      'Exercise Horizen as the agent registry / discovery provider behind the provider-agnostic adapter seam (primitives invariant, providers replaceable)',
      'Anchor pilot evidence as DVN receipts (anchor of record), with x409 as the swappable acceptance-proof provider',
    ],
    layerOwners: {
      // Workspace owner + orchestrator — Chief of Staff.
      operations: 'aigent-z',
      relationship: 'aigent-marketa',
      'financial-services': 'aigent-moneypenny',
      knowledge: 'aigent-kn0w1',
      // Orchestration role id (no RUNTIME_AGENT_IDS binding today) — see
      // PartnerLayerOwnerId doc above.
      'customer-experience': 'aigent-c',
      // Constitutional role id (sovereignAgentRoles runtimeRoleId).
      governance: 'metame-guardian',
    },
    // The pilot's representative agent, from the Horizen Partner Integration
    // Brief §3 ("Representative Agent Package") as transcribed in
    // services/horizen/correlate.ts §3.1 and exercised end-to-end against the
    // live services in tests/horizen-integration.test.ts: registry alias
    // `0x1eba` == tokenId 7866 on Base Sepolia. RECORDED here rather than
    // inferred at read time — a second agent is one more entry, never a
    // second list (inv.engineering.036).
    referenceAgents: [
      {
        registryAlias: '0x1eba',
        network: 'base-sepolia',
        label: 'Reference agent (brief §3)',
      },
    ],
    links: [
      {
        id: 'portfolio-brief',
        label: 'Portfolio Operating Brief',
        description: 'Venture portfolio board — scorecards, operating model, council agenda, action tracking',
        codexSlug: 'alpha-knyt',
        tab: 'portfolio',
        area: 'overview',
      },
      {
        id: 'alpha-programme',
        label: 'Programme Dashboard',
        description: 'Six-workstream programme overview with live progress report',
        codexSlug: 'alpha-knyt',
        tab: 'alpha-programme',
        area: 'overview',
      },
      {
        id: 'financial-services',
        label: 'Financial Services Suite',
        description: "The pilot's constitutional service loop — 12-step pipeline, agreement gate, capability domains",
        codexSlug: 'alpha-knyt',
        tab: 'financial-services',
        area: 'operate',
      },
      {
        id: 'agentiq-os',
        label: 'AgentiQ OS α',
        description: 'Builder substrate dashboard — agent registry, skill catalog, factory pipeline',
        codexSlug: 'alpha-knyt',
        tab: 'agentiq-os-vl',
        area: 'operate',
      },
      {
        id: 'governance-receipts',
        label: 'Governance Receipts',
        description: 'DVN-anchored governance decision receipts',
        codexSlug: 'agentiq-os-cartridge',
        tab: 'governance-receipts',
        area: 'evidence',
      },
      {
        id: 'my-ledger',
        label: 'myLedger',
        description: 'Activity receipts — the operator-facing receipt ledger',
        codexSlug: 'metame',
        tab: 'my-ledger',
        area: 'evidence',
      },
      {
        id: 'relationship-builder',
        label: 'Relationship Builder',
        description: 'Partner and customer outreach — contacts, funnel, campaign composer, QubeTalk coordination',
        codexSlug: 'alpha-knyt',
        tab: 'relationship-builder',
        area: 'communicate',
      },
      {
        id: 'marketa',
        label: 'Marketa',
        description: 'Marketing + partner-activation cartridge (the relationship layer owner’s home surface)',
        codexSlug: 'marketa',
        area: 'communicate',
      },
    ],
  },
];

// ─── Derivations ─────────────────────────────────────────────────────────────

export function listPartnerWorkspaces(): PartnerWorkspace[] {
  return PARTNER_WORKSPACES;
}

export function getPartnerWorkspace(id: string): PartnerWorkspace | null {
  return PARTNER_WORKSPACES.find((w) => w.id === id) ?? null;
}

/**
 * The pilot programmes an invitation can be scoped to in the `venture-lab`
 * access domain — the Venture Lab counterpart of the Research Lab's
 * ASSIGNABLE_EXPERIMENTS (operator, 2026-07-28: "VL Invitations should include
 * pilot programs like RL includes experiments").
 *
 * DERIVED from PARTNER_WORKSPACES, never hand-listed (inv.engineering.036 —
 * the same correction ASSIGNABLE_EXPERIMENTS took when its hand-copied array
 * went stale). A new pilot in the registry is automatically invitable; there is
 * no second place to remember.
 */
export const ASSIGNABLE_PILOTS: { id: string; label: string }[] = PARTNER_WORKSPACES.map((w) => ({
  id: w.id,
  label: `${w.partnerName} · Pilot Series ${w.series}`,
}));

/**
 * Display-name fallbacks for owner ids the canonical AigentQube profile map
 * does not (yet) carry. Sources: specialistRouter SPECIALIST_LABELS
 * ('Aigent Z', 'Aigent C') and the System Model's sovereign guardian
 * ('metaMe' + guardian role → 'metaMe Guardian').
 */
const OWNER_DISPLAY_FALLBACKS: Partial<Record<PartnerLayerOwnerId, string>> = {
  'aigent-z': 'Aigent Z',
  'aigent-c': 'Aigent C',
  'metame-guardian': 'metaMe Guardian',
};

/**
 * Resolve a layer owner's display name from the canonical agent profiles
 * (getAigentQubeSource) first, then the documented fallbacks, then the raw id
 * (honest — never an invented name).
 */
export function layerOwnerDisplayName(agentId: PartnerLayerOwnerId | null): string | null {
  if (!agentId) return null;
  const source = getAigentQubeSource(agentId);
  if (source?.name) return source.name;
  return OWNER_DISPLAY_FALLBACKS[agentId] ?? agentId;
}
