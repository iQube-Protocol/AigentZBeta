# Validation Programme JSON Agent Package — External Review Completeness Pass

**2026-08-09**

## What shipped

Extended `app/api/journey/validation-programme/agent-package/route.ts` so the
package is sufficient for Austin/Avi and their delegated agents to review
both the frozen Crystal vP1 and the EXP-P1 experimental design without
unstated platform knowledge — turning it from an onboarding/navigation
manifest into an auditable external-review package.

1. **`lifecycle`** — `{crystal, observerReview, protocol, execution}`,
   explicitly separated. `crystal.frozen` reads the persisted artifact
   directly; nothing in the package derives from a stale pre-freeze
   computation blind to it.
2. **`frozenCrystal`** — new `services/research/crystalFrozenManifest.ts`.
   Recomputes the live domain-scoped corpus's content hash the SAME way
   `crystalStatistics.ts` does, compares it to the persisted, immutable
   `artifact.contentHash`, and serves full per-invariant detail ONLY on a
   match. On a mismatch (the corpus moved since freeze), refuses to serve
   member detail rather than silently substituting the live corpus for the
   frozen one. Freeze-ceremony disclosure fields (rationale, population,
   exclusions) are honestly reported as never persisted by the real freeze
   act — a real gap, not fabricated.
3. **`experimentDesign`** — extracts real sections (Arms, Task Set, Probes,
   Runs and Statistics, Judging, Token Accounting, Interpretation Table)
   verbatim from the canonical `README.md`, never a rewritten second spec.
4. **`reviewMandate`** — the operator's exact decision question and ten
   review dimensions, with an explicit disclaimer that acceptance does not
   approve results, establish domain generality, authorize execution, or
   substitute for Protocol Ratification.
5. **`scientificLimitations`** — hard-readiness-vs-maturity distinction, the
   two heuristic caveats (lexical duplicate detection, derivation-shape
   detection), and the pre-registered domain-affinity-not-generality
   limitation.
6. **`governingResources`** — a curated set (IRL-012, IRL-016, CFS-033,
   CFS-054, PRD-EPI-001, SERIES-RATIFICATION P1/P2/P3, EXP-010), resolving
   through the existing pack-file mechanism. The four EXP-P1-local
   `documentResources` are unchanged.
7. **`reviewerReadiness`** — a reviewer-safe gate projection (Crystal Frozen
   → Observer Accepted → protocol artifact preparation → Protocol Ratified
   → Execution), never the admin-only readiness endpoint.
8. **Observer independence** — `crystalObserverReview.ts` gained
   `deriveCallerObserverStatus`/`blindOtherObserverDecisions`, the ONE
   derivation both this package and `/api/research/observer-review/[experimentId]`
   now use. Fixed a real leak in that GET route: it previously returned
   every assigned observer's decision (rationale included) to any caller
   with read access — a peer observer could see another's vote before
   deciding themselves. Now blinded unless the caller is a steward/admin, has
   already decided, or the round is closed.
9. **Review-output guidance** — kept the three canonical decision kinds,
   stated that an `accepted` rationale may carry non-blocking observations,
   and added a recommended structured review-report schema
   (`findingId, targetRef, category, finding, evidenceRefs, severity,
   recommendation`) for upload to Locker, referenced via `evidenceRefs`.
10. **Machine contract** — `schemaVersion`, `generatedAt`, and per-endpoint
    method/auth expectations, so an external agent can validate the package
    shape before acting.

## Canaries

- `tests/crystal-frozen-manifest.test.ts` — hash match/mismatch/no-hash
  behavior; refuses to serve members on drift; never exposes
  `creatorAliasCommitment`; honestly discloses the never-persisted ceremony
  fields.
- `tests/validation-programme-agent-package-completeness.test.ts` — no
  hardcoded `crystalStatus: 'candidate'`; `deriveProtocolRatified` never
  takes observer data; no raw decisions array in the response; blinding
  derivation shared with the observer-review route; governing resources
  resolve on disk; `experimentDesign` extracts real README headings;
  existing access/agreement/authority/prohibition boundaries preserved.

Full suite: 557 tests across 19 files, green.

## Status

Committed locally only. **Not pushed** — holding per explicit operator
instruction to wait for the go-ahead before pushing to dev.
