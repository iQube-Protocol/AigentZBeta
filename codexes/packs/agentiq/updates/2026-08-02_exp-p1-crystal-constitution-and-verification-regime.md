# EXP-P1 — Crystal constitution, domain ratification, and a real verification gate

**Status: RATIFIED · 2026-08-02 · milestone: Internal Readiness (not External Review)**

---

## 1. What was actually wrong

EXP-P1's Crystal Readiness surface reported `NOT_READY` with 9/9 checks failing over
`constitutional-reasoning`. Every failure said "0 invariants". Read cold, that is nine
defects in Crystal vP1.

It was not. `services/research/crystalReadiness.ts` had recorded the truth in its own
header since it was written: no live `invariant_contexts` row carries that domain tag,
because **Track 2 — the crystal source-material workstream — was PAUSED**. The checks
were correctly declining to certify an empty set.

**Crystal readiness cannot begin until crystal constitution has occurred.** The readiness
engine evaluates a governed object; it does not create one.

## 2. The domain, declared and ratified

EXP-P1 does **not** reuse the historical 18-invariant `constitutional-reasoning`
collection. Relabelling it would have solved a display problem by creating a different
experiment — and the substitution would have been invisible afterwards, because the
numbers would have looked right.

**Operator ratification, 2026-08-02** (verbatim, carried in
`services/research/crystalDomains.ts` as `ratificationText` — a paraphrase of a
constitutional act is a different act):

> I ratify `financial-risk-value-systems` as the governed domain boundary for EXP-P1
> Candidate Crystal vP1. Eligible assignments are limited to externally established or
> externally empirical invariants in `validated` or `canonical` lifecycle states.
> Historical constitutional-reasoning materials and internal/platform-derived
> financial-risk materials remain excluded from the EXP-P1 experimental crystal.

Boundary: *structural and constitutional invariants governing financial decision systems
under uncertainty, including risk formation, valuation, actuarial mechanics, liquidity,
market infrastructure, failure propagation and the governance of those processes.*

`domainAcceptsAssignment()` gates assignment on ratification status — it reads the
status, it does not assume one, and a canary proves it still refuses when unratified.

## 3. Track 2 — UNPAUSED, on the critical path

```
declare boundary → RATIFIED
  → assemble and approve external corpus
  → extract candidate invariants
  → validate through the normal proposed→validated lifecycle
  → assign eligible invariants to financial-risk-value-systems
  → generate Candidate Crystal vP1
  → run intrinsic readiness
  → independent pre-freeze review
  → operator freeze
```

Size is justified **mechanically** by the frozen task requirements and the ⊆40% Arm C
guard. No invariant is authored to reach a number. Eligibility is never widened to raise
a count — a canary locks `validated|canonical` and rejects `proposed`.

## 4. Two activities that were sharing one word

The first formulation said a populated-but-failing crystal "is still worth reviewing but
isn't ready for the request" — self-contradictory if *review* means one thing. Corrected:

| State | Condition | Who acts |
|---|---|---|
| `PREPARING_CANDIDATE` | domain empty | nobody — nothing to inspect |
| `INTERNAL_DIAGNOSTIC_REVIEW` | populated, readiness failing | the originating team, diagnosing its own checks |
| `INDEPENDENT_REVIEW_OPEN` | populated **and** readiness passed | the external reviewer |

`independentReviewRequestOpen` is named for the act it authorises, so it cannot answer
for internal diagnosis. That naming is canary-enforced: a bare `reviewOpen` is how the
two collapsed in the first place.

The originating team completes its own work before independent review begins. Sending a
failing crystal to an external reviewer spends their independence diagnosing our checks.

## 5. `assessability` — nothing to assess ≠ assessed and failing

`NOT_READY` is two-valued. `assessability` (`ASSESSED` | `DOMAIN_UNPOPULATED`) is hoisted
**above** the failing checks in the payload, with `DOMAIN_UNPOPULATED_PROVENANCE` stating
that no change to this software can make the domain ready.

## 6. The verification regime — read this before reporting "typechecked"

**`npm run type-check` in this repository reports zero semantic errors.** Verified by
appending `const x: number = "not a number"` and getting no output. Two fatal config
errors abort the program before checking:

- **TS5103** — `ignoreDeprecations: "6.0"` is invalid for TypeScript 5.9.3 (valid: `"5.0"`)
- **TS2688** — `typeRoots: ["./types"]` makes TS treat `types/iqube/` as a type package

With both corrected, the checker runs and reports **598 pre-existing errors** repo-wide.
The root `tsconfig.json` is deliberately NOT changed here: 598 errors is not a change to
make unilaterally, and repairing them would derail the programme.

### The scoped gate

```bash
npm run type-check:research      # tsc -p tsconfig.research.json --noEmit
```

`tsconfig.research.json` covers `services/research/**`, `services/invariants/**`, the
EXP-P1 API routes, the reviewer-agreement services, the crystal lifecycle/readiness
modules, the reviewer components and their tests — and, since the wallet-binding
repair (#121/#122), `services/wallet/**` plus the principal address resolver.

**Baseline: 10 errors, all pre-existing, none in code changed on 2026-08-02.**

```
components/composer/InvariantExperimentLab.tsx
components/ui/tooltip.tsx
services/devCommandCenter/stageOrchestrator.ts
services/iqube/experienceQube.ts
services/iqube/legibility/sources/aigentQubeSource.ts
services/research/independentReviewPublish.ts
services/wallet/qctCanonicalService.ts      ← added with the wallet scope, pre-existing
```

The baseline rises only when the SCOPE widens, and it must rise by exactly the errors
the newly-covered files already had. A baseline that grows because new code was written
is the failure this gate exists to catch.

No new error may be added to this list. Two real defects were found and fixed the moment
the gate first ran — a bad type predicate in the contested-record modal, and
`ResearchWorkspaceRoleId` imported-but-never-re-exported (TS2459) — both of which the
global check had silently passed.

### Reporting language

Until the global config is repaired, do **not** write "typecheck clean". Write:

> targeted modules executed under Vitest; affected suites pass; scoped research
> typecheck at baseline; authoritative build pending/passed

and distinguish **syntax** validation from **semantic** type validation.

## 7. Files

| File | Role |
|---|---|
| `services/research/crystalDomains.ts` | declared domains, ratification record, review-stage state machine |
| `services/research/crystalLifecycle.ts` | the propose → review → resolve → ratify(freeze) → publish ladder |
| `services/research/crystalFreezeRecommendation.ts` | `assessability` + `DOMAIN_UNPOPULATED_PROVENANCE` |
| `app/api/research/crystal/[experimentId]/route.ts` | hoists assessability, review stage and the declared boundary |
| `tsconfig.research.json` | the scoped semantic gate |
| `tests/crystal-freeze-recommendation.test.ts` | constitution, ratification and review-state canaries |
