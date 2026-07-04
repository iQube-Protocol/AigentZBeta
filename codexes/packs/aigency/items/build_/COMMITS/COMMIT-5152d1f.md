# Commit Brief: `5152d1f` — Add Experiment Lab: run EXP-001/002/003 from the front end + cartridge tab

| Field | Value |
|-------|-------|
| SHA | [`5152d1f`](https://github.com/iQube-Protocol/AigentZBeta/commit/5152d1f52a0757679eccbe6d3ae7060a42c8dde1) |
| Author | Claude |
| Date | 2026-07-04T20:33:51Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add Experiment Lab: run EXP-001/002/003 from the front end + cartridge tab

The invariant-video page grows into a three-tab Experiment Lab (route
kept for bookmarks): EXP-002 Video (existing runner), EXP-001 Bundle
Evaluation, EXP-003 Rediscovery — no more terminal harness runs. The
front end orchestrates each protocol step-by-step against new stateless
admin-gated step APIs (/api/experiments/exp001, /api/experiments/
exp003 — one LLM call per request, Lambda-timeout-safe), with live
per-step progress, abort, targets tables mirroring the harness output
(incl. constitutional restraint), and results-JSON download for the
experiment record. Task sets and question banks move to shared JSONs
(services/experiments/) read by BOTH the lab services and the offline
harness scripts, so runs stay comparable regardless of entry point.
The lab also mounts as an admin-only Experiment Lab tab in the AgentiQ
cartridge (memory group, next to the Experiments docs) via the
TabRenderer registry, so the series is runnable inside the
multi-cartridge viewer. next.config gains the tracing include so the
EXP-001 artifact markdown ships in its route's Lambda.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The invariant-video page grows into a three-tab Experiment Lab (route
kept for bookmarks): EXP-002 Video (existing runner), EXP-001 Bundle
Evaluation, EXP-003 Rediscovery — no more terminal harness runs. The
front end orchestrates each protocol step-by-step against new stateless
admin-gated step APIs (/api/experiments/exp001, /api/experiments/
exp003 — one LLM call per request, Lambda-timeout-safe), with live
per-step progress, abort, targets tables mirroring the harness output
(incl. constitutional restraint), and results-JSON download for the
experiment record. Task sets and question banks move to shared JSONs
(services/experiments/) read by BOTH the lab services and the offline
harness scripts, so runs stay comparable regardless of entry point.
The lab also mounts as an admin-only Experiment Lab tab in the AgentiQ
cartridge (memory group, next to the Experiments docs) via the
TabRenderer registry, so the series is runnable inside the
multi-cartridge viewer. next.config gains the tracing include so the
EXP-001 artifact markdown ships in its route's Lambda.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/admin/studio/invariant-video/page.tsx` |
| Added | `app/api/experiments/exp001/route.ts` |
| Added | `app/api/experiments/exp003/route.ts` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `components/composer/Exp001EvaluationRunner.tsx` |
| Added | `components/composer/Exp003RediscoveryRunner.tsx` |
| Added | `components/composer/InvariantExperimentLab.tsx` |
| Modified | `data/codex-configs.ts` |
| Modified | `next.config.js` |
| Modified | `scripts/benchmark-rediscovery.mjs` |
| Modified | `scripts/evaluate-exp001.mjs` |
| Added | `services/experiments/exp001-config.json` |
| Added | `services/experiments/exp001.ts` |
| Added | `services/experiments/exp003-tasks.json` |
| Added | `services/experiments/exp003.ts` |
| Added | `services/experiments/llm.ts` |

## Stats

 16 files changed, 1461 insertions(+), 77 deletions(-)
