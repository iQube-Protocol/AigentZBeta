# Commit Brief: `4b2a9a9` — add experience pipeline control plane service layer

| Field | Value |
|-------|-------|
| SHA | [`4b2a9a9`](https://github.com/iQube-Protocol/AigentZBeta/commit/4b2a9a9d48a87709a7078152a2ff1fe573e9767a) |
| Author | Claude |
| Date | 2026-03-26T00:05:14Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add experience pipeline control plane service layer

services/pipeline/types.ts — PipelineIdentityEnvelope (tenantId, userId,
personaId, agentId, sourceOfTruth, resolvedAt, resolutionStatus),
PipelineRun, PipelineStage union (17 stages), PipelineStatus,
PipelineStageEvent, PipelineRunEvent.

services/pipeline/persistence.ts — Supabase-backed store with requireSupabase()
that throws immediately if client unavailable. No silent fallback for
pipeline-critical writes in production.

services/pipeline/orchestrator.ts — ExperiencePipelineOrchestrator singleton.
initiate() creates PipelineRun, transition() enforces authority gate for
deploy-phase stages (Aigent Z / Agent Z only), complete/fail/block() are
terminal state setters.

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
