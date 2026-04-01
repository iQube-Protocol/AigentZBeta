# Studio Artifact Schema

> Canonical handoff format for builder workflows, Studio outputs, Runtime ingestion, and Registry updates.
> Used by Epic 6 (Codex ↔ Studio ↔ Runtime closed loop).

---

## StudioArtifact

```typescript
interface StudioArtifact {
  // Identity
  job_id: string                           // UUID, unique per Studio run
  source_surface: ArtifactSourceSurface
  created_at: string
  created_by: string                       // agent_id or user persona_id
  status: ArtifactStatus

  // Impact declaration (required for all runtime-facing changes)
  target_surfaces: ArtifactTargetSurface[]
  journey_segments_affected: JourneyStage[]
  ui_surfaces_affected: string[]           // component paths or surface names
  package_dependencies: string[]           // registry package_ids

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
  parent_artifact_id: string | null        // for incremental runs
  codex_entry_ids: string[]                // Codex task ledger references
  dvn_receipt_ids: string[]
}
```

### Types

```typescript
type ArtifactSourceSurface = 'studio' | 'codex' | 'registry' | 'guardian' | 'cli'

type ArtifactTargetSurface = 'runtime' | 'codex' | 'registry' | 'studio'

type ArtifactStatus =
  | 'draft'           // being composed
  | 'pending_review'  // awaiting policy/specialist review
  | 'approved'        // cleared for ingestion
  | 'ingested'        // consumed by target surface
  | 'failed'          // validation or policy failed
  | 'rolled_back'     // reverted

type ValidationStatus = 'pending' | 'passed' | 'failed' | 'skipped'

interface StateChange {
  change_type: 'create' | 'update' | 'delete' | 'activate' | 'deactivate'
  surface: ArtifactTargetSurface
  entity_type: string          // e.g. 'journey_state', 'prompt_logic', 'registry_package'
  entity_id: string
  before_state: unknown
  after_state: unknown
  receipt_eligible: boolean
}

interface AcceptanceCheck {
  check_id: string
  description: string
  check_type: 'automated' | 'manual' | 'policy'
  status: 'pending' | 'passed' | 'failed'
  result_notes: string | null
}

interface FollowUpTask {
  task_id: string
  description: string
  assigned_agent: string       // agent_id or 'human'
  priority: 'high' | 'medium' | 'low'
  depends_on: string[]         // job_ids
}
```

---

## Studio Initializer (Epic 5.1)

Required fields for every serious Studio run:
```typescript
interface StudioInitializer {
  dis: string                  // Design Intent Spec content
  constraint_manifest: string
  surface_plan: string[]
  capability_dependencies: string[]
  registry_dependencies: string[]
  runtime_impact_map: RuntimeImpactMap
  acceptance_test_plan: string[]
  receipt_requirements: string[]
}

interface RuntimeImpactMap {
  affects_runtime_shell: boolean
  affects_cartridge_logic: boolean
  affects_codex_memory: boolean
  affects_registry_packages: boolean
  affects_journey_ladder_logic: boolean
  affects_investor_funnel: boolean
  affected_components: string[]
  affected_api_routes: string[]
}
```

---

## Codex↔Studio Sync Contract

Studio output updates these Codex surfaces:
1. AgentiQ Codex task ledger (`crm_task_templates`)
2. Relevant cartridge codex entries
3. Runtime-facing configuration state
4. Journey state model if ladder logic changed

Runtime reads approved artifacts and updates:
1. Prompt logic
2. Handoff logic
3. Visible next-step options
4. Journey messaging

---

## Rollback Protocol

If artifact fails validation or policy review:
1. Set `status = 'failed'`, `validation_status = 'failed'`
2. Prevent Runtime activation (Runtime checks status before ingesting)
3. Preserve full audit trail (never delete, only mark failed)
4. If Runtime already ingested: set `status = 'rolled_back'`, emit `rollback_triggered` event
5. `rollback_artifact_id` points to the previous valid state

---

## Example: KNYT Experience Tab Studio Run

```json
{
  "job_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "source_surface": "studio",
  "status": "approved",
  "target_surfaces": ["codex", "runtime"],
  "journey_segments_affected": ["acolyte", "keta", "keji"],
  "ui_surfaces_affected": ["AgenticDesignParityPanel", "KnytLivingCanonTemplate"],
  "package_dependencies": ["knyt:living_canon_v1", "knyt:experience_tab_v1"],
  "state_changes": [
    {
      "change_type": "create",
      "surface": "runtime",
      "entity_type": "experience_matrix",
      "entity_id": "knyt-21sats-v1",
      "before_state": null,
      "after_state": { "stages": ["acolyte","keta","keji"] },
      "receipt_eligible": true
    }
  ],
  "acceptance_checks": [
    { "check_id": "parity", "description": "UI parity preserved", "check_type": "automated", "status": "passed", "result_notes": null },
    { "check_id": "policy", "description": "No sovereign data exposed", "check_type": "policy", "status": "passed", "result_notes": null }
  ],
  "follow_up_tasks": [],
  "validation_status": "passed",
  "rollback_available": true
}
```
