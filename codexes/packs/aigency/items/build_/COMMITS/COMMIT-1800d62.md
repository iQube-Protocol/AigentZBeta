# Commit Brief: `1800d62` — Chrysalis Phase 3 opener: the Chrysalis Test live + CFS-016 deployment ladder (draft)

| Field | Value |
|-------|-------|
| SHA | [`1800d62`](https://github.com/iQube-Protocol/AigentZBeta/commit/1800d6297c4b656547efde7e65c54b6dcf191c74) |
| Author | Claude |
| Date | 2026-07-06T06:23:26Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Chrysalis Phase 3 opener: the Chrysalis Test live + CFS-016 deployment ladder (draft)

- The Chrysalis Test as an instrument: admin-gated GET
  /api/constitutional/chrysalis-test computes CFS-015's final
  acceptance criteria mechanically against live platform state — ten
  pinned criteria (substrate counts + canon version, invariants_used
  flowing on receipts, render-validation receipts, pack receipts,
  receipt trail + DVN-anchored share, published results per experiment
  leg, flywheel citations, EXP-004 sovereignty result, provider slot
  inventory, deployment status). Every check read-only and
  independently best-effort; honest-status discipline throughout —
  'pending' is first-class (ratified-but-not-exercised), never faked
  green; provider interchangeability caps at 'partial' by design until
  the orchestration phase ships. Rendered as the Experiment Lab's
  "Chrysalis Test" tab: status chips, evidence lines, pass/partial/
  pending/fail summary — the program's standing dashboard. Criterion
  ids pinned in types/constitutional.ts with a canary (acceptance
  criteria never silently vanish).

- CFS-016 Constitutional Deployment, DRAFT for operator ratification —
  no implementation until ratified (Law XI). The deployment authority
  ladder: D0 operator-manual (current) -> D1 pack-proposed (provenance
  chain + deploy-intent receipt; human execution unchanged) -> D2
  receipts-gated with per-deploy operator approval and a receipted
  kill switch -> D3 explicitly NOT proposed. Hard boundaries binding
  every level: dev-rail only (main/staging outside the ladder
  entirely), protected-file diffs force manual fallback, no credential
  transfer, no gate weakening, approval always per-deploy. Ratification
  decision requested: D1 or defer. Registered in col_foundation;
  CFS-015 organ map now points its deployment row at the draft.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

- The Chrysalis Test as an instrument: admin-gated GET
  /api/constitutional/chrysalis-test computes CFS-015's final
  acceptance criteria mechanically against live platform state — ten
  pinned criteria (substrate counts + canon version, invariants_used
  flowing on receipts, render-validation receipts, pack receipts,
  receipt trail + DVN-anchored share, published results per experiment
  leg, flywheel citations, EXP-004 sovereignty result, provider slot
  inventory, deployment status). Every check read-only and
  independently best-effort; honest-status discipline throughout —
  'pending' is first-class (ratified-but-not-exercised), never faked
  green; provider interchangeability caps at 'partial' by design until
  the orchestration phase ships. Rendered as the Experiment Lab's
  "Chrysalis Test" tab: status chips, evidence lines, pass/partial/
  pending/fail summary — the program's standing dashboard. Criterion
  ids pinned in types/constitutional.ts with a canary (acceptance
  criteria never silently vanish).

- CFS-016 Constitutional Deployment, DRAFT for operator ratification —
  no implementation until ratified (Law XI). The deployment authority
  ladder: D0 operator-manual (current) -> D1 pack-proposed (provenance
  chain + deploy-intent receipt; human execution unchanged) -> D2
  receipts-gated with per-deploy operator approval and a receipted
  kill switch -> D3 explicitly NOT proposed. Hard boundaries binding
  every level: dev-rail only (main/staging outside the ladder
  entirely), protected-file diffs force manual fallback, no credential
  transfer, no gate weakening, approval always per-deploy. Ratification
  decision requested: D1 or defer. Registered in col_foundation;
  CFS-015 organ map now points its deployment row at the draft.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/constitutional/chrysalis-test/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Modified | `codexes/packs/agentiq/foundation/CFS-015_operation-chrysalis-2-prd.md` |
| Added | `codexes/packs/agentiq/foundation/CFS-016_constitutional-deployment.md` |
| Added | `components/composer/ChrysalisTestTab.tsx` |
| Modified | `components/composer/InvariantExperimentLab.tsx` |
| Modified | `tests/constitutional-contracts.test.ts` |
| Modified | `types/constitutional.ts` |

## Stats

 8 files changed, 469 insertions(+), 2 deletions(-)
