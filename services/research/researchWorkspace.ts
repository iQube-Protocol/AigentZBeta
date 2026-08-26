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

/**
 * The left-hand navigator's grouping (2026-07-29 restructure), mirroring the
 * Laboratory → Experiments sidebar's section pattern
 * (`components/composer/InvariantExperimentLab.tsx`). FOUR sections, per the
 * operator's own list — a UI-level grouping, distinct from `parentId`
 * hierarchy: 'autonomi' holds BOTH the Autonomi Independent Review Programme
 * (whose three experiment children truly are `parentId`-nested beneath it)
 * AND Validation Programme v1 as a SIBLING root within the same section — VP1
 * is not a `parentId` child of the Autonomi programme (the registry does not
 * express that membership; its members are EXP-P1/P2/P3 workspaces the
 * Autonomi programme separately reviews), but the operator named it as
 * belonging in the Autonomi section, so it sits there ungrouped rather than
 * invented as a nested child it structurally is not.
 *
 * 'ocsga' ADDED (2026-08-25) for the OCSGA Boundary Research collaboration —
 * its own section rather than folded into 'autonomi' or 'lehigh': it is
 * neither an Autonomi review child nor a Lehigh capstone, so it is a fifth
 * institution-scoped root, the same shape 'lehigh' itself is (its own
 * section, a single root workspace, no forced nesting under an unrelated
 * partner's section).
 */
export type ResearchWorkspaceNavSection = 'autonomi' | 'lehigh' | 'mfe-capstone' | 'cs-capstone' | 'ocsga';

/** The five sections, in left-nav display order. */
export const RESEARCH_NAV_SECTIONS: { id: ResearchWorkspaceNavSection; label: string }[] = [
  { id: 'autonomi', label: 'Autonomi' },
  { id: 'lehigh', label: 'Lehigh' },
  { id: 'mfe-capstone', label: 'MFE Capstone' },
  { id: 'cs-capstone', label: 'CS Capstone' },
  { id: 'ocsga', label: 'OCSGA' },
];

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
   * The left-nav SECTION this workspace's subtree sits under (see
   * `ResearchWorkspaceNavSection` above). Declared only on the workspace that
   * STARTS a section — inherited by every descendant via the same
   * nearest-ancestor walk `researchWorkspaceOwner` etc. use, so a child never
   * has to restate it. `researchWorkspaceNavSection` resolves it; a workspace
   * that resolves to none renders ungrouped (does not currently occur in the
   * shipped registry — a canary asserts every workspace resolves a section).
   */
  navSection?: ResearchWorkspaceNavSection;
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
    // Left-nav section (2026-07-29): grouped with Autonomi in the UI per the
    // operator's own instruction, though NOT a `parentId` child of it — see
    // `ResearchWorkspaceNavSection`'s doc comment for why the two are
    // deliberately different relationships.
    navSection: 'autonomi',
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
    navSection: 'autonomi',
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
    /**
     * DECLARED HERE, NOT INHERITED (Post-Freeze Observer Review Closure,
     * point 2, 2026-08-09): every other field on this workspace inherits
     * from `autonomi-independent-review-programme`, but the Observer Review
     * link is EXP-P1-specific — EXP-P2/P3 are pre-freeze and have no frozen
     * crystal to observe yet. Carries the programme's own three links
     * forward explicitly (own `links` REPLACES rather than merges with the
     * inherited value — `researchWorkspaceLinks`'s `inherited()` walk) so
     * this workspace does not lose them by declaring one more.
     */
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
        id: 'irl-observer-review',
        label: 'Observer Review',
        description:
          'The canonical external-observer surface for EXP-P1\'s frozen crystal — hash-bound Observer ' +
          'Review Package, self-service structured decision submission, and change-proposal handling ' +
          '(Post-Freeze Observer Review Closure).',
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
    // Its OWN section (2026-07-29) — a flat, single left-nav entry. Its two
    // cohorts each START their own section below (MFE Capstone / CS Capstone)
    // rather than inheriting this one, per the operator's explicit three-way
    // split; see `ResearchWorkspaceNavSection`'s doc comment.
    navSection: 'lehigh',
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
    // Overrides the parent's 'lehigh' section — this cohort and its three
    // student projects form their OWN left-nav section (the operator's "MFE
    // Capstone" section: four items — the cohort plus its three projects).
    navSection: 'mfe-capstone',
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
    // Overrides the parent's 'lehigh' section — see lehigh-mfe-capstone above.
    navSection: 'cs-capstone',
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

  // ── OCSGA Boundary Research (2026-08-25) ─────────────────────────────────
  //
  // Registers the OCSGA collaboration as a standard, steward-issuable Research
  // Lab scope — the SAME mechanism as every workspace above, so it is
  // reachable from the existing Access & Invitations page with no new
  // invitation path. This is deliberately a ROOT `research-programme`, not an
  // `experiment` workspace: the collaboration is currently at architecture
  // exchange / boundary-research preparation, with no registered
  // EXPERIMENT_REGISTRY entry to scope an `experiment` workspace to (unlike
  // the Autonomi programme's EXP-P1/P2/P3 children). Inventing an experiment
  // id here to fit the `experiment` shape would be exactly the fabrication
  // CLAUDE.md's "No Guessing or Hallucinating" rule forbids — a formally
  // constituted OCSGA experiment, if and when one is registered in
  // EXPERIMENT_REGISTRY, gets its own child workspace the same way EXP-P1
  // does under Autonomi, without renaming or restructuring this entry.
  //
  // `currentStage: 'Concept'` is the honest nearest fit inside the
  // `research-experiment` lifecycle template's FIXED stage vocabulary
  // (`services/experiments/workspaceLifecycle.ts` — Concept, Protocol,
  // Review, Preregistration, Freeze, Task Construction, Run, Adjudication,
  // Interpretation, Publication, Replication; enforced verbatim by
  // `tests/research-workspace-spec.test.ts`'s "every workspace's stage is a
  // real member of its own template" canary). "Architecture Exchange" is not
  // a member of that vocabulary and is not invented as one here — it is
  // carried instead in `description`, where free text is honest. `Concept`
  // is the same least-advanced stage `autonomi-review-exp-p3` (also
  // pre-protocol) already uses.
  {
    id: 'ocsga-boundary-research',
    workspaceType: 'research-programme',
    navSection: 'ocsga',
    title: 'OCSGA Boundary Research',
    description:
      'Independent architecture exchange, boundary comparison and subsequent experimental design between OCSGA and Constitutional Computing / IRL.',
    institutionRefs: ['OCSGA', 'Invariant Research Laboratory'],
    lifecycleTemplateId: 'research-experiment',
    currentStage: 'Concept',
    // LAYER OWNERSHIP MIRRORS THE RATIFIED HORIZEN ASSIGNMENTS, the same as
    // every other programme-level workspace above (VP1, Autonomi, Lehigh) —
    // NOT separately operator-ratified for this specific collaboration.
    // Recorded as pending rather than asserted as settled, the same
    // discipline VP1's own entry states above.
    ownerAgentId: 'aigent-z',
    layerOwners: {
      operations: 'aigent-z',
      knowledge: 'aigent-kn0w1',
      relationship: 'aigent-marketa',
      governance: 'metame-guardian',
    },
    // Access-boundary correction (2026-08-26): External IRL participation is
    // always mediated through IRL OS; metaMe IRL is strictly admin-gated. The
    // Protocols link below was pointing OCSGA's own participant (Ian) at a
    // metaMe IRL tab (irl-protocols), now admin-only — a non-admin following
    // it would hit metaMe IRL's fallback/empty state. Repointed at its IRL OS
    // mirror (irl-os-protocols — same content, participant-facing cartridge,
    // confirmed enabled and ungated in data/codex-configs.ts).
    //
    // Records & Findings is DELIBERATELY DROPPED, not repointed: IRL OS's own
    // mirror (irl-os-records) is `enabled: false` with its own comment —
    // "INTERNAL — the constitutional record lives in the metaMe IRL edition
    // only" — a pre-existing design decision, not a gap this pass invented.
    // Pointing Ian at it would mean either a disabled/hidden IRL OS tab or
    // (before this pass) an inadvertent peek into an internal-only surface
    // via the workspace link, which the metaMe IRL adminOnly fix now
    // correctly closes. Neither destination is safe to keep; an honest
    // absence is correct until an operator decides Records should have a
    // real participant-facing home.
    //
    // The Exchange link stays UNCHANGED: it is the concrete OCSGA
    // collaboration surface itself (irl-cartridge's irl-exchange tab is
    // deliberately NOT admin-gated — see its own comment in
    // data/codex-configs.ts), and there is no IRL OS equivalent to reroute it
    // to.
    links: [
      {
        id: 'irl-protocols',
        label: 'Protocols & Articles',
        description: 'Pre-registration protocols, experiment designs, evaluation frameworks',
        codexSlug: 'irl-os-cartridge',
        tab: 'irl-os-protocols',
        area: 'overview',
      },
      {
        id: 'irl-exchange',
        label: 'Exchange',
        description:
          'Reciprocal Artifact Exchange — bilateral, receipted exchange of independently frozen research artifacts (the concrete OCSGA collaboration surface, PRD-IRL-AX-001)',
        codexSlug: 'irl-cartridge',
        tab: 'irl-exchange',
        area: 'operate',
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

/**
 * The left-nav section this workspace renders under (2026-07-29), inherited
 * from the nearest ancestor that declares one. Null only for a workspace whose
 * whole ancestry declares none — does not occur in the shipped registry (a
 * canary asserts every workspace resolves a section), but a UI reading this
 * must still handle the honest absence rather than assume every id resolves.
 */
export function researchWorkspaceNavSection(ws: ResearchWorkspace): ResearchWorkspaceNavSection | null {
  return inherited(ws, 'navSection') ?? null;
}

/**
 * This workspace's INDENTATION depth within its left-nav section (2026-07-29)
 * — 0 for a workspace that STARTS a section (its nearest section-defining
 * ancestor is itself), incrementing by one per ancestor step that stays
 * within the SAME resolved section. A workspace whose parent sits in a
 * DIFFERENT section — `lehigh-mfe-capstone`, whose `parentId` is
 * `lehigh-capstone-programme` (section 'lehigh') but who itself starts the
 * 'mfe-capstone' section — is depth 0 despite not being a tree root. Cycle-
 * guarded the same way `researchWorkspaceAncestry` is: a workspace already
 * visited on the walk stops the count rather than looping.
 */
export function researchWorkspaceNavDepth(ws: ResearchWorkspace): number {
  const mySection = researchWorkspaceNavSection(ws);
  let depth = 0;
  let node: ResearchWorkspace | null = ws;
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    const parent = researchWorkspaceParent(node);
    if (!parent || researchWorkspaceNavSection(parent) !== mySection) break;
    depth += 1;
    node = parent;
  }
  return depth;
}

/**
 * Is this workspace's title operator-editable (2026-07-29 ruling)? Autonomi's
 * items are real, registered experiments — never editable. Every other
 * section (Lehigh, MFE Capstone, CS Capstone) is a casual placeholder title
 * and may be renamed. Derived from the resolved nav section rather than a
 * second per-workspace flag, so the two can never disagree.
 */
export function researchWorkspaceTitleEditable(ws: ResearchWorkspace): boolean {
  return researchWorkspaceNavSection(ws) !== 'autonomi';
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
