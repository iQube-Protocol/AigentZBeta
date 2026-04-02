/**
 * Studio artifact schema — shared handoff format for builder workflows,
 * Studio outputs, Runtime ingestion, and Registry updates.
 * Canonical source: docs/agent-harness/studio-artifact-schema.md
 *
 * Epic 6 — CSR-601
 */

import type { JourneyStage } from './orchestration';

export type ArtifactSourceSurface = 'studio' | 'codex' | 'registry' | 'guardian' | 'cli'
export type ArtifactTargetSurface = 'runtime' | 'codex' | 'registry' | 'studio'

export type ArtifactStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'ingested'
  | 'failed'
  | 'rolled_back'

export type ValidationStatus = 'pending' | 'passed' | 'failed' | 'skipped'

export interface StateChange {
  change_type: 'create' | 'update' | 'delete' | 'activate' | 'deactivate'
  surface: ArtifactTargetSurface
  entity_type: string
  entity_id: string
  before_state: unknown
  after_state: unknown
  receipt_eligible: boolean
}

export interface AcceptanceCheck {
  check_id: string
  description: string
  check_type: 'automated' | 'manual' | 'policy'
  status: 'pending' | 'passed' | 'failed'
  result_notes: string | null
}

export interface FollowUpTask {
  task_id: string
  description: string
  assigned_agent: string
  priority: 'high' | 'medium' | 'low'
  depends_on: string[]
}

export interface RuntimeImpactMap {
  affects_runtime_shell: boolean
  affects_cartridge_logic: boolean
  affects_codex_memory: boolean
  affects_registry_packages: boolean
  affects_journey_ladder_logic: boolean
  affects_investor_funnel: boolean
  affected_components: string[]
  affected_api_routes: string[]
}

export interface StudioInitializer {
  dis: string
  constraint_manifest: string
  surface_plan: string[]
  capability_dependencies: string[]
  registry_dependencies: string[]
  runtime_impact_map: RuntimeImpactMap
  acceptance_test_plan: string[]
  receipt_requirements: string[]
}

export interface StudioArtifact {
  job_id: string
  source_surface: ArtifactSourceSurface
  created_at: string
  created_by: string
  status: ArtifactStatus

  // Impact declaration
  target_surfaces: ArtifactTargetSurface[]
  journey_segments_affected: JourneyStage[]
  ui_surfaces_affected: string[]
  package_dependencies: string[]

  // Content
  state_changes: StateChange[]
  proof_requirements: string[]
  acceptance_checks: AcceptanceCheck[]
  follow_up_tasks: FollowUpTask[]

  // Validation
  validation_status: ValidationStatus
  validation_errors: string[]
  rollback_available: boolean
  rollback_artifact_id: string | null

  // Provenance
  parent_artifact_id: string | null
  codex_entry_ids: string[]
  dvn_receipt_ids: string[]
  initializer: StudioInitializer | null
}

/** Minimum required fields to create a valid draft artifact */
export type StudioArtifactDraft = Pick<
  StudioArtifact,
  | 'source_surface'
  | 'target_surfaces'
  | 'journey_segments_affected'
  | 'ui_surfaces_affected'
  | 'state_changes'
> & { created_by: string }

export function createDraftArtifact(draft: StudioArtifactDraft): StudioArtifact {
  const job_id = crypto.randomUUID();
  return {
    job_id,
    source_surface: draft.source_surface,
    created_at: new Date().toISOString(),
    created_by: draft.created_by,
    status: 'draft',
    target_surfaces: draft.target_surfaces,
    journey_segments_affected: draft.journey_segments_affected,
    ui_surfaces_affected: draft.ui_surfaces_affected,
    package_dependencies: [],
    state_changes: draft.state_changes,
    proof_requirements: [],
    acceptance_checks: [],
    follow_up_tasks: [],
    validation_status: 'pending',
    validation_errors: [],
    rollback_available: false,
    rollback_artifact_id: null,
    parent_artifact_id: null,
    codex_entry_ids: [],
    dvn_receipt_ids: [],
    initializer: null,
  };
}
