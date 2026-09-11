# ACCESS-STEWARD-001 — Acceptance Criteria Ledger (AS-01 – AS-30)

Living document. Update in place as later phases land — do not fork a second copy. Each item
carries four independent statuses (a later phase may raise any of them without the others):

- **code** — not-started / partial / implemented
- **fixture** — not-started / tested (synthetic, labeled) / N/A
- **live** — not-started / blocked / tested (against real, verified evidence)
- **deployed** — not-started / pushed-to-branch / merged-to-dev / live

No phase is complete merely because code was pushed or a function returned successfully (spec §11).
"live: blocked" is an honest terminal state for this run, not a failure to fix — it means the item
correctly requires evidence this session does not have and must not fabricate.

As of this ledger (2026-09-03, end of S0 + bounded S1 run):

| ID | Criterion (abbreviated — see spec §12 for full text) | code | fixture | live | deployed | Notes |
|---|---|---|---|---|---|---|
| AS-01 | Current-source inventory names authoritative owners/enforcement points/exact revision; unverified assumptions named | implemented | N/A | N/A | pushed-to-branch | `2026-09-03_access-steward-001-s0-reconciliation.md`, this pack. Commit `HEAD` on `spec/access-steward-001` is the exact revision inventoried. |
| AS-02 | No parallel identity/invitation/grant authority introduced; any new persistence narrowly justified | implemented | N/A | N/A | pushed-to-branch | `accessSteward.ts` adds zero new tables/rows. It is a pure function over `getExchangeView`'s existing return value. |
| AS-03 | ALLOW/DENY/UNRESOLVED + safe explanations covered by executable tests | implemented | tested | not-started | pushed-to-branch | `tests/access-steward-s1.test.ts` — all three outcomes exercised. |
| AS-04 | One allowed + one forbidden principal tested against the same resource/version/action | implemented | tested | not-started | pushed-to-branch | Same exchange fixture, same artifact/action(`read`); `PARTY_A`→ALLOW after crossing, `UNRELATED_PERSONA`→DENY throughout. |
| AS-05 | Ian case retrieves entitled frozen artifact once prerequisites satisfied | partial | tested (synthetic, explicitly labeled non-Ian) | blocked | pushed-to-branch | Mechanism (`getExchangeView`) is real and unmodified; this run's fixture is a labeled synthetic stand-in per spec §13's explicit allowance. Live Ian case: **blocked**, not passed (RD-2). |
| AS-06 | Ian's later drafts/private workspace and unrelated-party access remain protected | implemented | tested | blocked | pushed-to-branch | Unrelated-principal DENY tested; pre-crossing/locked-artifact DENY tested (stands in for "later draft not yet disclosed"). Live: blocked (RD-2). |
| AS-07 | Austin human vs. delegated-agent access evaluated separately against verified bindings | not-started | not-started | blocked | not-started | S0 confirmed the mechanisms exist (`delegationGrantStore.ts` per-agent grants; `participationAccess.ts` human grants) but no Steward facade over them was built this run (out of scope). **Also flags a live regression** (containment audit Residual Risk 0) independent of this workstream. |
| AS-08 | Agent delegation expiry/revocation blocks agent use without deleting independent human access | partial (pre-existing) | N/A this run | not-started | pushed-to-branch (pre-existing code, unmodified) | `readActiveGrantForAgent` vs `readActiveGrants` already implements this at the delegation-grant layer (S0 finding, §1.2 of the reconciliation doc). Not wrapped in the Steward contract this run. |
| AS-09 | Marketa partner collaborators access permitted drafts; anonymous/unrelated cannot | not-started | not-started | not-started | not-started | RD-4 unresolved — the underlying publication-draft mechanism itself was not conclusively located this pass. Cannot build a facade over a mechanism not yet confirmed to exist. |
| AS-10 | Read/edit authority cannot publish; release uses exact approved version + required approvers | not-started | not-started | not-started | not-started | Same as AS-09 — blocked on RD-4. |
| AS-11 | Public release excludes private comments/attachments/parent-workspace links | not-started | not-started | not-started | not-started | Blocked on RD-4. |
| AS-12 | Editing after approval requires valid approval for the changed candidate | not-started | not-started | not-started | not-started | Blocked on RD-4. |
| AS-13 | CS/MFE and work-strand boundaries tested in fixtures; live grants match approved rules | partial (pre-existing) | not-started | blocked | not-started (pre-existing) | S0 confirmed `faculty-lead`/`student-researcher` roles + scope-bounding already exist (`participationAccess.ts`, `researchWorkspaceRoles.ts`). No new fixture test written this run for this specific boundary — flagged as next slice, not attempted. |
| AS-14 | Faculty cross-programme access requires explicit policy; no blanket live grant inferred | N/A (policy statement) | N/A | N/A | N/A | Honored by this run's own discipline: RD-1 recorded as explicitly unresolved, no inference made either in code or in this ledger. |
| AS-15 | Invite recipients/acceptance/expiry/scope use existing identity/invitation mechanisms | N/A this run | N/A | N/A | N/A | No invitation issued this run (explicitly out of scope per handoff instruction). Mechanism confirmed to exist (`participationAccess.ts`) in S0. |
| AS-16 | Grant/restrict/revoke checks requester authority; records preview/approval/apply outcomes | not-started | not-started | not-started | not-started | Out of scope this run — no mutation performed. |
| AS-17 | Revoking one grant correctly reports remaining independent entitlement | not-started | not-started | not-started | not-started | Out of scope this run. |
| AS-18 | Public/private editorial classification independent of cartridge and draft/final state | N/A (policy statement, confirmed by evidence) | N/A | N/A | N/A | S0's containment-audit review (§0/§1.3 of the reconciliation doc) is a real, prior, operator-approved instance of exactly this principle being enforced (IRL OS tabs hidden regardless of their "looks public" cartridge, pending explicit classification). |
| AS-19 | Constitutional Internet manuscript audience/version explicitly resolved or recorded unresolved | implemented (recorded unresolved) | N/A | N/A | pushed-to-branch | RD-5 in the reconciliation doc. Location confirmed; classification explicitly left unresolved per spec §6's own instruction — not changed, not inferred. |
| AS-20 | Cartridge, MCP, and direct retrieval agree on equivalent actions/rights | not-started | not-started | not-started | not-started | S0 found the mechanisms are organizationally separate (native routes vs. `services/threshold/*` MCP layer) but did not verify line-for-line parity. Flagged open in §1.4 of the reconciliation doc. |
| AS-21 | Search/cards/counts/thumbnails/errors do not leak protected metadata/bodies | partial (pre-existing, verified for 4 routes by containment audit) | N/A this run | not-started (platform-wide) | pushed-to-branch (pre-existing) | Containment audit's own explicit non-claim: not exhaustively traced platform-wide (Residual Risk 5). Not extended this run. |
| AS-22 | Underlying media/download delivery tested; URL exposure/recall limits documented | not-started | not-started | not-started | not-started | Out of scope this run — `evaluateAccess.ts`'s `deliveryMode` machinery (S0 §1.1) is the relevant existing mechanism; not tested against this criterion this run. |
| AS-23 | AEE/model retrieval cannot place unauthorized content in prompts/responses | not-started | not-started | not-started | not-started | AEE (`services/adaptive/*`) was located in file listings during S0 (`applicationProjectionManifest.ts`, `journeyAeeOrchestrator.ts`, `journeySpineAdapter.ts`) but not read or tested this run. |
| AS-24 | Persona/agent switches, expired authority, cached responses cannot reuse a stale decision | not-started | not-started | not-started | not-started | `accessSteward.ts` computes fresh on every call (no caching introduced) — satisfies this criterion trivially for the one function built, but no broader cache-invalidation work was done. |
| AS-25 | Steward audit/explanation itself is access-controlled; does not disclose private evidence to unauthorized callers | implemented | tested | not-started | pushed-to-branch | The DENY/UNRESOLVED branches in `accessSteward.ts` never include the counterparty's artifact content, title, or T0 identifiers — verified by the test asserting the DENY path carries no artifact fields. `evidence[]` entries are status/policy-name strings, never document content. |
| AS-26 | Private IRL workspace links/unpublished pipelines excluded from public IRL OS | implemented (pre-existing, containment audit) | N/A this run | not-started | pushed-to-branch (pre-existing) | Directly the containment audit's subject. Not touched or re-verified this run beyond reading it. |
| AS-27 | Service/configuration failure distinguished from empty content; private reads fail closed | implemented | tested | not-started | pushed-to-branch | `accessSteward.ts`'s UNRESOLVED branch (exchange-not-found / service error from `getExchangeView`) is structurally distinct from its DENY branch (not-a-party) and from ALLOW — tested as three separate cases, never collapsed to one "no access" bucket. |
| AS-28 | Idempotency, partial batch failure, authority changes between preview and apply tested | N/A this run | N/A | N/A | N/A | No mutation/batch path built this run. |
| AS-29 | Document/model prompt injection cannot grant access, change policy, or trigger publication | implemented (by construction) | tested (structural) | N/A | pushed-to-branch | `accessSteward.ts` takes no free-text/document content as input at all — its only inputs are `exchangeId` and `requestingPersonaId` (both server-resolved elsewhere, never LLM-authored). Test asserts the function signature carries no content/prompt parameter. |
| AS-30 | Deployment, authenticated-live acceptance, operational limits reported separately from unit/fixture success | implemented (this ledger) | — | — | — | This table's four-column structure IS the mechanism for this criterion; kept current at the end of every phase. |

## Summary counts (this run)

- **code implemented or partial:** 11 of 30 (AS-01,02,03,04,05,06,08,13,19,21,25,27,29 — note some overlap; see table)
- **fixture-tested:** 7 of 30
- **live-tested:** 0 of 30 (correctly — no live evidence was available or sought)
- **deployed (pushed to branch):** all implemented items; nothing merged to `dev` this run (explicitly not requested)

## What would move items forward next (see reconciliation doc §6 for the fuller list)

1. Resolving RD-3 (containment-audit Residual Risk 0) moves AS-07 from not-started toward partial —
   it is a real, already-scoped, already-flagged next slice.
2. Locating (or confirming absent) the Marketa publication mechanism (RD-4) is the blocking
   prerequisite for AS-09 through AS-12 — nothing should be built there until that search completes.
3. A CS/MFE fixture test over `researchWorkspaceRoles.ts` + `participationAccess.ts`'s existing role
   scoping would move AS-13 to fixture-tested without touching live data.
