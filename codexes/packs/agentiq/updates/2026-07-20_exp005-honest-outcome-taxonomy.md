# EXP-005 — honest outcome taxonomy (instrument-integrity correction)

**Date:** 2026-07-20 · **Area:** IRL Research Laboratory → Experiments → EXP-005 (Provider-Choice Drill, PSE-2)
**Files:** `services/experiments/exp005.ts`, `services/experiments/llm.ts`, `components/composer/Exp005ProviderChoiceRunner.tsx`, `tests/exp005-provider-choice.test.ts`

## Finding (operator + Aletheon)

Two live runs surfaced a real **instrument-integrity** defect: EXP-005 collapsed three
distinct phenomena — a provider being unavailable (Anthropic credit exhaustion, a hard
400), a provider timing out (venice answering past the 25s envelope), and a provider
answering but failing constitutionally — into ONE label, "constitutional failure", and
failed switch integrity on all of them. That is scientifically wrong and constitutionally
misleading: an outage and a latency ceiling are not evidence that a provider's *reasoning*
is constitutionally defective.

This is the same pattern the lab has hit before: the experiment produces a valuable
observation, and the first-order result is that the instrument's categories were too coarse
for the phenomenon. Refining them is how the laboratory earns credibility.

## The honest five-class taxonomy

Each task now lands in exactly one class:

| Class | Meaning | Counts against switch integrity? |
|---|---|---|
| `completed` | answered + cross-judged; no constitutional defect | no (success) |
| `constitutionally_failed` | answered + judged, but the answer contradicts the collection | **yes — the ONLY class that does** |
| `provider_unavailable` | answer-side infra: billing/credit, invalid/revoked key, 4xx/5xx, outage | no (availability result) |
| `timed_out` | answer-side: execution envelope exceeded | no (performance/deployability result) |
| `judge_failed` | the answer exists but the judge failed/timed out | no (inconclusive — scored neither way) |

The constitutional criterion is transparent and auditable: a completed+judged task is
`constitutionally_failed` iff the judge recorded any claim that **contradicts** the
constitutional collection (`contradicting > 0`).

## Two independent axes

- **Constitutional portability** — does valid operation *survive provider substitution*?
  `held` / `broken` (any constitutional defect) / `inconclusive`.
- **Operational viability** — can each provider complete its assigned *role* within the
  runtime envelope? Reported per provider **per role**, because a provider can be viable in
  one role and not the other. The venice signature — *viable as a short-call judge, not as a
  long-form answerer through the synchronous serverless route* — is now first-class evidence:
  a routing result, not a provider failure in the abstract.

## Banner + record

The verdict is now three-way and tells the truth, e.g.:

> Switch integrity INCONCLUSIVE — 3/5 answered+judged; 2 timed_out; 0 provider_unavailable;
> 0 judge_failed; 0 constitutional failures among completed. … Operational viability:
> venice: answering 0/2, judging ✓ · openai: answering ✓, judging ✓.

The published `switchIntegrity` carries `outcomeCounts`, `constitutionalPortability`,
`operationalViability` (per provider/role), and `verdict`.

## Auditable, bounded retry (no silent re-route)

Transient classes only — **timeout / 429 / 5xx / network** — get ONE retry against the
**same** provider (the server derives the provider from taskIndex + rotation, so a retry can
never re-route). NOT retried: invalid key, insufficient credit, malformed request,
unsupported model. Every attempt is recorded on the task row (`attempts[]`) and shown in the
UI (`… (2 attempts)`), so the retry is visible in the record. The false "the client retries
this step automatically" message in `llm.ts` — which previously described a retry that did
not exist — is replaced with an accurate one now that the retry is real.

## Preservation

The two pre-correction runs stand as **pre-correction instrument records** — not
overwritten. The new taxonomy applies to future runs (re-run after topping up Anthropic
credits and/or with providers reachable inside the envelope).

## Verification

- Pure summarizer (`exp005SwitchIntegrity`) exercised against: clean 2-provider → `held`;
  a contradiction → `constitutional_failure` + portability `broken`; timeout + unavailable +
  judge_failed → 0 constitutional failures, `inconclusive`; and the venice two-axis case
  (`answerViable=false`, `judgeViable=true`). All pass.
- Canaries updated in `tests/exp005-provider-choice.test.ts`; full suite + type-check run in
  CI (node_modules is not provisioned in the session sandbox).
