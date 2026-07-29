/**
 * researchWorkspace — the Research Workspace registry (Invariant Research Lab).
 *
 * THE RESEARCH COUNTERPART OF `services/venture/partnerWorkspace.ts`. The two
 * Labs are "parallel experimental environments operating on a common
 * constitutional and collaborative substrate" (Horizen audit Amendment B §B.6,
 * carried verbatim in `services/experiments/experimentWorkspace.ts`). That
 * substrate is the spine; THIS file is the research half of what the spine
 * projects, exactly as PARTNER_WORKSPACES is the venture half.
 *
 * WHY IT EXISTS AT ALL (the defect it closes). Until now
 * `listExperimentWorkspaces()` yielded venture workspaces only — the spine's
 * own comment said "Research variants join in Phase 4" — so the Research Lab
 * had a collaborative model with no instance and, consequently, no entrance in
 * any cartridge. `tests/venture-lab-cohort-isolation.test.ts` canary 9 exists
 * precisely to fail the moment a research workspace joins the spine without an
 * IRL door; the door ships in the same change as this registry.
 *
 * THIS LIST IS THE SINGLE AUTHORITATIVE SOURCE (inv.engineering.036) for
 * research workspace INSTANCES. Everything else about a workspace is DERIVED,
 * never restated here:
 *
 *   name / claim / member experiments  → SERIES_REGISTRY  (types/research.ts)
 *   objectives                         → the series claim + its members
 *   assignable invitation scope        → ASSIGNABLE_RESEARCH_WORKSPACES below
 *   layer vocabulary                   → PARTNER_WORKSPACE_LAYERS (a subset)
 *
 * A hand-copied series name or experiment list here would be the stale-duplicate
 * defect `tests/source-of-truth-parity.test.ts` indexes; the derivations below
 * are what prevent it.
 */

import { EXPERIMENT_REGISTRY, SERIES_REGISTRY, type ResearchExperiment, type ResearchSeries } from '@/types/research';
import {
  PARTNER_WORKSPACE_LAYERS,
  type PartnerLayerOwnerId,
  type PartnerWorkspaceLayer,
  type PartnerWorkspaceLink,
} from '@/services/venture/partnerWorkspace';
import type { WorkspaceType, WorkspaceVisibilityPosture, LifecycleTemplateId } from '@/services/experiments/workspaceLifecycle';
import type { ResearchWorkspaceRoleId } from '@/services/research/researchWorkspaceViews';

// ─── Layer model — a SUBSET of the ratified vocabulary, never a second one ───

/**
 * The layers a research programme actually has an owner for. Derived by
 * FILTERING `PARTNER_WORKSPACE_LAYERS` rather than re-declaring four strings,
 * so a rename upstream cannot leave this list pointing at a layer that no
 * longer exists — and so the spine's `WorkspaceWorkingGroup.layers` type (and
 * the canary in `tests/experiment-workspace.test.ts` that every declared layer
 * is a real member) keeps holding without a second vocabulary.
 *
 * `financial-services` and `customer-experience` are venture concerns; a
 * research programme has no owner for them, and declaring a null owner for a
 * layer that does not apply would be noise rather than honesty.
 */
const RESEARCH_LAYER_IDS = ['operations', 'knowledge', 'relationship', 'governance'] as const;
export const RESEARCH_WORKSPACE_LAYERS: PartnerWorkspaceLayer[] = PARTNER_WORKSPACE_LAYERS.filter(
  (l): l is PartnerWorkspaceLayer => (RESEARCH_LAYER_IDS as readonly string[]).includes(l),
);

// ─── The workspace shape ─────────────────────────────────────────────────────

/** The four research members of the shared `WorkspaceType` union (SPEC §6). */
export type ResearchWorkspaceType = Extract<
  WorkspaceType,
  'research-programme' | 'experiment' | 'cohort' | 'student-project'
>;

export interface ResearchWorkspace {
  id: string;
  /** Where this sits in the hierarchy (SPEC §6). */
  workspaceType: ResearchWorkspaceType;
  /**
   * The parent workspace's id, or absent for a root. A REFERENCE onto this same
   * registry — never an embedded copy — so the tree has one authoritative node
   * per workspace. `researchWorkspaceAncestry` walks it, and a canary asserts
   * every declared parent resolves and that no cycle exists.
   */
  parentId?: string;
  /**
   * The validation series this workspace convenes. When present it MUST exist
   * in SERIES_REGISTRY. Optional because a cohort or student project convenes
   * no series — a capstone is not a validation series, and giving it a fake
   * `seriesId` to satisfy a required field would put an invention in the
   * registry that every derivation downstream would then repeat.
   */
  seriesId?: string;
  /**
   * The single experiment this workspace is scoped to (type `experiment`). MUST
   * exist in EXPERIMENT_REGISTRY. This is what makes "an Autonomi reviewer
   * reaches only assigned experiments" expressible: the grant is scoped to THIS
   * workspace id, and the workspace names exactly one experiment.
   */
  experimentId?: string;
  /**
   * Operator-facing title. REQUIRED when neither `seriesId` nor `experimentId`
   * supplies a name — `researchWorkspaceLabel` prefers the derived name so a
   * series/experiment rename still travels, and a canary asserts that a
   * workspace with no derivable name declares one here rather than falling back
   * to its own id.
   */
  title?: string;
  description?: string;
  /**
   * The institutions this is a collaboration WITH. Names, not identifiers —
   * there is no institution entity in the platform today (see the spine's
   * `institutionRefs` note). Inherited from the parent when absent.
   */
  institutionRefs?: string[];
  /** Resolves in `services/experiments/workspaceLifecycle.ts`. */
  lifecycleTemplateId: LifecycleTemplateId;
  /** Which stage of that template the workspace is at; absent = not declared. */
  currentStage?: string;
  /** SPEC §11 — absent means `invited`, never `public`. */
  visibility?: WorkspaceVisibilityPosture;
  /**
   * Workspace owner + orchestrator. A RUNTIME agent — it must be executable.
   * Optional: a child inherits its nearest ancestor's owner rather than
   * restating it, so a programme-wide owner change is one edit.
   */
  ownerAgentId?: PartnerLayerOwnerId;
  /** The agent division of labour; inherited from the nearest ancestor that
   *  declares one. null = no real owner id exists for a layer. */
  layerOwners?: Partial<Record<PartnerWorkspaceLayer, PartnerLayerOwnerId | null>>;
  /** Deep links into the existing home of each capability (never raw URLs).
   *  Inherited from the nearest ancestor that declares them. */
  links?: PartnerWorkspaceLink[];
}

// ─── The registry — ONE authoritative list ───────────────────────────────────

export const RESEARCH_WORKSPACES: ResearchWorkspace[] = [
  {
    // The Institute's live collaborative programme. VP1 is the series the
    // platform already carries live instrumentation for — the EXP-P1 Readiness
    // instrument (`ExpP1ReadinessTab`, PRD-EPI-001 §10) and the external EXP-P1
    // review the Participation overview names as the reviewer engagement.
    id: 'irl-validation-programme-vp1',
    workspaceType: 'research-programme',
    seriesId: 'VP1',
    institutionRefs: ['Invariant Research Laboratory'],
    lifecycleTemplateId: 'research-experiment',
    // LAYER OWNERSHIP MIRRORS THE RATIFIED HORIZEN ASSIGNMENTS rather than
    // being independently decided here: operations/knowledge/relationship/
    // governance carry the same owners the Partner Workspace's ratified
    // division of labour gives them. `aigent-z` is also `IRL_CARTRIDGE.owner`
    // in data/codex-configs.ts, so the workspace owner is not an invention.
    // NOT separately operator-ratified for the research domain. Recorded here as
    // pending rather than asserted as settled — the same epistemic discipline
    // CLAUDE.md applies to hypotheses: a design decision that has not been
    // ratified must not read as one that has.
    ownerAgentId: 'aigent-z',
    layerOwners: {
      operations: 'aigent-z',
      knowledge: 'aigent-kn0w1',
      relationship: 'aigent-marketa',
      governance: 'metame-guardian',
    },
    links: [
      {
        id: 'irl-protocols',
        label: 'Protocols & Articles',
        description: 'Pre-registration protocols, experiment designs, evaluation frameworks',
        codexSlug: 'irl-cartridge',
        tab: 'irl-protocols',
        area: 'overview',
      },
      {
        id: 'irl-exp-p1-readiness',
        label: 'EXP-P1 Readiness',
        description: 'Seven per-gate readiness sections for EXP-P1 (protocol-ratified derivation, live)',
        codexSlug: 'irl-cartridge',
        tab: 'irl-exp-p1-readiness',
        area: 'operate',
      },
      {
        id: 'irl-experiment-lab',
        label: 'Experiments',
        description: 'Run the series live — the Invariant Research Lab experiment runner',
        codexSlug: 'irl-cartridge',
        tab: 'irl-experiment-lab',
        area: 'operate',
      },
      {
        id: 'irl-reports',
        label: 'Reports',
        description: 'Published research reports — canonical, DVN-receipted findings made public',
        codexSlug: 'irl-cartridge',
        tab: 'irl-reports',
        area: 'evidence',
      },
      {
        id: 'irl-records',
        label: 'Records & Findings',
        description: 'The constitutional record — every increment, finding, and session record',
        codexSlug: 'irl-cartridge',
        tab: 'irl-records',
        area: 'evidence',
      },
    ],
  },

  // ── SPEC-IRL-WORKSPACE-001 §1 use 1 — Autonomi Independent Review Programme ──
  //
  // "Austin and his agent review EXP-P1/P2/P3. Protocols, review packages,
  // decisions, QubeTalk and frozen artefacts in one scoped space. Institutional
  // relationship: Research Partner. Procedural role: External Reviewer."
  //
  // WHY THREE EXPERIMENT CHILDREN AND NOT ONE PROGRAMME-WIDE GRANT. Acceptance
  // criterion 4: "Autonomi reviewers reach only assigned experiments." A grant
  // is scoped to a WORKSPACE id, so the only way "assigned to EXP-P1 but not
  // EXP-P2" can be expressed — and denied — is for each experiment to be its own
  // workspace. One programme-wide workspace would make the criterion
  // unstateable and the denial canary untestable.
  //
  // The programme convenes no series of its own: its members ARE the three
  // experiment workspaces below, each naming one EXPERIMENT_REGISTRY entry.
  {
    id: 'autonomi-independent-review-programme',
    workspaceType: 'research-programme',
    title: 'Autonomi Independent Review Programme',
    description:
      'External independent review of EXP-P1/P2/P3 by the Autonomi research partner. Review packages, decisions, scoped deliberation and frozen artefacts in one space.',
    institutionRefs: ['Autonomi', 'Invariant Research Laboratory'],
    lifecycleTemplateId: 'research-experiment',
    currentStage: 'Review',
    ownerAgentId: 'aigent-z',
    layerOwners: {
      operations: 'aigent-z',
      knowledge: 'aigent-kn0w1',
      relationship: 'aigent-marketa',
      governance: 'metame-guardian',
    },
    links: [
      {
        id: 'irl-protocols',
        label: 'Protocols & Articles',
        description: 'Pre-registration protocols, experiment designs, evaluation frameworks',
        codexSlug: 'irl-cartridge',
        tab: 'irl-protocols',
        area: 'overview',
      },
      {
        id: 'irl-independent-review',
        label: 'Independent Review',
        description: 'IRL-REVIEW-001 — the independent-review capability surface',
        codexSlug: 'irl-cartridge',
        tab: 'irl-independent-review',
        area: 'operate',
      },
      {
        id: 'irl-records',
        label: 'Records & Findings',
        description: 'The constitutional record — every increment, finding, and session record',
        codexSlug: 'irl-cartridge',
        tab: 'irl-records',
        area: 'evidence',
      },
    ],
  },
  // The three experiment workspaces. Owner, layer owners, institutions and
  // links are all INHERITED from the programme — a child restating them would
  // be four copies of one division of labour.
  {
    id: 'autonomi-review-exp-p1',
    workspaceType: 'experiment',
    parentId: 'autonomi-independent-review-programme',
    experimentId: 'EXP-P1',
    lifecycleTemplateId: 'research-experiment',
    currentStage: 'Review',
  },
  {
    id: 'autonomi-review-exp-p2',
    workspaceType: 'experiment',
    parentId: 'autonomi-independent-review-programme',
    experimentId: 'EXP-P2',
    lifecycleTemplateId: 'research-experiment',
    currentStage: 'Protocol',
  },
  {
    id: 'autonomi-review-exp-p3',
    workspaceType: 'experiment',
    parentId: 'autonomi-independent-review-programme',
    experimentId: 'EXP-P3',
    lifecycleTemplateId: 'research-experiment',
    currentStage: 'Concept',
  },

  // ── SPEC-IRL-WORKSPACE-001 §1 use 2 — Lehigh University Capstones ───────────
  //
  // Two capstones under one institutional programme. The COHORT is the unit a
  // Faculty Lead administers (criterion 6) and the STUDENT PROJECT is the unit
  // a Student Researcher is scoped to (criterion 7) — so both must be
  // workspaces, for the same reason the Autonomi experiments are.
  {
    id: 'lehigh-capstone-programme',
    workspaceType: 'research-programme',
    title: 'Lehigh University Capstone Programme',
    description:
      'Institutional capstone collaboration with Lehigh University — the Master of Financial Engineering and Undergraduate Computer Science capstones.',
    institutionRefs: ['Lehigh University', 'Invariant Research Laboratory'],
    lifecycleTemplateId: 'capstone',
    ownerAgentId: 'aigent-z',
    layerOwners: {
      operations: 'aigent-z',
      knowledge: 'aigent-kn0w1',
      relationship: 'aigent-marketa',
      governance: 'metame-guardian',
    },
    links: [
      {
        id: 'irl-protocols',
        label: 'Protocols & Articles',
        description: 'Pre-registration protocols, experiment designs, evaluation frameworks',
        codexSlug: 'irl-cartridge',
        tab: 'irl-protocols',
        area: 'overview',
      },
      {
        id: 'irl-records',
        label: 'Records & Findings',
        description: 'The constitutional record — every increment, finding, and session record',
        codexSlug: 'irl-cartridge',
        tab: 'irl-records',
        area: 'evidence',
      },
    ],
  },
  {
    id: 'lehigh-mfe-capstone',
    workspaceType: 'cohort',
    parentId: 'lehigh-capstone-programme',
    title: 'MFE Capstone — Master of Financial Engineering',
    description:
      'Financial research, pricing, risk and financial-system artefacts.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
  {
    id: 'lehigh-mfe-risk-management',
    workspaceType: 'student-project',
    parentId: 'lehigh-mfe-capstone',
    title: 'MFE Capstone — Risk Management',
    description:
      'Risk research and risk-management artefacts under the MFE capstone brief.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
  {
    id: 'lehigh-mfe-pricing',
    workspaceType: 'student-project',
    parentId: 'lehigh-mfe-capstone',
    title: 'MFE Capstone — Pricing',
    description:
      'Pricing research and pricing artefacts under the MFE capstone brief.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
  {
    id: 'lehigh-mfe-financial-systems',
    workspaceType: 'student-project',
    parentId: 'lehigh-mfe-capstone',
    title: 'MFE Capstone — Financial Systems',
    description:
      'Financial-system design and financial-system artefacts under the MFE capstone brief.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
  {
    id: 'lehigh-cs-capstone',
    workspaceType: 'cohort',
    parentId: 'lehigh-capstone-programme',
    title: 'CS Capstone — Undergraduate Computer Science',
    description:
      'Software design, implementation, testing and capability artefacts.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
  {
    id: 'lehigh-cs-software-build',
    workspaceType: 'student-project',
    parentId: 'lehigh-cs-capstone',
    title: 'CS Capstone — Software Build',
    description:
      'Software design, implementation and testing under the CS capstone brief.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
  {
    id: 'lehigh-cs-agent-integration',
    workspaceType: 'student-project',
    parentId: 'lehigh-cs-capstone',
    title: 'CS Capstone — Agent Integration',
    description:
      'Agent integration design, implementation and testing under the CS capstone brief.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
  {
    id: 'lehigh-cs-constitutional-runtime',
    workspaceType: 'student-project',
    parentId: 'lehigh-cs-capstone',
    title: 'CS Capstone — Constitutional Runtime',
    description:
      'Constitutional runtime capability artefacts under the CS capstone brief.',
    lifecycleTemplateId: 'capstone',
    currentStage: 'Brief',
  },
];

// ─── Derivations ─────────────────────────────────────────────────────────────

export function listResearchWorkspaces(): ResearchWorkspace[] {
  return RESEARCH_WORKSPACES;
}

export function getResearchWorkspace(id: string): ResearchWorkspace | null {
  return RESEARCH_WORKSPACES.find((w) => w.id === id) ?? null;
}

/** The series record this workspace convenes, or null when the id is unknown. */
export function researchWorkspaceSeries(ws: ResearchWorkspace): ResearchSeries | null {
  return SERIES_REGISTRY.find((s) => s.id === ws.seriesId) ?? null;
}

/** The member experiments of this workspace's series, in registry order. */
export function researchWorkspaceExperiments(ws: ResearchWorkspace): ResearchExperiment[] {
  const series = researchWorkspaceSeries(ws);
  if (!series) return [];
  return series.members
    .map((id) => EXPERIMENT_REGISTRY.find((e) => e.id === id))
    .filter((e): e is ResearchExperiment => e !== undefined);
}

/** The single experiment this workspace is scoped to (type `experiment`). */
export function researchWorkspaceExperiment(ws: ResearchWorkspace): ResearchExperiment | null {
  if (!ws.experimentId) return null;
  return EXPERIMENT_REGISTRY.find((e) => e.id === ws.experimentId) ?? null;
}

// ─── Hierarchy (SPEC §6) ─────────────────────────────────────────────────────

/** The declared parent, or null for a root / an unresolvable reference. */
export function researchWorkspaceParent(ws: ResearchWorkspace): ResearchWorkspace | null {
  if (!ws.parentId) return null;
  return RESEARCH_WORKSPACES.find((w) => w.id === ws.parentId) ?? null;
}

/**
 * The chain from `ws` up to its root, `ws` FIRST. Cycle-safe by construction:
 * a workspace already seen terminates the walk, so a malformed registry
 * degrades to a truncated ancestry instead of hanging the render. A canary
 * asserts no cycle exists in the shipped data, so the guard should never fire —
 * an unguarded walk here would be an infinite loop in a client component.
 */
export function researchWorkspaceAncestry(ws: ResearchWorkspace): ResearchWorkspace[] {
  const chain: ResearchWorkspace[] = [];
  const seen = new Set<string>();
  let node: ResearchWorkspace | null = ws;
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    chain.push(node);
    node = researchWorkspaceParent(node);
  }
  return chain;
}

/** Direct children of `id`, in registry order. */
export function researchWorkspaceChildren(id: string): ResearchWorkspace[] {
  return RESEARCH_WORKSPACES.filter((w) => w.parentId === id);
}

/**
 * Resolve one inheritable field: the workspace's own value if it declares one,
 * otherwise the nearest ancestor that does. ONE implementation for owner,
 * layerOwners, links and institutions — four hand-rolled parent walks would be
 * four chances to walk it differently.
 */
function inherited<K extends keyof ResearchWorkspace>(
  ws: ResearchWorkspace,
  key: K,
): ResearchWorkspace[K] | undefined {
  for (const node of researchWorkspaceAncestry(ws)) {
    const value = node[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

/** The workspace's owner agent, inherited when not declared. */
export function researchWorkspaceOwner(ws: ResearchWorkspace): PartnerLayerOwnerId | null {
  return inherited(ws, 'ownerAgentId') ?? null;
}

/** The agent division of labour, inherited when not declared. */
export function researchWorkspaceLayerOwners(
  ws: ResearchWorkspace,
): Partial<Record<PartnerWorkspaceLayer, PartnerLayerOwnerId | null>> {
  return inherited(ws, 'layerOwners') ?? {};
}

/** Capability deep links, inherited when not declared. */
export function researchWorkspaceLinks(ws: ResearchWorkspace): PartnerWorkspaceLink[] {
  return inherited(ws, 'links') ?? [];
}

/** The institutions this collaboration involves, inherited when not declared. */
export function researchWorkspaceInstitutions(ws: ResearchWorkspace): string[] {
  return inherited(ws, 'institutionRefs') ?? [];
}

// ─── Naming ──────────────────────────────────────────────────────────────────

/**
 * The operator-facing label, in preference order:
 *
 *   1. the SERIES name  — so renaming the series renames the workspace
 *   2. the EXPERIMENT id + name — same reason, for an experiment workspace
 *   3. the declared `title` — for cohorts and student projects, which convene
 *      neither and therefore have no upstream name to derive
 *
 * The id is the last resort and means the registry entry is malformed; a canary
 * asserts no shipped workspace falls through to it, because an id rendered as a
 * heading is indistinguishable from a name to everyone except its author.
 */
export function researchWorkspaceLabel(ws: ResearchWorkspace): string {
  const series = researchWorkspaceSeries(ws);
  if (series) return `${series.name} (${series.id})`;
  const experiment = researchWorkspaceExperiment(ws);
  // `programmeFocus` is the SERIES-view name (types/research.ts: "a SERIES view
  // shows `EXP-P1 — {programmeFocus}`"); `family` is the protocol title and is
  // the honest fallback where no focus is declared.
  if (experiment) return `${experiment.id} · ${experiment.programmeFocus ?? experiment.family}`;
  if (ws.title) return ws.title;
  return ws.id;
}

/**
 * The workspace's objectives — the series CLAIM plus its member experiments'
 * programme focus. This is the text `resolveWorkspaceInvariants` reads, so it
 * must be the programme's real language, and it must be derived: a hand-written
 * objectives array here would drift from the series the moment the series
 * changed, and would make this file a second source of truth for the science.
 */
export function researchWorkspaceObjectives(ws: ResearchWorkspace): string[] {
  const series = researchWorkspaceSeries(ws);
  if (series) {
    return [
      series.claim,
      ...researchWorkspaceExperiments(ws).map((e) => `${e.id} · ${e.programmeFocus ?? e.family}`),
    ];
  }
  // An EXPERIMENT workspace's objective is the experiment's own HYPOTHESIS —
  // the registry's words, not a restatement of them here.
  const experiment = researchWorkspaceExperiment(ws);
  if (experiment) return [experiment.hypothesis];
  // A programme/cohort/project that convenes neither. Its own description plus
  // its children's labels — still derived, so adding a child adds an objective
  // and nothing has to be remembered twice.
  const children = researchWorkspaceChildren(ws.id).map(researchWorkspaceLabel);
  return [...(ws.description ? [ws.description] : []), ...children];
}

// ─── Roles by workspace type (SPEC §8) ───────────────────────────────────────

/**
 * WHICH substrate roles each kind of research workspace admits.
 *
 * The split is the spec's, not a convenience: a capstone cohort and a
 * validation experiment are administered by different people under different
 * authority, and a single flat role list would let a Student Researcher's grant
 * satisfy an experiment workspace's gate. Keyed by `workspaceType` so the
 * decision is made once, by the registry, and read identically by the spine,
 * the route and the canaries.
 *
 * `researcher`, `research-steward` and `research-participant` are the three
 * roles the pre-2026-07-29 configuration admitted; they remain on every
 * research-side workspace, so no existing grant loses reach.
 */
export const RESEARCH_ROLES_BY_TYPE: Record<ResearchWorkspaceType, ResearchWorkspaceRoleId[]> = {
  'research-programme': [
    'principal-investigator',
    'research-steward',
    'reviewer',
    'research-participant',
    'researcher',
  ],
  experiment: [
    'principal-investigator',
    'research-steward',
    'reviewer',
    'research-participant',
    'researcher',
  ],
  // A Faculty Lead administers the cohort; students work in its projects.
  // `reviewer` is absent: a capstone is reviewed by its Faculty Lead, and an
  // external reviewer grant must not reach teaching cohorts by default.
  cohort: ['faculty-lead', 'research-steward', 'student-researcher', 'research-participant'],
  'student-project': ['faculty-lead', 'student-researcher', 'research-participant'],
};

/** The participation roles this workspace admits — the spine reads this. */
export function researchWorkspaceParticipationRoles(ws: ResearchWorkspace): string[] {
  return [...RESEARCH_ROLES_BY_TYPE[ws.workspaceType]];
}

/**
 * The research programmes an invitation can be scoped to in the `research-lab`
 * access domain — the Research Lab counterpart of `ASSIGNABLE_PILOTS`, riding
 * the SAME `allowed_experiments` column both catalogues already use.
 *
 * DERIVED from RESEARCH_WORKSPACES (inv.engineering.036), so a new research
 * workspace is automatically invitable and there is no second place to
 * remember. Composed with (never replacing) ASSIGNABLE_EXPERIMENTS in
 * `app/api/steward/participation/route.ts`: an experiment-scoped reviewer
 * invitation and a workspace-scoped participation invitation are different
 * grants, and the steward chooses.
 *
 * NARROWING, NEVER WIDENING. `getGrantedExperiments` reads the same column to
 * decide which experiments a grant may RUN; a workspace id in that set matches
 * no experiment, so scoping a grant to a workspace confers workspace access and
 * ZERO experiment runs. That is the fail-closed direction and is deliberate.
 */
export const ASSIGNABLE_RESEARCH_WORKSPACES: { id: string; label: string }[] = RESEARCH_WORKSPACES.map(
  (w) => ({ id: w.id, label: researchWorkspaceLabel(w) }),
);
