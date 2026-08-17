# Homecoming Phase II (1.1) — Final Implementation Report

**Date:** 2026-08-16
**Branch:** `claude/resume-consumer-session-qm3v7c` (local commits only — **not pushed, not merged**)
**Scope:** Gate 0, WP-A (Increments 1 & 2), WP-B (Execution Return). Stops here per instruction —
no further implementation work package begun.

---

## System-level conclusion

**Question asked:** does Homecoming 1.1 now establish the closed loop —

```
Intent → Specification → Implementation Pack → External/agent execution → Execution Return → Evidence → Validation
```

**Answer: code-complete, wired end-to-end, and behaviorally tested — but not yet exercised as a
single live run against a real database or a real external actor.** Every step of the loop has
real, non-stubbed code implementing it, and every seam between steps has a passing test. The gap is
operational proof, not missing implementation. See "Production activation boundary" below for the
precise line between what is verified and what is still assumed to work.

---

## WP-A — Aletheon, the three-axis model

### Increment 1 — Aletheon specialist consultation
Wires Aletheon into the existing specialist-consult seam as a fifth parallel entry across the
already-established `Record<SpecialistId, X>` pattern (`services/agents/specialistRouter.ts`,
`services/orchestration/specialistRecommender.ts`, `app/api/assistant/ask-agent/route.ts`,
`app/data/personas.ts`). Aletheon becomes consultable via `POST /api/assistant/ask-agent
?specialist=aletheon`, independent of any aigentMe-role selection. 7 tests
(`tests/homecoming-phase-ii-wpa-aletheon.test.ts`), 68 tests green across touched + adjacent suites.

### Increment 2 — Aletheon as a dynamically selected aigentMe-role agent
A distinct capability from Increment 1: Aletheon (or any eligible bound agent) can be selected to
**fulfil the aigentMe role** — the voice/identity the aigentMe Copilot speaks in — rather than only
being consultable as a specialist. `services/agents/aigentMeRoleResolution.ts` (new) resolves WHO
fulfils the role from the existing `currentAigentMe` persona-agent assignment
(`resolveConstitutionalContext`); `app/api/codex/chat/route.ts` now resolves the system-prompt
identity **server-side** rather than trusting client-supplied `persona`/`aigentId` fields (only when
the role claim is `'aigent-me'` — every other role-gating check in that route is untouched);
`components/smarttriad/copilot/AigentMeRoleSelector.tsx` (new) is the header dropdown, reusing the
existing `GET /api/identity/constitutional-context` (read) and `POST /api/identity/persona-
assignments` (write) paths. 11 tests (`tests/homecoming-phase-ii-wpa-increment2.test.ts`).

### Three-axis architecture — preserved, not reinvented
1. **Agent identity** (`agent_root_identity`) — which agent exists at all.
2. **Persona/role routing preference** (`persona_agent_assignments`, `role='aigentMe'|'delegate'`) —
   which agent's voice the copilot currently speaks in. Pure routing, never authority.
3. **Bounded delegated authority** (`delegation_grants`) — what an agent is actually allowed to DO.

The operator's own audit (Gate A0, recorded in the governing pack's WP-A Amendment) found the
persistence/resolution layer **already implemented this model correctly** before WP-A began — the
actual gap was narrower: the aigentMe Copilot's chat backend hardcoded `'aigent-me'` and never
consulted `currentAigentMe` at all. WP-A closes exactly that gap. **No `delegation_grants` row was
minted for Aletheon in this pass** — selecting her as aigentMe grants zero authority beyond
conversational routing, by design.

### No schema changes required
Both increments reuse existing tables/columns (`persona_agent_assignments`, `delegation_grants`,
`SPECIALIST_LABELS`/`SPECIALIST_PERSONA_KEY` registries) verbatim. Nothing was migrated for WP-A.

---

## WP-B — Execution Return, the cybernetic return path

**Implementation Pack = bounded outward execution instruction.** Pre-existing
(`services/constitutional/implementationPack.ts`, `POST /api/constitutional/implementation-pack`),
untouched in its own generation logic by this pass.

**Execution Return = evidence-bearing return path.** New
(`services/constitutional/executionReturn.ts`, `POST /api/constitutional/execution-return`). Brings
qualitative evidence of what an external actor actually did — branch, commits, PR, files changed,
validation results, deviations, failures, discoveries, consequence observations — back into
constitutional state. Deliberately distinct from `ExecutionTelemetry`
(`services/constitutional/executionTelemetry.ts`, the numeric CI-dispatch observation ledger) —
mirrored in shape and spirit, never imported/reused, per the audited plan's explicit instruction not
to fork or conflate the two.

**Pack identity is now queryable through `actionInput.pack_id`.** The `implementation_pack_generated`
receipt (`app/api/constitutional/implementation-pack/route.ts`) now carries
`actionInput: { pack_id: pack.id }` — one additive line, every other field on that call untouched
(canary-pinned). This is what lets `verifyPackExists()` answer "does packId X correspond to a real
generated pack" with a real query instead of parsing free text.

**Return ingestion is fail-closed.** `verifyPackExists()` and `findAcceptedExecutionReturn()` are
both three-valued (`true/false/null` and `id/null/undefined`). The route refuses on `false` (confirmed
absent) **and** `null` (could not check) identically — never optimistic acceptance on doubt.
Malformed/incomplete bodies are rejected by a pure validator before any database call is attempted.

**Replays are deterministic/idempotent.** A second submission for a packId that already has an
accepted return is answered with the SAME receipt id (`replayed: true`) and writes nothing new — the
same evidence resubmitted twice cannot fabricate two divergent records of "what happened." A
duplicate-check failure also fails closed (503, refuse) rather than risk a second, divergent write.

**Validation transition is gated on accepted execution evidence where an implementation pack
exists.** `canEnterValidation()` (`services/devCommandCenter/devLoop.ts`) is layered ON TOP OF the
existing `canAdvance()` — never a rewrite of it — and wired into `advanceStage()`'s single existing
choke point (one additive early-return line). For a session with a generated pack, leaving
Implementation requires `state.acceptedExecutionReturn?.packId === pack.id`.

**Legacy/no-pack flows retain prior behavior.** A session with NO generated pack (a manually-
authored brief, never dispatched to an external actor) has no packId for evidence to attach to —
`canEnterValidation` returns exactly what `canAdvance` already returned. `canAdvance` itself is
byte-for-byte unchanged; every other capsule's Advance button is unaffected.

**Execution Return is visible in Validate.** `ValidationLayout.tsx` renders a read-only "Execution
Return accepted" card (packId, receipt id, recorded timestamp) when `session.acceptedExecutionReturn`
is present — satisfying the spec's own acceptance canary, stated explicitly as evidence only.

**Execution Return does not itself grant authority or authorize deployment.** No
`deployment_authorized` receipt is ever written by this path (grep-verified against actual write
calls, not doc-comment prose). No `delegation_grants` reference exists anywhere in the new code. The
`actor` field is a plain label, preserved verbatim — never attributed to "DevOn," and never a
persona/root/kybe identifier.

---

## Production activation boundary

This is the line between "the code is complete and internally consistent" and "this has been proven
to work against a live production environment." Both WP-A and WP-B sit on the code-complete side;
neither has been operationally exercised end-to-end in this pass.

### Code-complete (verified in this sandbox, by source inspection + passing tests)
- Every function/route/type described above exists, compiles cleanly, and is wired to its real
  caller — no stub, no placeholder, no TODO left in the execution path.
- All behavioral logic (fail-closed refusal, deterministic replay, the stage-transition gate, the
  three-axis preservation) is exercised by real test assertions, including one live mutation test
  proving the fail-closed check actually catches the regression it claims to guard.
- Regression and typecheck baselines are unchanged across every commit in this pass.

### NOT yet verified — the activation boundary
1. **No live database round-trip.** `verifyPackExists`/`findAcceptedExecutionReturn`'s Supabase
   queries (including the `action_input->>pack_id` JSONB filter) have never executed against a real
   Postgres/Supabase instance in this sandbox — there are no live DB credentials here, consistent
   with the same limitation recorded throughout this whole Homecoming Phase II session for every
   DB-backed leg. The query syntax is standard PostgREST and modeled directly on the existing,
   presumably-live sibling reader, but it is *unexecuted*, not merely untested-in-isolation.
2. **The migration has not been applied to any real database.** `20260930003300_implementation_
   execution_returned_receipt_type.sql` exists on disk and passes the TS/SQL parity canary
   (comparing the file's text against the TypeScript union), but no migration runner in this sandbox
   has actually run it against a schema. Until it is applied, `implementation_execution_returned`
   is the correct future value, not yet the accepted value, on any live `activity_receipts` table.
3. **No live external-actor round trip.** This pass did not fire a real Implementation Pack
   dispatch, wait for a real Claude Code CI run, and submit its real Execution Return. The
   `repository_dispatch → claude-implement.yml → PR` half of "External/agent execution" is
   pre-existing infrastructure from before this pass (unmodified by WP-B) — and this session
   separately, directly confirmed earlier that firing that dispatch from *within a Claude Code
   agent session* is blocked by a categorical sandbox-proxy restriction unrelated to WP-B's own
   code. That restriction says nothing about whether the deployed production app itself (using its
   own server-side `GITHUB_TOKEN`, a different credential entirely) can fire it — that question was
   not re-tested in this pass and is not settled by anything WP-B changed.
4. **No live browser/UI verification.** Unlike earlier DevOn UI phases in this session (which
   included Playwright screenshots at each gate), WP-B's new textarea/submit button and the
   Validate-stage evidence card were verified only by source-text and unit-level assertions, never
   rendered in a running browser. A CSS/layout/interaction defect invisible to those checks cannot
   be ruled out.
5. **Admin-gated auth path assumed, not re-verified.** The new route reuses `getActivePersona` +
   `cartridgeFlags.isAdmin` exactly as the sibling `implementation-pack` route does; this pass did
   not independently re-verify that spine path against a live session (it is pre-existing,
   unmodified infrastructure).

**Net effect:** the loop is real and internally coherent, but "code-complete" and "production-
activated" are different claims, and this report makes only the first one.

---

## Evidence

**Local branch:** `claude/resume-consumer-session-qm3v7c` — all commits below are LOCAL ONLY, not
pushed to `origin`, not merged to `dev`.

### WP-A commit IDs
| Commit | Subject |
|---|---|
| `31d532e40` | Gate 0: fix Kickstarter CTA navigation + CI copy |
| `dab0fb407` | handover doc for WP-A/WP-B audit + implementation plan |
| `947ad4dce` | Gate A0 audit + three-axis WP-A model amendment |
| `01debe39e` | **WP-A Increment 1**: wire Aletheon into the specialist-consult seam |
| `f49451bb8` | handover: mark WP-A Increment 1 done, Increment 2 still open |
| `b0396c49e` | **WP-A Increment 2**: aigentMe-role runtime resolution end-to-end |
| `431283a9f` | handover: finalize resume-here pointer (Gate 0 + WP-A done, WP-B not started) |

### WP-B commit ID
| Commit | Subject |
|---|---|
| `502996a1a` | **WP-B**: Execution Return — the cybernetic return path |

### Files changed
- **WP-A Increment 1** (5 files, +126/-2): `app/api/assistant/ask-agent/route.ts`,
  `app/data/personas.ts`, `services/agents/specialistRouter.ts`,
  `services/orchestration/specialistRecommender.ts`, `tests/homecoming-phase-ii-wpa-aletheon.test.ts`.
- **WP-A Increment 2** (8 files, +551/-4): `app/api/codex/chat/route.ts`, both Homecoming Phase II
  docs, `components/smarttriad/copilot/AigentMeRoleSelector.tsx` (new),
  `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`,
  `services/agents/aigentMeRoleResolution.ts` (new), `services/agents/specialistRouter.ts`,
  `tests/homecoming-phase-ii-wpa-increment2.test.ts` (new).
- **WP-B** (15 files, +1192/-33): `app/api/constitutional/execution-return/route.ts` (new),
  `app/api/constitutional/implementation-pack/route.ts`,
  `app/triad/components/codex/tabs/DevCommandCenterTab.tsx`, both Homecoming Phase II docs,
  `components/composer/CapabilityPipelineTab.tsx`,
  `components/devcommandcenter/layouts/ImplementationLayout.tsx`,
  `components/devcommandcenter/layouts/ValidationLayout.tsx`,
  `services/constitutional/executionReturn.ts` (new), `services/devCommandCenter/devLoop.ts`,
  `services/devCommandCenter/index.ts`, `services/receipts/activityReceiptService.ts`,
  `supabase/migrations/20260930003300_implementation_execution_returned_receipt_type.sql` (new),
  `types/devCommandCenter.ts`, `tests/homecoming-phase-ii-wpb-execution-return.test.ts` (new).

### Migrations
- `supabase/migrations/20260930003300_implementation_execution_returned_receipt_type.sql` — adds
  `implementation_execution_returned` to the `activity_receipts_action_type_check` CHECK constraint
  (full rebuild, per the established drift-incident convention). **Not yet applied to any live
  database** (see Production activation boundary above).

### Tests added / passing
- `tests/homecoming-phase-ii-wpa-aletheon.test.ts` — 7/7.
- `tests/homecoming-phase-ii-wpa-increment2.test.ts` — 11/11.
- `tests/homecoming-phase-ii-wpb-execution-return.test.ts` — 29/29 (one mutation-tested live).
- `tests/activity-receipts-action-type-parity.test.ts` — 3/3 (pre-existing canary, re-confirmed
  passing against the new migration).

### Regression / typecheck baseline comparison
| Measure | Baseline (pre-Homecoming-Phase-II) | After Gate 0 + WP-A + WP-B |
|---|---|---|
| Failed test files | 17 | 17 (unchanged) |
| Failed tests | 40 | 40 (unchanged) |
| Passing tests | 6827 | 6856 (+29, all WP-B's own) |
| TypeScript errors (`tsc --noEmit`) | 675 | 675 (unchanged) |

Re-confirmed fresh, immediately before the WP-B commit above — not carried forward from an earlier
measurement in this session.

### Environment-dependent / unverified in this pass
Enumerated in full in "Production activation boundary" above: live DB round-trip, live migration
application, live external-actor dispatch/return round trip, live browser rendering of the new UI,
and independent re-verification of the pre-existing admin-auth spine path.

---

## Status classification

| Capability | Status |
|---|---|
| Aletheon specialist consultation (WP-A Inc. 1) | **IMPLEMENTED** |
| Aletheon as selectable aigentMe-role agent (WP-A Inc. 2) | **IMPLEMENTED** |
| Three-axis model (identity / routing / authority) preserved | **IMPLEMENTED** |
| `ExecutionReturn` type + service (`verifyPackExists`, `findAcceptedExecutionReturn`, `recordExecutionReturn`) | **IMPLEMENTED** (code + mocked-DB tests) |
| Execution Return ingestion route, fail-closed refusal | **IMPLEMENTED** (code + mocked-DB tests) |
| Deterministic replay handling | **IMPLEMENTED** (code + mocked-DB tests) |
| `pack_id` queryable via `actionInput` | **IMPLEMENTED** (additive field present; live query **ENVIRONMENT-UNVERIFIED**) |
| Gated Validation stage transition (`canEnterValidation`) | **IMPLEMENTED** (pure-function tests, no live session exercised) |
| Legacy/no-pack Advance behavior preserved | **IMPLEMENTED** |
| Execution Return visible in Validate | **IMPLEMENTED** (source-verified; **not** rendered in a live browser) |
| No new authority/delegation semantics from Execution Return | **IMPLEMENTED** |
| Migration applied to a live database | **ENVIRONMENT-UNVERIFIED** |
| Live external-actor dispatch → PR → Execution Return round trip | **ENVIRONMENT-UNVERIFIED** |
| Production `repository_dispatch` capability (deployed app, real token) | **ENVIRONMENT-UNVERIFIED** — this session confirmed only that ITS OWN sandboxed agent context cannot fire it; the deployed app's own capability was not independently retested |
| Live browser/UI rendering of the new Execution Return affordance | **ENVIRONMENT-UNVERIFIED** |
| CRM/campaign cohort tool-calling for Aletheon (or any delegate) | **MISSING** — `resolveCampaignContact()` is real and callable but no agent-tool-calling registry wires it to any LLM-backed specialist today (platform-wide gap, not Aletheon-specific; carried over from the WP-A audit, not addressed by WP-A or WP-B) |
| `delegation_grants` row for Aletheon | **MISSING** — none minted in this pass, by design (zero authority from role selection alone) |
| Deployment execution / deploy authorization via Execution Return | **MISSING BY DESIGN** — explicitly out of scope; Execution Return never authorizes deployment |
| Delegate-scoped memory store | **MISSING** (platform-wide gap, pre-existing, not addressed) |
| `agent_persona.delegation_scopes` | **MISSING / dead code** (platform-wide, pre-existing, not addressed) |
| `docs/platform-ontology.md` accuracy re: Aletheon's root-identity row | **MISSING / stale** (pre-existing drift, flagged not fixed) |

No claim above extends to CRM/campaign execution tooling, deployment execution, live database
behavior, or any external service beyond what was actually exercised in this sandbox.

---

## Stop

Per instruction: report produced and saved. No push, no merge, no further implementation work
package begun.
