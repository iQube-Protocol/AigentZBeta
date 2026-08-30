# Commit Brief: `a68e67f` — correct stale principal-only doctrine: OCSGA acts are delegable, CTP-001 amended before it hardens

| Field | Value |
|-------|-------|
| SHA | [`a68e67f`](https://github.com/iQube-Protocol/AigentZBeta/commit/a68e67f20f6f0b55e7e02a3d9e9d7f5a729a4a6c) |
| Author | Claude |
| Date | 2026-08-30T13:21:40Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
correct stale principal-only doctrine: OCSGA acts are delegable, CTP-001 amended before it hardens

A constitutional audit found no ratified invariant, PRD, or spec text
anywhere in this repo declares confirm/freeze/sign non-delegable. The only
place the claim existed was CTP-001's illustrative object model for
ctp.exchange.artifact.confirm (delegability: false) — a charter explicitly
self-described as "no runtime is implemented", never ratified as built —
plus code comments in ianBoundaryResearchJourney.ts and types/journey.ts
citing a "CLAUDE.md constraint 1/2" that does not exist. inv.constitutional.
369 itself requires correct attribution of a principal-only act, not a
blanket ban on delegation; its own empirical basis (Ian's orientation
receipt misattributed to his agent persona) was an identity-resolution bug.

- CTP-001 §4 amended: ctp.exchange.artifact.confirm now permits
  AUTHORIZED_DELEGATE under an active delegation grant scoped to
  exchange.artifact.confirm, with an inline amendment note — corrected while
  still chartered, before it hardens into implementation. This is CTP-001's
  first appearance on dev: it was chartered in an earlier session phase but
  never previously cherry-picked here (doc-only-deploy deferral); brought
  forward now bundled with this code change, per CLAUDE.md convention.
- ianBoundaryResearchJourney.ts: the freeze-attestation, exchange-ready, and
  create-deposit stages' actorRole corrected from PRINCIPAL to EITHER, their
  stale "per constraint 2" / "Only PRINCIPAL can deposit" comments replaced
  with the actual rule. Purely descriptive — resolveJourneyState never reads
  actorRole (existing canary). orient/passport/delegation-establish/
  research-active are untouched; none of their comments asserted a
  falsified claim.
- types/journey.ts: ActorRole's and ConditionExpression's doc comments no
  longer cite the nonexistent CLAUDE.md constraint.
- codexes/packs/agentiq/collections.json: merged this branch's new
  2026-08-29/2026-08-30 update entries with dev's own independently-added
  2026-08-28_mfe-capstone-state-of-estate.md entry (both legitimate,
  inserted at the same list position by unrelated sessions) [merge review/irl-scoped-restoration-2026-08-27]

Governing rule now stated once, generally: delegability is explicit
authority, not an exception to constitutional action; non-delegability
requires an explicit constitutional basis. No new receipts, Passport
checks, delegation ceremonies, or bridge-specific transition logic.
```

## Body

A constitutional audit found no ratified invariant, PRD, or spec text
anywhere in this repo declares confirm/freeze/sign non-delegable. The only
place the claim existed was CTP-001's illustrative object model for
ctp.exchange.artifact.confirm (delegability: false) — a charter explicitly
self-described as "no runtime is implemented", never ratified as built —
plus code comments in ianBoundaryResearchJourney.ts and types/journey.ts
citing a "CLAUDE.md constraint 1/2" that does not exist. inv.constitutional.
369 itself requires correct attribution of a principal-only act, not a
blanket ban on delegation; its own empirical basis (Ian's orientation
receipt misattributed to his agent persona) was an identity-resolution bug.

- CTP-001 §4 amended: ctp.exchange.artifact.confirm now permits
  AUTHORIZED_DELEGATE under an active delegation grant scoped to
  exchange.artifact.confirm, with an inline amendment note — corrected while
  still chartered, before it hardens into implementation. This is CTP-001's
  first appearance on dev: it was chartered in an earlier session phase but
  never previously cherry-picked here (doc-only-deploy deferral); brought
  forward now bundled with this code change, per CLAUDE.md convention.
- ianBoundaryResearchJourney.ts: the freeze-attestation, exchange-ready, and
  create-deposit stages' actorRole corrected from PRINCIPAL to EITHER, their
  stale "per constraint 2" / "Only PRINCIPAL can deposit" comments replaced
  with the actual rule. Purely descriptive — resolveJourneyState never reads
  actorRole (existing canary). orient/passport/delegation-establish/
  research-active are untouched; none of their comments asserted a
  falsified claim.
- types/journey.ts: ActorRole's and ConditionExpression's doc comments no
  longer cite the nonexistent CLAUDE.md constraint.
- codexes/packs/agentiq/collections.json: merged this branch's new
  2026-08-29/2026-08-30 update entries with dev's own independently-added
  2026-08-28_mfe-capstone-state-of-estate.md entry (both legitimate,
  inserted at the same list position by unrelated sessions) [merge review/irl-scoped-restoration-2026-08-27]

Governing rule now stated once, generally: delegability is explicit
authority, not an exception to constitutional action; non-delegability
requires an explicit constitutional basis. No new receipts, Passport
checks, delegation ceremonies, or bridge-specific transition logic.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-08-30_ocsga-delegated-completion-and-ctp-001-delegability-correction.md` |
| Added | `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-registry-and-execution-model.md` |
| Modified | `services/journey/ianBoundaryResearchJourney.ts` |
| Modified | `tests/threshold-constitutional-navigator.test.ts` |
| Modified | `types/journey.ts` |

## Stats

 7 files changed, 681 insertions(+), 8 deletions(-)
