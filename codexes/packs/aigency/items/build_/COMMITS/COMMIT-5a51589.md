# Commit Brief: `5a51589` — Chrysalis Phase 2.2: Capability Pipeline tab (dev interface v1) + EXP-004 sovereignty drill

| Field | Value |
|-------|-------|
| SHA | [`5a51589`](https://github.com/iQube-Protocol/AigentZBeta/commit/5a515890ce862fe69ea415c489c26b12542a297a) |
| Author | Claude |
| Date | 2026-07-06T06:08:17Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Chrysalis Phase 2.2: Capability Pipeline tab (dev interface v1) + EXP-004 sovereignty drill

Two gates unblocked:

- Capability Pipeline tab (admin-only, AgentiQ cartridge): Aigent Z
  becomes the development interface v1 — capability goal in,
  constitutionally grounded Implementation Pack out, rendered with full
  provenance (invariant bindings with seed markers, resolved canonical
  terms, nine-mechanism chip — code is not privileged, composedBy
  honesty badge, validation + receipt plans, canon version) and a
  byte-identical markdown copy for hand-off to any implementation
  provider. Pipeline stage strip is honest: live stages lit,
  risk/value/price shown as unevaluated ratified stubs. No deploy
  wiring (Law XI — operator-gated, later phase).

- EXP-004 Sovereignty Drill (Experiment Lab, 5th experiment tab):
  venice-only BY CONSTRUCTION — SOVEREIGN_PROVIDER pinned in the
  service, the API accepts no provider parameter. Battery: the five
  EXP-003 constitutional tasks (initialized arm, like-for-like ids for
  degradation comparison against the frontier record) + one
  implementation-pack generation (generateImplementationPack gains an
  optional providerPin that bypasses the router for the drill; template
  fallback applies identically — survivability by construction).
  Completion = the sovereignty claim; groundedness/citations/tokens =
  the degradation report, reported never scored. Task failure records
  as constitutional failure — the drill's core datum, including the
  honest no-key banner. Publishes canonically (EXP-004 added to the
  results pipeline union + allowlist).

Canaries: provider-pin + battery-shape tests. CFS-015 Appendix B
increment record updated.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Two gates unblocked:

- Capability Pipeline tab (admin-only, AgentiQ cartridge): Aigent Z
  becomes the development interface v1 — capability goal in,
  constitutionally grounded Implementation Pack out, rendered with full
  provenance (invariant bindings with seed markers, resolved canonical
  terms, nine-mechanism chip — code is not privileged, composedBy
  honesty badge, validation + receipt plans, canon version) and a
  byte-identical markdown copy for hand-off to any implementation
  provider. Pipeline stage strip is honest: live stages lit,
  risk/value/price shown as unevaluated ratified stubs. No deploy
  wiring (Law XI — operator-gated, later phase).

- EXP-004 Sovereignty Drill (Experiment Lab, 5th experiment tab):
  venice-only BY CONSTRUCTION — SOVEREIGN_PROVIDER pinned in the
  service, the API accepts no provider parameter. Battery: the five
  EXP-003 constitutional tasks (initialized arm, like-for-like ids for
  degradation comparison against the frontier record) + one
  implementation-pack generation (generateImplementationPack gains an
  optional providerPin that bypasses the router for the drill; template
  fallback applies identically — survivability by construction).
  Completion = the sovereignty claim; groundedness/citations/tokens =
  the degradation report, reported never scored. Task failure records
  as constitutional failure — the drill's core datum, including the
  honest no-key banner. Publishes canonically (EXP-004 added to the
  results pipeline union + allowlist).

Canaries: provider-pin + battery-shape tests. CFS-015 Appendix B
increment record updated.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/experiments/exp004/route.ts` |
| Modified | `app/api/experiments/results/route.ts` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Added | `components/composer/CapabilityPipelineTab.tsx` |
| Added | `components/composer/Exp004SovereigntyRunner.tsx` |
| Modified | `components/composer/InvariantExperimentLab.tsx` |
| Modified | `data/codex-configs.ts` |
| Modified | `services/constitutional/implementationPack.ts` |
| Added | `services/experiments/exp004.ts` |
| Modified | `services/experiments/publishResult.ts` |
| Modified | `tests/constitutional-contracts.test.ts` |

## Stats

 12 files changed, 760 insertions(+), 11 deletions(-)
