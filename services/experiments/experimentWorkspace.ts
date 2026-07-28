/**
 * experimentWorkspace — the COMMON experimental-workspace spine shared by the
 * Research Lab and the Venture Lab (Horizen audit, Amendment A §A.5 /
 * Amendment B §B.5 Phase 2).
 *
 * THE GOVERNING FORMULATION (Amendment B §B.6, recorded verbatim as canon):
 *
 *   "The Research Lab and Venture Lab are parallel experimental environments
 *    operating on a common constitutional and collaborative substrate. The
 *    Research Lab is scientifically rich and primarily produces structural and
 *    scientific proof. The Venture Lab is venture-rich and primarily produces
 *    commercial and operational proof."
 *
 * THE DISCIPLINE THAT MAKES THIS A SEAM AND NOT A SECOND SYSTEM.
 * Everything a workspace "has" is a REFERENCE resolved at runtime from the
 * capability that already owns it — never a copy stored here:
 *
 *   participants → participationAccess grants   (services/passport/participationAccess)
 *   agents       → constitutional agreements    (services/constitutional/constitutionalAgreement)
 *   actions      → IntentQubes                  (services/iqube/intentQube)
 *   decisions    → agreement lifecycle          (same agreements)
 *   evidence     → activity receipts            (services/receipts/activityReceiptService)
 *   invariants   → resolved with provenance     (ontologyResolver + invariants/store)
 *   channels     → existing peer channels       (services/qubetalk/peerChannel)
 *
 * The base audit §2 named "a second programme-management system" as the single
 * most likely way this work goes wrong. Reference-only is how that is
 * prevented, and `tests/experiment-workspace.test.ts` is what enforces it.
 *
 * THE ONLY NEW STATE is milestones and blockers — the two concerns with no
 * existing home anywhere in the platform. Actions and decisions are PROJECTED,
 * per the operator's ruling on the actions substrate ("Hybrid", 2026-07-27):
 * milestones and blockers workspace-local; actions and decisions projected
 * from IntentQubes and Constitutional Agreements.
 *
 * INVARIANTS ARE RESOLVED, NEVER AUTHORED (Amendment D, Principle 3):
 *
 *   "The Workspace should never store: Invariant 143, Invariant 201,
 *    Invariant 98. It stores Resolved Invariants with provenance. Exactly like
 *    Blueprint Handoff already does."
 *
 * `resolveWorkspaceInvariants` copies `services/venture/blueprintHandoff.ts`
 * verbatim in shape: resolve the workspace's own operator-facing text through
 * the canonical ontology, look the seed ids up in the runtime invariant store,
 * and record what resolved, when, and against which canon version. A
 * hand-authored id array would make the workspace a second source of truth for
 * canon (the inv.engineering.036 defect) and would rot silently the moment an
 * invariant is renumbered.
 */

import { listAgreements, type ConstitutionalAgreementRow } from '@/services/constitutional/constitutionalAgreement';
import { listRecentIntentsForPersona, type IntentQubeRecord } from '@/services/iqube/intentQube';
import { resolveOntology } from '@/services/constitutional/ontologyResolver';
import { getInvariantsBySeedIds } from '@/services/invariants/store';
import { DOMAIN_ROLES, type AccessDomain } from '@/services/passport/participationAccess';
import {
  PARTNER_WORKSPACES,
  type PartnerWorkspace,
  type PartnerLayerOwnerId,
  type PartnerWorkspaceLayer,
} from '@/services/venture/partnerWorkspace';
import {
  RESEARCH_WORKSPACES,
  RESEARCH_WORKSPACE_LAYERS,
  researchWorkspaceLabel,
  researchWorkspaceObjectives,
  type ResearchWorkspace,
} from '@/services/research/researchWorkspace';

// ─── Domain + class discrimination ───────────────────────────────────────────

/** The two Labs. Domain discriminates; it does not branch behaviour here. */
export const WORKSPACE_DOMAINS = ['research', 'venture'] as const;
export type WorkspaceDomain = (typeof WORKSPACE_DOMAINS)[number];

/**
 * What KIND of proof a workspace primarily produces. The Labs are asymmetric
 * by design (Amendment B): Research is scientifically rich, Venture is
 * venture-rich. `hybrid` is real — a pilot that produces both operational and
 * commercial proof is not a modelling failure.
 */
export const EXPERIMENT_CLASSES = ['scientific', 'commercial', 'operational', 'hybrid'] as const;
export type ExperimentClass = (typeof EXPERIMENT_CLASSES)[number];

// ─── References — the whole point of the spine ───────────────────────────────

/**
 * WHERE the participants live, not WHO they are. Membership is the set of
 * participationAccess grants in `domain` holding one of `roles`; the grants
 * themselves are never copied here. `roles` is validated against
 * `DOMAIN_ROLES[domain]` by `workspaceReferenceIssues()` — a role that does not
 * exist in the substrate is a defect, not a new role.
 */
export interface WorkspaceParticipationReference {
  domain: AccessDomain;
  roles: string[];
}

/**
 * WHICH agents act in this workspace, by their canonical agent ids. The
 * governing Constitutional Agreements are resolved at runtime by matching
 * `selectedAgentRef` — an agreement id is never stored here, because
 * agreements are formed after the workspace exists and would rot on first
 * re-formation.
 */
export interface WorkspaceAgentReference {
  agentIds: PartnerLayerOwnerId[];
}

/**
 * WHICH receipts constitute this workspace's evidence. Receipts are not copied
 * or summarised here — the ledger stays the single evidence store.
 */
export interface WorkspaceEvidenceReference {
  /** Activity-receipt cartridge the workspace's evidence is written under. */
  cartridge: string;
  /** Receipt action types that count as this workspace's evidence. */
  actionTypes: string[];
}

/**
 * A working group is a NAMED SET OF EXISTING CHANNELS — composition, not a new
 * messaging system. `channelIds` are peer-channel ids owned by
 * services/qubetalk/peerChannel; this registry never creates, stores or
 * mirrors messages.
 */
export interface WorkspaceWorkingGroup {
  id: string;
  label: string;
  /** Existing peer-channel ids. Empty until the channels are provisioned. */
  channelIds: string[];
  /** Which of the workspace's layers this group serves. */
  layers: PartnerWorkspaceLayer[];
}

/**
 * A Tier-1 Locker reference. The commitment is the reference — never a raw
 * case/persona/item id (the HMS identifier-isolation rule generalised: a
 * network-bound structure carries commitments, not identifiers).
 */
export interface WorkspaceLockerReference {
  /** One-way commitment computed server-side; T2-safe. */
  lockerRef: string;
  label: string;
}

// ─── The spine ───────────────────────────────────────────────────────────────

export interface ExperimentWorkspace {
  id: string;
  label: string;
  domain: WorkspaceDomain;
  experimentClass: ExperimentClass;
  /** Operator-facing objectives — the text invariant resolution reads. */
  objectives: string[];
  participation: WorkspaceParticipationReference;
  agents: WorkspaceAgentReference;
  evidence: WorkspaceEvidenceReference;
  workingGroups: WorkspaceWorkingGroup[];
  lockers: WorkspaceLockerReference[];
  /**
   * The venture variant carries its partner registry entry; the research
   * variant carries its research registry entry (whose own `seriesId` is the
   * SERIES_REGISTRY binding). Neither is copied — both are the authoritative
   * record itself.
   */
  partner?: PartnerWorkspace;
  research?: ResearchWorkspace;
}

// ─── The venture variant — derived, never a second list ──────────────────────

/**
 * Map a Partner Workspace onto the common spine. `PARTNER_WORKSPACES` stays
 * the single authoritative source for partner instances (inv.engineering.036);
 * this is a projection of it, so instantiating the next partner remains ONE
 * new entry there and zero here.
 */
export function experimentWorkspaceFromPartner(partner: PartnerWorkspace): ExperimentWorkspace {
  const layers = Object.keys(partner.layerOwners) as PartnerWorkspaceLayer[];
  return {
    id: partner.id,
    label: `${partner.partnerName} — Pilot Series ${partner.series}`,
    domain: 'venture',
    // The pilot produces commercial proof (the Financial Services Capability
    // Suite) AND operational proof (delegated execution under agreement) —
    // hybrid is the honest class, not a hedge.
    experimentClass: 'hybrid',
    objectives: partner.objectives,
    participation: {
      domain: 'venture-lab',
      // The workspace roles added to DOMAIN_ROLES['venture-lab'] in Phase 1.
      roles: ['workspace-steward', 'partner-operator', 'technical-contributor', 'communications-contributor', 'observer', 'agent-participant'],
    },
    agents: {
      agentIds: Object.values(partner.layerOwners).filter(
        (a): a is PartnerLayerOwnerId => a !== null,
      ),
    },
    evidence: {
      cartridge: 'venture-lab',
      // Receipt action types already written by the capabilities this
      // workspace composes — no new action type is invented here.
      actionTypes: ['venture_blueprint_handoff', 'agreement_formed', 'agreement_authorized'],
    },
    workingGroups: layers.map((layer) => ({
      id: `${partner.id}:${layer}`,
      label: layer.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      // Provisioned through peerChannel when the group is first convened;
      // an empty set is honest, not a placeholder for a parallel store.
      channelIds: [],
      layers: [layer],
    })),
    lockers: [],
    partner,
  };
}

// ─── The research variant — derived, never a second list ─────────────────────

/**
 * Map a Research Workspace onto the common spine. Exactly parallel to
 * `experimentWorkspaceFromPartner`: `RESEARCH_WORKSPACES` stays the single
 * authoritative source for research instances, and this is a projection of it,
 * so convening the next research programme remains ONE new entry there and zero
 * here.
 *
 * Label and objectives are pulled through the registry's own derivations
 * (`researchWorkspaceLabel` / `researchWorkspaceObjectives`), which read
 * SERIES_REGISTRY — so the spine, the API route and the cartridge surface all
 * read one derivation and cannot disagree about what the programme is called or
 * what it is for.
 */
export function experimentWorkspaceFromResearch(research: ResearchWorkspace): ExperimentWorkspace {
  const layers = RESEARCH_WORKSPACE_LAYERS.filter((l) => research.layerOwners[l] !== undefined);
  return {
    id: research.id,
    label: researchWorkspaceLabel(research),
    domain: 'research',
    // Amendment B §B.6: "The Research Lab is scientifically rich and primarily
    // produces structural and scientific proof." `scientific` is the honest
    // class — not `hybrid`, which would claim commercial proof this programme
    // does not set out to produce.
    experimentClass: 'scientific',
    objectives: researchWorkspaceObjectives(research),
    participation: {
      domain: 'research-lab',
      // EXISTING research-lab roles only (operator ruling, 2026-07-28: "Do not
      // invent new names if equivalent roles already exist"). `researcher` and
      // `research-steward` are full participation; `research-participant` is
      // the read-only path. Every other role in the domain — `reviewer`,
      // `ratifier`, `delegated-research-agent` — is experiment- or
      // governance-scoped and gets NO workspace access unless explicitly
      // granted one of these three.
      roles: ['researcher', 'research-steward', 'research-participant'],
    },
    agents: {
      agentIds: Object.values(research.layerOwners).filter(
        (a): a is PartnerLayerOwnerId => a !== null && a !== undefined,
      ),
    },
    evidence: {
      // The IRL cartridge is where this workspace's evidence is written and
      // where its entrance lives — the binding canary 9 in
      // tests/venture-lab-cohort-isolation.test.ts derives the door from.
      cartridge: 'irl-cartridge',
      // Receipt action types the research capabilities ALREADY write
      // (services/receipts/activityReceiptService.ts) — no new type invented.
      actionTypes: ['research_lifecycle_transition', 'experiment_result_published', 'invariant_canonized'],
    },
    workingGroups: layers.map((layer) => ({
      id: `${research.id}:${layer}`,
      label: layer.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      channelIds: [],
      layers: [layer],
    })),
    lockers: [],
    research,
  };
}

/**
 * Every workspace on the spine — both Labs, one list. Each half is a projection
 * of its own authoritative registry; the spine declares neither.
 */
export function listExperimentWorkspaces(): ExperimentWorkspace[] {
  return [
    ...PARTNER_WORKSPACES.map(experimentWorkspaceFromPartner),
    ...RESEARCH_WORKSPACES.map(experimentWorkspaceFromResearch),
  ];
}

export function getExperimentWorkspace(id: string): ExperimentWorkspace | null {
  return listExperimentWorkspaces().find((w) => w.id === id) ?? null;
}

/**
 * Reference integrity — every declared reference must point at something the
 * substrate actually has. Returns the problems (empty = clean) rather than
 * throwing, so a surface can render the honest gap instead of blanking.
 */
export function workspaceReferenceIssues(ws: ExperimentWorkspace): string[] {
  const issues: string[] = [];
  const known = DOMAIN_ROLES[ws.participation.domain] ?? [];
  for (const role of ws.participation.roles) {
    if (!known.includes(role)) {
      issues.push(
        `participation role "${role}" is not in DOMAIN_ROLES['${ws.participation.domain}'] — add it to the substrate, do not declare it here`,
      );
    }
  }
  if (ws.agents.agentIds.length === 0) {
    issues.push('no agents referenced — a workspace with no acting agent cannot produce evidence');
  }
  return issues;
}

// ─── Resolved invariants with provenance (Amendment D, Principle 3) ──────────

/** One invariant the workspace's own text resolved to, with how it resolved. */
export interface ResolvedInvariantReference {
  /** Runtime invariant row id — resolved, never authored. */
  invariantId: string;
  /** Seed id the ontology matched (e.g. inv.constitutional.011). */
  seedId: string | null;
  statement: string;
  namespace: string;
  status: string;
  /** The canonical concept whose resolution produced this reference. */
  canonicalTerm: string;
  /** Which canon the term resolved against. */
  resolutionSource: string;
}

export interface WorkspaceInvariantResolution {
  workspaceId: string;
  resolvedAt: string;
  /** Canon version stamp the resolution ran against (cache-key discipline). */
  canonVersion: string;
  references: ResolvedInvariantReference[];
  /** Concepts the workspace names that canon does not govern — surfaced, never hidden. */
  unresolved: string[];
}

/**
 * Resolve the invariants governing a workspace FROM ITS OWN TEXT, at call
 * time. Shape copied from `services/venture/blueprintHandoff.ts` — the
 * ratified precedent for "resolved, not stored".
 *
 * Enrichment-only: never throws, and a workspace whose text resolves to
 * nothing returns an empty reference set rather than a fabricated one.
 */
export async function resolveWorkspaceInvariants(
  ws: ExperimentWorkspace,
): Promise<WorkspaceInvariantResolution> {
  const text = [
    ws.label,
    ...ws.objectives,
    ...ws.workingGroups.map((g) => g.label),
  ]
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .join('\n');

  const empty: WorkspaceInvariantResolution = {
    workspaceId: ws.id,
    resolvedAt: new Date().toISOString(),
    canonVersion: 'unknown',
    references: [],
    unresolved: [],
  };

  const resolution = await resolveOntology(text).catch(() => null);
  if (!resolution) return empty;

  const bySeed = new Map<string, { canonical: string; source: string }>();
  for (const term of resolution.resolvedTerms) {
    for (const seedId of term.invariantIds) {
      if (!bySeed.has(seedId)) bySeed.set(seedId, { canonical: term.canonical, source: term.source });
    }
  }

  const rows = bySeed.size > 0
    ? await getInvariantsBySeedIds(Array.from(bySeed.keys())).catch(() => [])
    : [];

  return {
    workspaceId: ws.id,
    resolvedAt: new Date().toISOString(),
    canonVersion: resolution.canonVersion,
    references: rows.map((r) => {
      const via = r.seedId ? bySeed.get(r.seedId) : undefined;
      return {
        invariantId: r.id,
        seedId: r.seedId,
        statement: r.statement,
        namespace: r.namespace,
        status: r.status,
        canonicalTerm: via?.canonical ?? '',
        resolutionSource: via?.source ?? 'unknown',
      };
    }),
    unresolved: resolution.unresolved,
  };
}

// ─── Projections — the "Hybrid" half of the actions substrate ────────────────

/**
 * A workspace action, PROJECTED from an IntentQube. There is no workspace
 * action store: an action IS an intent, and the intent chain (parent/child,
 * approval, completion) is the substrate that already models it.
 */
export interface WorkspaceAction {
  intentId: string;
  name: string;
  status: IntentQubeRecord['status'];
  approvalRequired: boolean;
  agents: string[];
  parentIntentId: string | null;
  createdAt: string;
}

/**
 * Project the workspace's actions for one operator. Scoped by the evidence
 * cartridge, which is also the intents' `activeCartridge` — the same key on
 * both sides, so the projection cannot drift from the evidence it produces.
 */
export async function projectWorkspaceActions(
  ws: ExperimentWorkspace,
  personaId: string,
  limit = 25,
): Promise<WorkspaceAction[]> {
  const intents = await listRecentIntentsForPersona(personaId, {
    limit,
    cartridge: ws.evidence.cartridge,
  }).catch(() => [] as IntentQubeRecord[]);
  return intents.map((i) => ({
    intentId: i.id,
    name: i.intentName,
    status: i.status,
    approvalRequired: i.approvalRequired,
    agents: i.targetAgents,
    parentIntentId: i.parentIntentId,
    createdAt: i.createdAt,
  }));
}

/**
 * A workspace decision, PROJECTED from a Constitutional Agreement's lifecycle.
 * A decision in this model is not a note someone typed — it is an agreement
 * reaching a state that authorises or refuses delegated action, which is
 * exactly what the agreement primitive already records (and receipts).
 */
export interface WorkspaceDecision {
  agreementId: string;
  label: string;
  status: ConstitutionalAgreementRow['status'];
  agentRef: string | null;
  capabilityRef: string | null;
  /** The receipt that anchors the decision, when one exists. */
  receiptId: string | null;
  decidedAt: string;
}

/**
 * Project the workspace's decisions: agreements whose selected agent is one of
 * the workspace's referenced agents. Agreement ids are never stored on the
 * workspace precisely so this resolves live.
 */
export async function projectWorkspaceDecisions(
  ws: ExperimentWorkspace,
): Promise<WorkspaceDecision[]> {
  const agreements = await listAgreements().catch(() => [] as ConstitutionalAgreementRow[]);
  const agentIds = new Set<string>(ws.agents.agentIds);
  return agreements
    .filter((a) => a.selectedAgentRef !== null && agentIds.has(a.selectedAgentRef))
    .map((a) => ({
      agreementId: a.agreementId,
      label: a.displayLabel,
      status: a.status,
      agentRef: a.selectedAgentRef,
      capabilityRef: a.capabilityRef,
      receiptId: a.authorizedReceiptId ?? a.formedReceiptId,
      decidedAt: a.createdAt,
    }));
}
