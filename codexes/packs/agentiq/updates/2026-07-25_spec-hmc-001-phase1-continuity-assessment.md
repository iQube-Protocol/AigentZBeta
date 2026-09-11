# SPEC-HMC-001 Phase 1 — Agent Continuity Assessment Substrate

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Agent:** Claude Code
**Spec:** `codexes/packs/irl/foundation/SPEC-HMC-001_constitutional-agent-continuity.md` (ratified operator-directed 2026-07-25 this session)
**Charter it operationalizes:** `codexes/packs/irl/foundation/CFS-023_chrysalis-homecoming.md` (Agent + Knowledge sovereignties)

---

## 1. What the operator authorised, and what that authorisation did NOT cover

SPEC-HMC-001 was filed 2026-07-24 as **DESIGN — docs-only, awaiting explicit operator ratification**, with §13's ratification record deliberately unchecked. The operator ratified it and authorised Phase 1 implementation on **2026-07-25**.

The SPEC header and §13 were updated this session to record that, following the **SPEC-MMC-002 precedent** (which cites its operator ratification, and states what the ratification does and does not waive). Three things are recorded honestly:

- **No verbatim operator quote is reproduced.** SPEC-MMC-002 could quote its operator approval verbatim; this one was relayed to the implementing agent as a direction to build. Per CLAUDE.md's "No Guessing or Hallucinating" rule, the ratification is recorded as *operator-directed and dated*, not dressed in an invented quotation.
- **The ratification authorises design-and-build on §14.1's scope only.** It waives nothing substantive: §11's honest limits stand, and Principal–Delegate Separation is not relaxed in any degree.
- **§13's host-parser line item stays a separate gate, and stays unmet.** No parser for Claude AI, Claude Code, or Codex was built or authorised. A new `Phase 2+` line item was added, explicitly **unchecked**.

---

## 2. Scope — the smallest honest Phase 1

SPEC-HMC-001 defines a six-stage migration lifecycle and a five-part continuity taxonomy. Building all six stages, or a live multi-host migration engine, would have produced unverifiable scaffolding. Phase 1 is the **continuity assessment substrate** only: given a delegate, report which continuity dimensions are satisfiable from real platform state — read-only, no mutation, no migration execution.

**Explicitly NOT built (and stated as such in the SPEC's new §14.2):** migration execution, chat/transcript import for any host except the already-shipped ChatGPT path, cross-host data transfer, any write to another vendor's system, and any re-authorization ceremony wiring.

---

## 3. What shipped

| File | Change | Why here and not somewhere new |
|---|---|---|
| `types/homecoming.ts` | **Extended** with §8: `MIGRATION_LIFECYCLE_STAGES`, `MIGRATION_STAGE_SIGNAL`, `migrationStageIndex`, `resolveMigrationStage`, `ASSESSABLE_STAGE_CEILING`, `stageRequiresHumanAct`, `AGENT_CONTINUITY_DIMENSIONS`, `CONTINUITY_DIMENSION_SPEC`, `MIGRATION_SOURCE_HOSTS`, `migrationSourceParserExists` | SPEC-HMC-001 is the mechanics layer under CFS-023 and introduces no new sovereignty/ladder/invariant class — so its contracts belong in CFS-023's contract file. The SPEC says so itself (§0.3: "this document adds no parallel constant set"). A new types file would have been the duplication `inv.engineering.037` names as a defect. |
| `services/homecoming/agentContinuity.ts` | **New** — the read-only assessor. Pure `assembleContinuity()` + impure best-effort reads | No existing service assesses continuity; the four sibling homecoming services each own a different concern (presence, standing, import, produce). This composes all of them and re-derives none. |
| `app/api/homecoming/agent/continuity/route.ts` | **New** — `GET`, spine-gated + admin-gated | Sixth route in the existing `/api/homecoming/agent/*` family, same gate as the other five. |
| `tests/homecoming.test.ts` | **Extended** — contract pins for the new constants, pure-assembler tests, and structural canaries | Same contract file, same canary suite. 38 tests pass. |

### 3.1 Composition, not duplication

`agentContinuity.ts` calls into what already exists and re-implements none of it:

- Constitutional Presence → `assessDelegate()` (`constitutionalPresence.ts`), unmodified.
- Earned standing → `resolveDelegateAgentId()` + `readDelegateStanding()` (`delegateStanding.ts`), unmodified.
- Artefact provenance → `listArtifactRecords({ delegate })` (`artifactRecordStore.ts`), unmodified.
- Constitutionalized knowledge → the `homecoming` KB domain (`getStats`) + the `invariants` substrate (`listInvariants`), filtered by the `hc:` seed prefix `constitutionalize.ts` stamps.

No new table, no new store, no DB migration. **There is no SQL for the operator to run.**

---

## 4. The honest answer — which dimensions are genuinely assessable today

This is the substantive finding of the pass, and it is deliberately not flattering.

| Dimension | Assessable? | Scope | Reasoning |
|---|---|---|---|
| **artefact** | **Yes** | delegate | `artifact_records.delegate` carries the delegate slug. Counting records (and how many are receipt-anchored) is a real, per-delegate read. Attribution survives a host change precisely because it keys on the delegate identity, not the host. |
| **relationship** | **Yes — the half that transfers** | delegate | Earned standing (§9.2 component 3) is readable via the Standing loop. The *other* half (component 6, bounded authority) is **by design never carried forward** — it is freshly re-granted by the human. So the dimension reports standing honestly and states that authority is not, and cannot be, inherited. |
| **behavioural** | **Partially — corpus scope only** | corpus | The `homecoming` KB domain and the `invariants` substrate are both real and readable. Neither carries a delegate binding: `codex_kb_documents` has no delegate column, and `invariants.creator_persona_id` is T0 (never returned by `mapInvariantRow`) and identifies a *human*, not a delegate. So the strongest honest claim is about the **shared corpus**, never "this delegate's memory". The assessment stamps `scope: 'corpus'` so no consumer can mistake one for the other. |
| **working-context** | **No — not assessable today** | none | `journey_states` is keyed on `persona_id` — a row in `personas`, i.e. a **human** persona. `agent_persona` rows are not journey subjects. A delegate therefore has no current-intent / in-flight-commitment record anywhere in the platform. The human principal's journey row *does* exist, but it is the principal's working context, not the delegate's; substituting it would attribute a human's state to an agent. Reported as `not-assessable` with that exact reason attached. |
| **project** | **No — not assessable today** | none | Same root gap, one scope narrower: with no delegate-scoped working-context store there is also no venture/intent scoping key for a delegate. |

**Two of five dimensions have no platform state to assess against.** That is reported as a stated gap (`NOT_ASSESSABLE_TODAY`, carried as data so the gap travels with the contract), never as a zero score. A zero would have read as "the delegate has no working context"; the truth is "the platform cannot currently tell".

---

## 5. The structural guarantee — no auto-authorization, by construction

SPEC-HMC-001 §9.2 component 6 and CFS-043's Principal–Delegate Separation are absolute: an agent may form and accept its own side of a delegation, but **only the human authorizes, in the browser**. Phase 1 enforces this three ways, not one:

1. **The lifecycle stage is hard-capped.** `ASSESSABLE_STAGE_CEILING = 'presence-reconstituted'` (stage 4). Stages 5 (`delegation-reauthorized`) and 6 (`native`) are passed to the resolver as unconditionally unsatisfied. Even with a fully sovereign delegate (presence L5, standing 140, every artefact receipt-anchored), the assessment resolves to stage 4 and no higher — pinned by canary. Reporting stage 5 would assert a human act that did not happen.
2. **The ceiling is derived, not asserted.** `MIGRATION_STAGE_SIGNAL` carries a `humanAct` flag per stage, and a canary proves *every* stage above the ceiling is a human-act stage. The cap cannot drift out of alignment with the taxonomy.
3. **Structural canaries over raw source.** The service and route are grepped for the Constitutional Agreement / guided-onboarding modules, their form/accept/authorize verbs, every write verb (`.insert(`, `.update(`, `.upsert(`, `.delete(`), receipt writing, and standing accrual. The route is additionally proven to export `GET` and no mutating handler.

### 5.1 The canary caught its own author — twice

Both failures on the first run were real:

- The service's header comment *named* the authorization verbs (while explaining that it never calls them). The grep is over raw source **including comments** — it failed. Rather than weaken the canary to exempt comments, the comment was reworded and the strictness documented in-file. A canary you soften the first time it fires is not a canary.
- The `project` dimension's gap text said "same root gap as working-context" without restating `journey_states`. The test asserted each gap is self-contained. Fixed by restating the schema reason in full — a gap that only makes sense next to another gap is not a stated gap.

### 5.2 T0 discipline

The response carries delegate slugs, dimension statuses, presence rungs, counts, and stage labels — nothing else. The caller's persona is resolved server-side for the gate and never echoed. Canary asserts no `personaId` / `authProfileId` / `rootDid` / `kybeAttestation` / `fioHandle` in any `NextResponse.json` block, and that the service contract carries no T0 field.

---

## 6. Honest limits of Phase 1 itself

- The assessment is **per-delegate**, and the delegate roster is `HOMECOMING_DELEGATES` (six named delegates). It does not assess arbitrary third-party agents — no such record exists.
- `listArtifactRecords` soft-fails to `[]`, so "0 records" is honestly rendered as *"none observed"*, not *"none exist"*. The evidence string says so.
- `behavioural` reads at most 500 invariants (`listInvariants` caps at 500). At present corpus size this is not binding, but it is a ceiling, not a full scan.
- **No UI surface was built.** The assessment is API-only. A cartridge tab is a reasonable follow-on, not part of this authorisation.
- Migration execution remains entirely unbuilt — see §7.

---

## 7. What remains unbuilt (and unauthorised)

| Item | Status |
|---|---|
| Claude AI / Claude Code / Codex source parsers | **Not authorised** — SPEC-HMC-001 §13 line item, still a separate gate |
| Migration execution (any stage transition) | Not built |
| Cross-host data transfer / writes to a vendor system | Not built, and out of scope by design |
| Working-context + project continuity | Blocked on a delegate-scoped working-context store that does not exist. Building one is a schema decision requiring its own operator gate — flagged, not assumed. |
| Re-authorization ceremony wiring (stage 5) | Not built. Deliberately: it is a human act in the browser, and Phase 1 must never be the thing that performs it. |

---

## 8. Verification

```
npx vitest run tests/homecoming.test.ts     # 38 passed
npx tsc --noEmit -p tsconfig.json           # 0 errors in the new/changed files
```

No DB migration. No SQL for the operator to run. No environment variable added.

---

## 9. Files touched

```
codexes/packs/irl/foundation/SPEC-HMC-001_constitutional-agent-continuity.md   (header, §13, new §14)
types/homecoming.ts                                                            (extended, §8)
services/homecoming/agentContinuity.ts                                         (new)
app/api/homecoming/agent/continuity/route.ts                                   (new)
tests/homecoming.test.ts                                                       (extended)
codexes/packs/agentiq/updates/2026-07-25_spec-hmc-001-phase1-continuity-assessment.md   (this doc)
codexes/packs/agentiq/collections.json                                         (col_updates registration)
```
