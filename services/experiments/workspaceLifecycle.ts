/**
 * workspaceLifecycle — the SHARED lifecycle-template registry for the common
 * constitutional workspace primitive (SPEC-IRL-WORKSPACE-001 §5, §7).
 *
 * THE PRIMITIVE CARRIES `lifecycleTemplateId`; THIS FILE IS WHERE THAT ID
 * RESOLVES. Both Labs read it: the Venture Lab's pilot ladder and the Research
 * Lab's experiment and capstone pipelines are three entries in ONE registry,
 * not three lifecycle systems. A Lab that grew its own stage list would be the
 * fork SPEC-IRL-WORKSPACE-001 §5 forbids ("the research implementation
 * CONFIGURES this primitive; it must not fork it").
 *
 * THE VENTURE TEMPLATE IS DERIVED, NEVER TRANSCRIBED. `venture-pilot`'s stages
 * come from `PARTNER_WORKSPACE_PHASES` — the ladder `PartnerWorkspace.phase` is
 * typed against — so a phase added, removed or reordered upstream moves this
 * template with it. Hand-listing the five phases here is exactly the defect
 * `tests/source-of-truth-parity.test.ts` exists to index (EXPERIMENT_REGISTRY →
 * `col_experiments`, `ASSIGNABLE_EXPERIMENTS`, the pack-corpus sniff: three
 * same-day stale duplicates of a single source of truth).
 *
 * THE RESEARCH TEMPLATES ARE THE SPEC'S OWN WORDS. `research-experiment` and
 * `capstone` transcribe SPEC-IRL-WORKSPACE-001 §7's two pipelines verbatim and
 * in order, and `tests/research-workspace-spec.test.ts` reads the stage lists
 * back out of the spec document to prove they still match. There is no upstream
 * runtime value to derive them from — the spec IS the upstream — so the parity
 * canary is the mechanism that stops them drifting (the discipline CLAUDE.md's
 * source-of-truth-parity rule prescribes when derivation is impossible).
 *
 * A TEMPLATE IS A DESCRIPTION, NOT A GATE. Nothing here decides what a caller
 * may do; stage order is how a workspace narrates where it is. Authority lives
 * in `participationTabGate` (what renders), the workspace route (what is
 * permitted) and `researchWorkspaceRoles` (what a role may do). Reading a stage
 * name must never become a permission check.
 */

import { PARTNER_WORKSPACE_PHASES } from '@/services/venture/partnerWorkspace';

// ─── Workspace types (SPEC-IRL-WORKSPACE-001 §5) ─────────────────────────────

/**
 * The six kinds of workspace the shared primitive models. Two venture, four
 * research — one union, because the whole point of the primitive is that the
 * hierarchy is a property of the engine and not of either Lab.
 */
export const WORKSPACE_TYPES = [
  'venture-programme',
  'pilot',
  'research-programme',
  'experiment',
  'cohort',
  'student-project',
] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

/**
 * Visibility postures. `invited` is the middle state the spec names and the
 * one every research workspace ships in: reachable by an invited, scoped
 * member, and by nobody else. `public` is NEVER a default — SPEC §11: "Nothing
 * becomes public by default", and reaching it requires an explicit publication
 * act, which nothing in this module performs.
 */
export const WORKSPACE_VISIBILITIES = ['private', 'invited', 'public'] as const;
export type WorkspaceVisibilityPosture = (typeof WORKSPACE_VISIBILITIES)[number];

/**
 * SPEC §11 / acceptance criterion 11, as a value rather than a paragraph.
 * A surface or registry that wants a workspace public must perform a
 * publication act; there is no configuration that makes `public` the
 * fall-through. `defaultVisibility` is what any workspace gets when its
 * registry entry declares nothing, and it is deliberately the closed end.
 */
export const DEFAULT_WORKSPACE_VISIBILITY: WorkspaceVisibilityPosture = 'invited';

// ─── The templates ───────────────────────────────────────────────────────────

export interface LifecycleTemplate {
  id: string;
  label: string;
  /** The stages, IN ORDER. Order is the whole content of a pipeline. */
  stages: string[];
}

/** Title-case a kebab/lower identifier for display — no vocabulary invented. */
function stageLabel(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const WORKSPACE_LIFECYCLE_TEMPLATES: LifecycleTemplate[] = [
  {
    id: 'venture-pilot',
    label: 'Venture pilot',
    // DERIVED — see the header. The venture ladder has exactly one home.
    stages: PARTNER_WORKSPACE_PHASES.map(stageLabel),
  },
  {
    id: 'research-experiment',
    label: 'Research experiment',
    // SPEC-IRL-WORKSPACE-001 §7, experiment template, verbatim and in order.
    stages: [
      'Concept',
      'Protocol',
      'Review',
      'Preregistration',
      'Freeze',
      'Task Construction',
      'Run',
      'Adjudication',
      'Interpretation',
      'Publication',
      'Replication',
    ],
  },
  {
    id: 'capstone',
    label: 'Capstone',
    // SPEC-IRL-WORKSPACE-001 §7, capstone template, verbatim and in order.
    stages: [
      'Brief',
      'Research Plan',
      'Source/Data Review',
      'Build or Analysis',
      'Review',
      'Revision',
      'Submission',
      'Demonstration',
      'Archive/Commons',
    ],
  },
];

export type LifecycleTemplateId = string;

export function getLifecycleTemplate(id: LifecycleTemplateId): LifecycleTemplate | null {
  return WORKSPACE_LIFECYCLE_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Where a workspace is on its own ladder. Returns -1 for a stage the template
 * does not declare — surfaced honestly by the caller rather than coerced to 0,
 * because "we do not know which stage this is" and "it is at the first stage"
 * are different facts and must not render alike.
 */
export function lifecycleStageIndex(template: LifecycleTemplate, stage: string | null): number {
  if (!stage) return -1;
  return template.stages.indexOf(stage);
}
