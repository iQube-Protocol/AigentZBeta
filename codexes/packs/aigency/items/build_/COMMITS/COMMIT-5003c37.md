# Commit Brief: `5003c37` — Wire the Experiment Lab to the CCRL lifecycle: runs advance research objects through the receipted path

| Field | Value |
|-------|-------|
| SHA | [`5003c37`](https://github.com/iQube-Protocol/AigentZBeta/commit/5003c3715d14689119c2ffab6d9b5fcba422eee1) |
| Author | Claude |
| Date | 2026-07-07T16:34:19Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Wire the Experiment Lab to the CCRL lifecycle: runs advance research objects through the receipted path

Closes the instruments↔institution gap: an EXP run now advances its research
object's lifecycle instead of leaving it untouched. New service seam
recordExperimentRunLifecycle (services/research/lifecycle.ts) composes the
existing recordExperimentTransition / recordResearchObjectCreated — both ride
the ONE writeLifecycleReceipt → research_lifecycle_transition constructor, so
the createActivityReceipt call-site count in the file stays exactly 1.

Run-event → transition mapping: run-started → running (legal from
protocol-ratified onward; re-entering running is first-class — the flywheel);
results-published takes the single legal step within the evaluate→publish band
(running→evaluated, then evaluated→published) and deliberately never drives
replicated (that stays deriveOverview's computed multi-provider signal).
Illegal / out-of-order events refuse honestly — nothing recorded, {ok:false,
reason} returned. Registry experiments predate C2.2 (no research_objects row):
the first run auto-materialises the object at the registry floor (running),
receipts the creation, then transitions, returning created:true.

Route POST /api/research/run-lifecycle (admin-gated identically to
/api/research/lifecycle) never imports services/receipts. Runner wiring is
minimal + additive: the four direct-publishing runners (EXP-001/003/004/005)
fire results-published via personaFetch (never raw fetch) in their
publish-success path, fire-and-forget, appending the outcome inline to the
existing publishState line; EXP-002 advances through the Results-tab backfill
success path. Dashboard reads persisted state: /api/research/overview overlays
the receipted research-object state (overviewWithPersistedLifecycle) onto the
derived floor and CCRLDashboardTab highlights it. Evidence strings carry only
provider/arm labels + counts — no payloads, no T0 ids. Canary
tests/ccrl-run-lifecycle.test.ts pins the mapping, honest refusal, auto-create,
T2-safe evidence, and the single-receipt-site invariant. CFS-019 charter gains
the Phase C2.3 ratification note.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Closes the instruments↔institution gap: an EXP run now advances its research
object's lifecycle instead of leaving it untouched. New service seam
recordExperimentRunLifecycle (services/research/lifecycle.ts) composes the
existing recordExperimentTransition / recordResearchObjectCreated — both ride
the ONE writeLifecycleReceipt → research_lifecycle_transition constructor, so
the createActivityReceipt call-site count in the file stays exactly 1.

Run-event → transition mapping: run-started → running (legal from
protocol-ratified onward; re-entering running is first-class — the flywheel);
results-published takes the single legal step within the evaluate→publish band
(running→evaluated, then evaluated→published) and deliberately never drives
replicated (that stays deriveOverview's computed multi-provider signal).
Illegal / out-of-order events refuse honestly — nothing recorded, {ok:false,
reason} returned. Registry experiments predate C2.2 (no research_objects row):
the first run auto-materialises the object at the registry floor (running),
receipts the creation, then transitions, returning created:true.

Route POST /api/research/run-lifecycle (admin-gated identically to
/api/research/lifecycle) never imports services/receipts. Runner wiring is
minimal + additive: the four direct-publishing runners (EXP-001/003/004/005)
fire results-published via personaFetch (never raw fetch) in their
publish-success path, fire-and-forget, appending the outcome inline to the
existing publishState line; EXP-002 advances through the Results-tab backfill
success path. Dashboard reads persisted state: /api/research/overview overlays
the receipted research-object state (overviewWithPersistedLifecycle) onto the
derived floor and CCRLDashboardTab highlights it. Evidence strings carry only
provider/arm labels + counts — no payloads, no T0 ids. Canary
tests/ccrl-run-lifecycle.test.ts pins the mapping, honest refusal, auto-create,
T2-safe evidence, and the single-receipt-site invariant. CFS-019 charter gains
the Phase C2.3 ratification note.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/research/overview/route.ts` |
| Added | `app/api/research/run-lifecycle/route.ts` |
| Modified | `codexes/packs/ccrl/foundation/CFS-019_ccrl-charter.md` |
| Modified | `components/composer/CCRLDashboardTab.tsx` |
| Modified | `components/composer/Exp001EvaluationRunner.tsx` |
| Modified | `components/composer/Exp003RediscoveryRunner.tsx` |
| Modified | `components/composer/Exp004SovereigntyRunner.tsx` |
| Modified | `components/composer/Exp005ProviderChoiceRunner.tsx` |
| Modified | `components/composer/ExperimentResultsTab.tsx` |
| Modified | `components/composer/experimentStepFetch.ts` |
| Modified | `services/research/lifecycle.ts` |
| Added | `tests/ccrl-run-lifecycle.test.ts` |

## Stats

 12 files changed, 617 insertions(+), 18 deletions(-)
