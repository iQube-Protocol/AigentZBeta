# Constitutional ground: separating the base from the overlay

**Date:** 2026-07-26
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Status:** shipped to dev — one item below needs operator sign-off before it can be called settled

---

## The correction this implements

An earlier fix in this session widened `isConstitutionallyGrounded` so it admitted any
surface that names itself, instead of only `smart-triad`. That fixed **coverage**. The
operator's correction was that the **model** was still wrong:

> A cartridge shouldn't be able to substitute for the base, and absence of cartridge
> context shouldn't subtract constitutional ground.

That is a different defect, and widening a gate cannot fix it. The predicate
`isConstitutionallyGrounded(groundContext)` answers **"is there a cartridge overlay?"** —
a question about *specialization*. It was being used to decide **whether the substrate
exists at all**. So a surface that sent no ground context was grounded on nothing, and an
overlay could stand in for the base.

Two levels, two questions, previously collapsed into one predicate:

| Level | Question | Correct behaviour |
|---|---|---|
| **L1 common ground** | does the operator have constitutional ground? | **Unconditional.** Every copilot is one constitutional intelligence. |
| **L2 cartridge overlay** | which invariants are relevant here? | **Narrows selection.** Never removes the base. |

## What changed

**1. `services/invariants/resolution.ts` — the base/overlay seam is now named.**
`resolveCommonConstitutionalGround(intentText, overlay?, limit?)` makes the split explicit
at every call site: the overlay is an *argument*, never a guard on the call. Its contract
states that callers must invoke it for every turn.

The scoped-miss fallback in `resolveCitableInvariants` was also broadened. It previously
fell back to the unscoped field only when `namespaces` was set; a `domains`- or
`ontologyClassIds`-scoped miss returned `[]`. That was the same category error by a second
route — an empty overlay silently subtracting the base.

**2. `app/api/codex/chat/route.ts` — resolution is unconditional and happens first.**
The substrate resolves before the composer/persona prompt split, guarded only by "is there
a message". The cartridge id from the ground context is passed as *overlay narrowing*; the
agent-derived content domain is deliberately **not** used, because it selects a KB corpus
and conflating corpus selection with constitutional scope is what pinned grounding to KNYT.

The invariants block now renders from one shared function
(`constitutionalGroundPromptBlock`) used by **both** prompt builders — the persona path and
the composer path. It was removed from inside the overlay block, so the base can no longer
be re-coupled to the overlay by editing that branch. The `resolved_invariants` echo now
reads the resolved base rather than the overlay's copy of it.

`isConstitutionallyGrounded` still gates the CFS-045 partnership-memory lookup — correctly,
because that lookup is *keyed by cartridge id* and genuinely needs an overlay.

**3. The client-side twin at `CodexCopilotLayer.tsx:1117` is closed.**
The server-side gate was widened and reported as fixed earlier in the session; the client
literal `groundContext.surface === "smart-triad"` was still live, so constitutional memory
still travelled for exactly one surface. Both copilot mounts now share
`hooks/useSessionInvariants.ts` (`ingest` + `decorate`). `SmartTriadCopilotLayer` had no
memory wiring at all before this and now carries it identically.

It is a **hook, not a provider**, on purpose: `sessionMarker` identifies one mount's
reasoning session for trajectory capture, so hoisting the state above the mount would
silently merge distinct sessions.

**4. One invariant budget.** `INVARIANT_BUDGET` replaces three bare literals (8 / 12 / 6) at
three independent injection sites. PRD §5 budgets the *sum* ("room for BOTH platform-wide
and domain knowledge"); three separate literals bounded no sum.

## Canaries — `tests/copilot-invariant-grounding.test.ts`

The load-bearing one is **negative**: common ground resolves *with no cartridge context at
all*. Every other assertion in the file can pass while the base is still conditional on an
overlay, which is exactly the failure being guarded. It asserts structurally that no
overlay reference appears between the substrate's declaration and its resolution.

Also added: the base renders before the overlay and outside every `groundContext` branch;
composer is grounded on the same substrate; the echo reads the base; the scoped-miss
fallback covers every scoping signal; the budget is one constant; no client gates memory on
a surface literal; and a **parity canary** tying `SESSION_INVARIANT_CAP` (client) to
`INVARIANT_BUDGET.withSessionMemory` (server) — the hook cannot import the server module,
so the duplication is held by a check rather than by convention.

Full suite: 136 files / 1741 tests green.

## Two things the operator should weigh

**1. The ratified decision was *not* reopened — please confirm this reading.** The PRD
(`2026-07-19_prd-smarttriad-context-aware-copilot.md:146-149`) records that client-carried
`platform.principles` was superseded by per-message IRE injection. This change *keeps*
per-message IRE injection and keeps it server-side; it does not reintroduce a client-carried
L1. What it changes is that the server-side injection is now unconditional. That reads as
consistent with the ratified decision rather than a reversal of it — but it was flagged as
needing sign-off, so it is flagged here rather than assumed.

**2. The surface-expansion risk is real but narrower than feared.** The stated risk was
"widened gate + auto-injected ground = unaudited surface expansion" with no type barrier
(the route handles ground as `Record<string, unknown>` throughout). On inspection the
exposure is limited: what newly flows outward is the `resolved_invariants` echo, whose
content is T2-safe canonical corpus statements (seed ids + statements), now reaching every
surface instead of one. What newly flows inward is `sessionInvariants` (read as strings) and
`sessionMarker` (opaque random, already sanitised in the memory service). Memory compilation
still requires a spine-resolved persona *and* a cartridge id. No new T0 surface is created by
this change. The `Record<string, unknown>` weakness remains a standing concern for anything
that later adds *observer* data to ground contexts — it is not closed by this work.
