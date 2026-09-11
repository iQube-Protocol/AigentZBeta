# Commit Brief: `b795373` — build CRP-003a Increment 2b + P3: grounded executor, live-wired steps, spend cap

| Field | Value |
|-------|-------|
| SHA | [`b795373`](https://github.com/iQube-Protocol/AigentZBeta/commit/b795373846cbe24159bce016ff617717369149a8) |
| Author | Claude |
| Date | 2026-07-17T14:43:06Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
build CRP-003a Increment 2b + P3: grounded executor, live-wired steps, spend cap

2b — the pipeline is no longer a stub:
- financialIntelligenceExecutor: invariant-GROUNDED (async, injected grounding
  fn wired to the engine's groundReasoning). Real sources (statements) + evidence
  refs (invariant ids); confidence calibrated to evidence count. Un-grounded
  still honestly fails F-201/F-202 (no fabricated pass). Grounding fn injected so
  it stays node-testable.
- pipeline steps live-wired: step 4 reads real delegate standing
  (readDelegateStanding); step 5 checks the agreement's forbidden-action
  envelope (blocks@5 in authoritative); steps 11/12 cite governing + evidence
  invariants for REAL Reach accrual (citeInvariants) — authoritative only; shadow
  observes, never mutates (CFS-017).

P3 (money-moving Domains 1/2 gating):
- constitutionalAgreement: SettlementTerms type + spendWithinCap (pure) — money
  movement REQUIRES an enforced valueCeiling; amount over the ceiling is refused.
- pipeline step 9 enforces the cap when settlementTerms are present (blocks@9 in
  authoritative). Domain 3 (read-only, no terms) still skips settlement. Rail
  execution (x402/USDC) + the Domain 1/2 executors remain the follow-on.

Verified: 21/21 drill — grounded executor passes verification / un-grounded
fails; spend cap (no-ceiling / over / within / negative); pipeline branching
(shadow vs authoritative accrual, policy block@5, settlement block@9, within-cap
proceeds). Executor parse-clean under Node strip-types.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

2b — the pipeline is no longer a stub:
- financialIntelligenceExecutor: invariant-GROUNDED (async, injected grounding
  fn wired to the engine's groundReasoning). Real sources (statements) + evidence
  refs (invariant ids); confidence calibrated to evidence count. Un-grounded
  still honestly fails F-201/F-202 (no fabricated pass). Grounding fn injected so
  it stays node-testable.
- pipeline steps live-wired: step 4 reads real delegate standing
  (readDelegateStanding); step 5 checks the agreement's forbidden-action
  envelope (blocks@5 in authoritative); steps 11/12 cite governing + evidence
  invariants for REAL Reach accrual (citeInvariants) — authoritative only; shadow
  observes, never mutates (CFS-017).

P3 (money-moving Domains 1/2 gating):
- constitutionalAgreement: SettlementTerms type + spendWithinCap (pure) — money
  movement REQUIRES an enforced valueCeiling; amount over the ceiling is refused.
- pipeline step 9 enforces the cap when settlementTerms are present (blocks@9 in
  authoritative). Domain 3 (read-only, no terms) still skips settlement. Rail
  execution (x402/USDC) + the Domain 1/2 executors remain the follow-on.

Verified: 21/21 drill — grounded executor passes verification / un-grounded
fails; spend cap (no-ceiling / over / within / negative); pipeline branching
(shadow vs authoritative accrual, policy block@5, settlement block@9, within-cap
proceeds). Executor parse-clean under Node strip-types.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/constitutional/constitutionalAgreement.ts` |
| Modified | `services/constitutional/constitutionalServicePipeline.ts` |
| Modified | `services/constitutional/financialIntelligenceExecutor.ts` |

## Stats

 3 files changed, 210 insertions(+), 87 deletions(-)
