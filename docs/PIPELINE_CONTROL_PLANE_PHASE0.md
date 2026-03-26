# Pipeline Control Plane — Phase 0

## Date: 2026-03-26

---

## Problem

Before this change, ComposerStudio.tsx was the de-facto orchestrator of the experience pipeline — directly committing state (ExperienceQube creation, session completion, cache writes) without any:

- **Identity audit trail** — who initiated the run, resolved from where
- **Stage tracking** — no record of where a run is in the pipeline lifecycle
- **Authority enforcement** — Studio and Marketa could commit deploy-phase state directly
- **Production guardrails** — persistence failures silently fell back to ephemeral in-memory/local storage
- **Diagnostics surface** — no way for operators to inspect a pipeline run in progress or after the fact

---

## Solution

A thin, authoritative control plane wrapping the experience pipeline.

```
Studio / Marketa / API caller
    │
    ▼
ExperiencePipelineOrchestrator   ← single authority for stage transitions
    │   services/pipeline/orchestrator.ts
    │
    ├── PipelineRun (Supabase)    ← one row per invocation, full stage history
    │   services/pipeline/persistence.ts
    │   supabase: pipeline_runs, pipeline_run_events
    │
    ├── composerService.completeSession()  ← unchanged
    │   services/composer/composerService.ts
    │
    └── PipelineRunEvent log      ← append-only, one row per stage transition
```

---

## Authority Model

Studio and Marketa may initiate and advance a run up to `preview.ready`.

Only **Aigent Z / Agent Z** may commit state past that boundary:
- `deploy.runtime.started`
- `deploy.runtime.completed`
- `deploy.distribution.started`
- `deploy.distribution.completed`
- `receipt.recorded`

The authority check uses `identityEnvelope.agentId`. Allowed values default to any string containing `"aigent-z"` or `"agent-z"` (case-insensitive), or an explicit list from the `PIPELINE_AUTHORITATIVE_AGENTS` environment variable.

---

## IdentityEnvelope (PipelineIdentityEnvelope)

Created once at pipeline initiation, stored in the `pipeline_runs` row, never mutated.

```typescript
interface PipelineIdentityEnvelope {
  tenantId: string;
  userId?: string;
  personaId: string;
  agentId?: string;           // "aigent-z" | "aigent-c" | "marketa" | etc.
  sourceOfTruth: "wallet-active" | "persona-service" | "fallback" | "explicit";
  resolvedAt: string;
  resolutionStatus: "resolved" | "partial" | "failed";
  policyContextRef?: string;  // ref to QubeTalk policy evaluation if performed
}
```

Identity is resolved server-side via `resolveRuntimeIdentity()` from `services/runtime/identityResolver.ts`.

---

## Stage Vocabulary

| Stage | Who can enter |
|-------|--------------|
| `intent.accepted` | Any initiator |
| `identity.resolving` | Any initiator |
| `identity.resolved` | Any initiator |
| `policy.checking` | Any initiator |
| `policy.blocked` | System |
| `template.selected` | Any initiator |
| `workflow.selected` | Any initiator |
| `session.created` | Any initiator |
| `bundle.generated` | Any initiator |
| `preview.ready` | Any initiator |
| `deploy.runtime.started` | **Aigent Z only** |
| `deploy.runtime.completed` | **Aigent Z only** |
| `deploy.distribution.started` | **Aigent Z only** |
| `deploy.distribution.completed` | **Aigent Z only** |
| `receipt.recorded` | **Aigent Z only** |
| `pipeline.completed` | Orchestrator (terminal) |
| `pipeline.failed` | Orchestrator (terminal) |

---

## Event Types

- `pipeline.stage.changed` — emitted on every stage transition
- `identity.resolution.failed` — identity resolution returned partial/failed
- `policy.blocked` — policy gate denied progression
- `deployment.started` — deploy phase initiated
- `deployment.succeeded` — deploy completed successfully
- `deployment.failed` — deploy failed
- `receipt.recorded` — DVN receipt written
- `pipeline.failed` — terminal failure
- `pipeline.completed` — terminal success

---

## Production Guardrail

`services/pipeline/persistence.ts` — `requireSupabase()` throws immediately if Supabase is unavailable rather than falling back to in-memory or local JSON storage. Pipeline-critical state **must** land in Supabase. If it cannot, the session completion fails explicitly with a clear error message — not silently degraded.

---

## API Surface

| Endpoint | Description |
|----------|-------------|
| `GET /api/pipeline/health` | Mode, table counts, timestamp |
| `GET /api/pipeline/runs/:runId` | Full PipelineRun + event log |
| `POST /api/composer/sessions/:id` `{ action: "complete" }` | Now returns `pipeline_run_id` alongside `experience_qube` |

---

## Database Schema

```sql
-- pipeline_runs: one row per invocation
pipeline_runs (
  pipeline_run_id TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  initiated_by    TEXT NOT NULL,   -- personaId
  initiated_via   TEXT NOT NULL,   -- studio-composer | marketa | api | qubetalk | system
  current_stage   TEXT NOT NULL,
  stage_history   JSONB NOT NULL,  -- PipelineStageEvent[]
  identity_envelope JSONB NOT NULL,
  template_ref    TEXT,
  workflow_ref    TEXT,
  status          TEXT NOT NULL,   -- running | completed | failed | blocked
  started_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  failure_reason  TEXT,
  receipt_refs    JSONB            -- string[]
)

-- pipeline_run_events: append-only event log
pipeline_run_events (
  id         UUID PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES pipeline_runs,
  event_type TEXT NOT NULL,
  stage      TEXT,
  data       JSONB,
  ts         TIMESTAMPTZ
)
```

Migration: `supabase/migrations/20260325020000_pipeline_control_plane_v1.sql`

---

## Phase 1 Extension Path (WorkflowQube)

This control plane is designed to become the foundation for the full WorkflowQube architecture:

- `workflowRef` on `PipelineRun` will point to a `workflow_definitions` row (Phase 1 table already created)
- The `workflow.selected` stage is the insertion point where a WorkflowQube binding is resolved
- `AUTHORITATIVE_STAGES` + `isAuthoritativeAgent()` will become the enforcement backbone for ChannelQube policy
- `PipelineRunEvent` rows will become the raw material for ExecutionReceiptQube generation
- DVN submission (`submitQubeTalkReceiptToDvn`) will be wired in at `receipt.recorded` stage

---

## Key Files

| File | Role |
|------|------|
| `services/pipeline/types.ts` | PipelineIdentityEnvelope, PipelineRun, PipelineStage, PipelineRunEvent |
| `services/pipeline/persistence.ts` | Supabase CRUD — no silent fallback |
| `services/pipeline/orchestrator.ts` | ExperiencePipelineOrchestrator singleton |
| `app/api/pipeline/health/route.ts` | Operator health check |
| `app/api/pipeline/runs/[runId]/route.ts` | Run trace diagnostics |
| `app/api/composer/sessions/[id]/route.ts` | Session completion now routed through orchestrator |
| `supabase/migrations/20260325020000_pipeline_control_plane_v1.sql` | Schema |
