# SPEC-CDR-001 P3 — the four-level resolver, and a canary that couldn't fail

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md` · **Gate:** D-9, D-10, D-11

## What shipped

`services/resolution/domainResolver.ts` — the precedence rules from §6.1, as strict top-to-bottom control flow rather than a score, so *"a lower level never overrides a higher one"* is a property of the code rather than a rule someone has to remember.

| Level | Condition | Result |
|---|---|---|
| **L1** | `first-party`/`curated` + `verified` | `assert: true`, full context |
| **L2** | `discovered` + `verified` | `assert: true`, full context |
| **L3** | `discovered` + `provisional` | `assert: false`, `overlayContext: null`, `presentAs: 'L4'` |
| **L4** | no profile | `assert: false`, `reason: 'no-profile'` |

L1 and L2 differ by **provenance, not verification** — both are verified. That distinction is only expressible because D-5 split the two axes into independent fields; with one collapsed field, resolver precedence would be ambiguous.

## "No provisional path" — the reading I chose, and why

The phrase admits two implementations. The resolver could **(a)** ignore provisional profiles entirely, or **(b)** classify them and refuse to assert.

**I built (b).** (a) silently discards a profile the registry deliberately recorded, which is a worse failure than refusing to act on it — and it would make P5 a rewrite rather than an addition. Under (b) a provisional profile resolves to L3 with `assert: false` and `presentAs: 'L4'`, which §6.2 explicitly names as an always-permitted implementation of L3 (*"Nothing at all — falling back to L4 presentation"*). The hedged offer and context selector remain P5.

So no provisional profile can produce a rendered context today, and **the refusal is explicit rather than incidental**.

## Wired, not shelved

`shapeForDomain` now calls `assertedContextFor`, so the Overlay's only route to a context runs through the precedence rules. A canary asserts it doesn't reach past the resolver to the registry.

This matters because the adjacent spec (SPEC-TCP-001 §0.2) documents the opposite outcome — a resolver that shipped and *"nothing consumes it."* A resolver nobody calls doesn't enforce anything.

## The part worth reading: a canary that couldn't fail

I mutation-tested by making L3 assertable — the single most dangerous regression this phase can suffer, since it would render an unverified financial classification as fact. **My most important behavioural test did not catch it.**

The reason was structural. `resolveDomain` took a hostname and did lookup-plus-classify in one step, and the registry contains no provisional profile (correctly — shipping one would be shipping an unverified assertion). So the L3 branch was **unreachable from the test**. The only thing that failed was a different canary, and only because the mutation also seeded a fake profile. Had someone made L3 assertable without seeding, the suite would have stayed green.

The fix is a design improvement, not a test patch: `classifyProfile(profile)` is split from `resolveDomain(subject)`. The precedence rules are now a pure function of a profile, so the refusal is directly testable against a fixture with nothing unverified shipped.

Re-run of the same mutation with **no seeding**: `× P3: a provisional profile is classified but NEVER asserted`. Reverting restores 24/24.

The general lesson, worth carrying: **a canary that cannot reach the branch it guards is not a canary.** Mutation testing is what surfaces that; a passing suite never will.

## The other P3 canaries

Six checks: every seed resolves at L1 with `reason: 'asserted-verified'` · an unmapped subject abstains at L4 with a stated reason (not a bare null) · no shipped profile can reach L3, so a future seeding before P5 fails loudly · a provisional profile at **0.97 confidence** is classified, refused, and still visible for inspection — refused, not silently dropped · the resolution carries **no authorization verdict** (`allowed`/`permitted`/`authorized`/`verdict`/`personaId` all absent — D-22: composition never grants authority) · `shapeForDomain` consumes the resolver rather than the registry directly.

Plus a structural backstop: `overlayContext` is null whenever `assert` is false at every level, so a caller that ignores the flag still cannot render an unverified context.

## Verification

- `tests/source-of-truth-parity.test.ts` + `tests/companion-observer.test.ts` — **56 passed**.
- `tsc --noEmit` — no new errors (the two reported are the pre-existing config errors).
- Behaviour unchanged: the same five hosts render the same card; every one is L1.

## Where CDR stands

| Phase | Status |
|---|---|
| P1 execution taxonomy · P2 profile registry · **P3 resolver** | **Shipped** |
| P4 capability modules | Not started — unblocked |
| P5 L3 provisional discovery + abstention UI | Not started — the IDE is now the named producer (D-12) |
| P6 agent classification | Unblocked by D-12; wants D-13 (a live operator call again) |
| P7 Context Resolution · P8 Human Mobility | Not started |

**D-8 remains the only open decision, and it is soft.**

## Review

- Resolver: `services/resolution/domainResolver.ts`
- In-app: `https://dev-beta.aigentz.me/triad/embed/codex/agentiq-codex?tab=updates`

No SQL — pure code, no schema.
