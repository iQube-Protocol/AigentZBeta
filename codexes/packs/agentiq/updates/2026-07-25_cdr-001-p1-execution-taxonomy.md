# SPEC-CDR-001 P1 — Execution taxonomy derived, not authored

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md` · **Gate:** D-1 (RATIFIED)

## What shipped

The first — and deliberately narrowest — build slice under the ratified Constitutional Domain & Context Resolution spec. §11 authorises exactly one thing on D-1 alone: derive the execution taxonomy in code, and add a parity canary where derivation is impossible.

| Change | File |
|---|---|
| `FinancialDomain` now **derives from** a value tuple instead of being an independent literal union | `services/constitutional/financialIntelligenceExecutor.ts` |
| `DOMAIN_LABEL` exported as `FINANCIAL_DOMAIN_LABEL` so the taxonomy reuses the shipped labels rather than keeping a second table | same |
| New platform-service taxonomy module (D-16: `services/resolution/`, **not** `services/companion/`) | `services/resolution/executionTaxonomy.ts` |
| Two hand-copied `['intelligence','investment','market']` arrays replaced by the derived `isExecutionDomain` guard | `app/api/moneypenny/runtime/route.ts`, `app/api/constitutional/service-pipeline/route.ts` |
| Parity canary | `tests/source-of-truth-parity.test.ts` |

### The type now derives from the value, not the reverse

```ts
export const FINANCIAL_DOMAINS = ['intelligence', 'investment', 'market'] as const;
export type FinancialDomain = (typeof FINANCIAL_DOMAINS)[number];
```

A literal union alone cannot be enumerated at runtime, which is *why* two API routes each carried their own hand-written copy of the same three strings. Those were live instances of the `inv.engineering.036`/`037` defect class — the exact class SPEC-CDR-001 §0.2 was written to prevent, and the class that produced four separate defects in this session alone. Deriving the type from the tuple removes the reason to copy.

### Posture is recorded, never controlled

`EXECUTION_POSTURE` is a `Record<FinancialDomain, ExecutionPosture>`, so adding a domain without stating its posture is a compile error. It records the shipped CRP-003a posture (`intelligence` authoritative; `investment`/`market` shadow-only) for presentation. It does not set posture, and nothing here touches the Domain 1/2 money-moving pause point.

## The canary, and proof that it bites

Four checks, in `tests/source-of-truth-parity.test.ts`:

1. `EXECUTION_DOMAINS` is a pure derivation of `FINANCIAL_DOMAINS`.
2. The SPEC §3 docs table matches the shipped union — **ids, labels, and posture**. This is the one place derivation is genuinely impossible (a markdown mirror), so it is checked rather than trusted.
3. **No governance domain has leaked into the executable union** (§4.2). The governance ids are read out of the SPEC's own §4.1 table rather than hardcoded, and the test asserts the parsed list is non-empty first — a canary that silently passes on an empty list is worse than no canary.
4. No surface restates the domain list instead of deriving it — pins the two routes that used to.

Mutation-tested rather than assumed: changing the §3 table's `market` row to `| Market Ops | Authoritative` fails the suite (`expected 'Market Ops' to be 'Market Operations'`); reverting restores 6/6 green.

## What this deliberately did NOT do

Per §10.1, ratifying the SPEC does not authorise any of the following, and none of it is in this change:

- Widening `FinancialDomain` — governance domains stay a separate, non-executable class (§4.2).
- Any change to execution behaviour or shadow/authoritative posture.
- Replacing the Overlay's `BANKING_DOMAINS` hostname `Set`, or the `banking` → `financial-context` rename — that is **P2**, and P2 is blocked entirely on **D-15** (an explicit operator list of real hostnames with real provenance; the five demo hosts must not be inherited by default).
- Any resolver, Domain Profile, or Context Resolution code — P3/P7.

## Verification

- `tests/source-of-truth-parity.test.ts` — 6 passed.
- `tsc --noEmit` — no new errors (the two reported are pre-existing config errors: a missing `iqube` type definition and an invalid `--ignoreDeprecations` value).
- `tests/constitutional-contracts.test.ts` (4 failures) and `tests/moneypenny-runtime-authority-boundary.test.ts` (1 failure) fail identically with the change stashed — **pre-existing, unrelated to this work**.

## What unblocks next

| Needed from the operator | Unblocks |
|---|---|
| **D-15** — the seed hostname list, each marked `first-party`/`curated` and `verified`/`provisional` | **P2** (the profile registry that finally replaces the hostname `Set`) |
| **D-12** — which engine owns Domain Profile generation (IRE / IPE / KRE / CFO, or a distinct Discovery Engine) | P5, P6 |
| **D-8** — whether `ire://` resolves or is documentary (interim: treated as documentary) | Profile-schema completeness (soft) |

P3 (resolver, L1/L2/L4 only), P4 (capability-module composition) and P7 (Context Resolution) are unblocked by decision, but sequence behind P2 in practice since the resolver has nothing to resolve against until the registry exists.
