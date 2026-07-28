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

export interface ResearchWorkspace {
  id: string;
  /**
   * The validation series this workspace convenes. MUST exist in
   * SERIES_REGISTRY — `researchWorkspaceSeries` returns null otherwise and
   * `workspaceReferenceIssues` surfaces the gap rather than rendering a
   * fabricated programme.
   */
  seriesId: string;
  /** Workspace owner + orchestrator. A RUNTIME agent — it must be executable. */
  ownerAgentId: PartnerLayerOwnerId;
  /** The agent division of labour; null = no real owner id exists for a layer. */
  layerOwners: Partial<Record<PartnerWorkspaceLayer, PartnerLayerOwnerId | null>>;
  /** Deep links into the existing home of each capability (never raw URLs). */
  links: PartnerWorkspaceLink[];
}

// ─── The registry — ONE authoritative list ───────────────────────────────────

export const RESEARCH_WORKSPACES: ResearchWorkspace[] = [
  {
    // The Institute's live collaborative programme. VP1 is the series the
    // platform already carries live instrumentation for — the EXP-P1 Readiness
    // instrument (`ExpP1ReadinessTab`, PRD-EPI-001 §10) and the external EXP-P1
    // review the Participation overview names as the reviewer engagement.
    id: 'irl-validation-programme-vp1',
    seriesId: 'VP1',
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

/**
 * The operator-facing label. Derived from the series name — never a second
 * copy of it, so renaming the series in SERIES_REGISTRY renames the workspace.
 */
export function researchWorkspaceLabel(ws: ResearchWorkspace): string {
  const series = researchWorkspaceSeries(ws);
  return series ? `${series.name} (${series.id})` : ws.id;
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
  if (!series) return [];
  return [
    series.claim,
    ...researchWorkspaceExperiments(ws).map((e) => `${e.id} · ${e.programmeFocus ?? e.family}`),
  ];
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
