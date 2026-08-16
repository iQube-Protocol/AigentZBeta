# Homecoming Phase II — Handover (Gate 0 done; WP-A/WP-B audited, not yet coded)

**Date:** 2026-08-16
**Status:** IN PROGRESS — handing off mid-implementation, ahead of a possible session rate-cap cutoff
**Governing spec:** `codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md` — read it in full before continuing; this doc only records audit findings + the exact remaining plan, it does not restate the spec.
**Branch:** `claude/resume-consumer-session-qm3v7c` — do NOT push/merge without explicit operator authorization (standing instruction this session).

---

## 0. What is DONE and committed

Commit `31d532e40` on this branch (local, not yet pushed):

- `components/journey/KnytsBridgeChooseSurface.tsx` — Gate 0A fix (Kickstarter CTA navigates unconditionally; synchronous URL resolution via existing `getKnytsBridgeKickstarterUrl()`; fire-and-forget telemetry; always-visible new-tab fallback; truthful confirmed-follow reward copy).
- `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` — Gate 0B copy fix ("Explore the Mythos of the Polity").
- `tests/homecoming-phase-ii-gate0.test.ts` — 8 new tests, all passing.

Verified before commit: `npx vitest run tests/homecoming-phase-ii-gate0.test.ts` (8/8), `npx vitest run tests/knyts-bridge-campaign-activation.test.ts` (41/41 unaffected), scoped typecheck on both touched files (0 errors).

**This satisfies Gate 0's acceptance criteria and the final report's "proof Kickstarter navigation/fallback works" / "proof CI copy is corrected" items.**

Task tracker: #210 completed. #211 (WP-A audit) and #213 (WP-B audit) are functionally complete (see below) — mark completed when you pick this up. #212, #214, #215 remain pending.

---

## 1. WP-A audit findings (three sub-audits completed — full text in earlier task outputs / conversation, condensed here)

### 1a. Two separate, unrelated "which agents can I talk to" systems exist

1. **`BoundedDelegationTab` roster** (admin-facing Codex tab, `app/triad/components/codex/tabs/BoundedDelegationTab.tsx`) — **registry-driven, not hardcoded**: sources any `agent_root_identity` row where `sponsor_persona_id IN` the caller's owned-persona set (`services/identity/constitutionalContext.ts:200-216`). **Aletheon already appears here automatically once her `agent_root_identity` row's `sponsor_persona_id` matches the caller's persona cluster — no code change needed for this surface.** This is NOT the aigentMe end-user chat surface.

2. **The Copilot specialist system** (the actual "aigentMe Copilot invocation" seam WP-A means) — `services/agents/specialistRouter.ts` + `app/api/assistant/ask-agent/route.ts` — a **hardcoded `SpecialistId` union + several `Record<SpecialistId, X>` maps**. Aletheon is **absent** from all of them today. This is the one that needs code changes.

### 1b. Live identity state (doc-claimed, not independently re-verified — no DB access in this audit)

Per `codexes/packs/agentiq/updates/2026-08-15_aletheon-homecoming-phase-a-capability-census.md` Addenda A-C: `agent_root_identity` row exists, production `agent_persona` exists, approved `agent_participant` passport exists, Constitutional Presence = L2 ("reasoning"), anchor repair executed live, verdict "PARITY READY". **`docs/platform-ontology.md:96-99` is stale** — still asserts no root-identity row exists; contradicts the census's own later finding (a second instance of the same drift class as `CI-2026-08-15-STALE-STATIC-PRESENCE-MARKER-001`). Worth flagging to the operator, not in scope to fix here.

No `delegation_grants` row for Aletheon was found anywhere (code or docs) — confirmed absent, not merely unindexed. Bounded authority (WP-A's requirement) has no grant to inspect yet; this audit does not create one (WP-A's "smallest reuse-first changes" is about the specialist-invocation seam, not minting a new grants row — the pack's authority envelope section is a *policy* boundary to respect when eventually issuing a grant, not something this pass is asked to write to DB).

### 1c. Memory/knowledge substrate

No delegate-scoped memory table exists (platform-wide gap, not Aletheon-specific). Specialist consults ground via `services/invariants/resolution.ts::resolveConstitutionalField()`/`resolveCitableInvariants()`, scoped by `domains`/`namespaces` — reusable as-is for Aletheon (no namespace restriction like MoneyPenny's `finance`-only scoping is required; Aletheon should get the platform-wide slice like aigent-z/aigent-c/nakamoto/researcher do).

### 1d. CRM/campaign tool-calling — the honest gap

**No agent-callable tool registry in this codebase exposes CRM/campaign cohort functions to ANY delegate today** (not Marketa, not Nakamoto, not anyone) — confirmed by the third audit sub-pass. `services/crm/campaignContactResolver.ts::resolveCampaignContact()` is real, working, callable code (the exact mechanism WP-A's "Specific CRM scenario to prove" would use), but nothing wires it as a tool an LLM-backed specialist can invoke mid-conversation. Wiring genuine tool-calling is a materially larger change than "smallest reuse-first" — **recommend reporting this as PARTIAL/MISSING in the final capability census rather than building new agent-tool-calling infrastructure in this pass.** Email draft + gated send (`services/agents/draftEmail.ts`, `app/api/connectors/execute/route.ts`'s `requiresApproval` gate) are real and already persona-scoped (not delegate-identity-gated) — these "work" for Aletheon automatically once she can chat at all, no new code needed.

### 1e. Authority model

`delegation_grants.allowed_actions`/`trust_band` is the live authority mechanism; no independent "can_merge"/"can_deploy" flag exists anywhere — merge/deploy-adjacent authority is just `registry_publish` (L4)/`full_delegation` (L5) strings in `allowed_actions`. Since this pass is not minting a `delegation_grants` row for Aletheon, merge/deploy authority is trivially NOT implied — satisfies that acceptance canary by omission, honestly reported.

---

## 1f. Operator revision (2026-08-16, after this doc was first written) — three-axis model + Gate A0

The operator revised WP-A's framing before implementation started, correcting a conflation in the
original plan: "aigentMe" is a **role** an eligible agent can fulfil (routing/representative
identity), never authority by itself. Three independent axes — active persona / active aigentMe
agent / bounded delegation grant — must never let selecting one silently mutate either of the
others. Full model + a completed Gate A0 factual audit are now recorded as an amendment inside the
governing spec itself: see
`codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md`, section
**"WP-A Amendment (2026-08-16, operator-directed) — the three-axis model + Gate A0 audit"** —
read that section before writing any more WP-A code; it supersedes §2 below wherever they conflict.

**Headline finding:** the persistence/resolution layer (`services/identity/constitutionalContext.ts`,
`services/identity/personaAssignmentStore.ts`, `delegation_grants`) **already implements the
operator's three-axis model correctly** — `persona_agent_assignments` (role='aigentMe'|'delegate')
is already documented and coded as pure routing preference, never authority; `currentAigentMe`
already resolves with the right precedence and keeps `delegatedAuthority` populated only from the
active grant. **No schema change is needed.** The real gap is narrower than first framed: the
aigentMe Copilot's actual chat backend (`AigentMeWelcomeSplitTab.tsx`,
`app/api/codex/chat/route.ts`) hardcodes the literal identity `'aigent-me'` everywhere (10+ call
sites) and never consults `currentAigentMe` at all — so wiring Aletheon into the specialist router
(§2 below) makes her consultable as a specialist, but does NOT make her selectable as "the thing
fulfilling the aigentMe role." That second, larger piece (thread the resolved assignment through the
chat route, add the aigentMe-header selector reusing the existing
`GET /api/identity/constitutional-context` + `POST /api/identity/persona-assignments` endpoints, add
a "Manage authority" affordance reusing the existing Delegation UI) is **audited but deliberately not
coded in this pass** — it touches large, high-traffic, shared chat infrastructure and deserves a
dedicated pass rather than being rushed. It's fully scoped as "Increment 2" in the pack amendment,
including the one confirmed open question the operator asked about: **"Default aigentMe" has no
backing `agent_root_identity` row at all** (confirmed absent from every migration's seed list) — it
is a pure UI/copilot role, not an agent identity, and should stay that way for Phase II.

**Practical effect on task #212:** implement ONLY "Increment 1" from the pack amendment (the
specialist-router wiring, i.e. exactly §2 below) in this pass, report it honestly as "Aletheon
consultable as a specialist" rather than "Aletheon activated as aigentMe," and leave Increment 2 as
a named, scoped, not-yet-started follow-up in the final report (#215).

## 2. WP-A — exact remaining implementation plan (not yet coded)

Goal: wire Aletheon into the **specialist router** (the generic delegate/specialist seam), reusing the identical pattern every other specialist already uses — confirmed via `grep -rn "Record<SpecialistId"` that exactly **5 parallel `Record<SpecialistId, X>` maps** must be updated together (this is the established, TS-enforced pattern per a prior session's own doc: `codexes/packs/agentiq/updates/2026-07-22_founder-office-action-modes-amendment.md:177`). TypeScript will refuse to compile if any map is missed once `'aletheon'` is added to the `SpecialistId` union — use that as the completeness check.

### File-by-file diff plan

1. **`services/agents/specialistRouter.ts`**
   - `SpecialistId` union (line 41-50): add `| 'aletheon'`.
   - `SPECIALIST_PERSONA_KEY` (line 135-145): add `aletheon: 'aigent-aletheon'`.
   - `SPECIALIST_LABELS` (line 147-157): add `aletheon: 'Aletheon'`.
   - `inferRequestType()` (line 161-176): add `if (specialistId === 'aletheon') return 'sovereignty_brief';` — **reuse the existing `sovereignty_brief` request type** (already used by `metaye`) rather than adding a new `SpecialistRequestType` member; Aletheon's own Agent Card lists "sovereignty-advisory" as a real skill, so this is honest reuse, not a stretch.
   - `templateResponse()` (line 426-624): add an `if (specialistId === 'aletheon') return {...}` branch **before** the final `metaye` fallback (which is currently an unconditional `return` at the end — must convert to `if (specialistId === 'metaye') return {...}` first, or insert the aletheon branch before it, otherwise aletheon silently falls through to metaye's response). Ground the copy directly in Aletheon's real Agent Card content (`app/api/agents/aletheon/route.ts` lines 44-46, 66-103, 143 — description, the 5 declared skills: constitutional-reasoning, knowledge-synthesis, institutional-memory, sovereignty-advisory, revealed-context; motto "Not to command the path, but to illuminate it."). Suggested shape:
     ```ts
     if (specialistId === 'aletheon') {
       return {
         requestType,
         title: `Constitutional context for "${intent}"`,
         summary: `Aletheon surfaces the assumptions, dependencies, and constitutional implications of ${intent} — illuminating the decision, not making it.`,
         recommendations: [
           `Name the constitutional principles or invariants ${intent} touches, and cite them.`,
           `Surface what is assumed vs. verified before acting on ${intent}.`,
           `Identify the bounded-delegation or authority question, if any, that ${intent} raises.`,
           `Preserve the institutional memory this moment creates — what should be recorded for continuity.`,
         ],
         suggestedArtifacts: ['google-doc', 'brief', 'myworkbench-draft'],
         requiresApproval: false,
         confidence: 'high',
       };
     }
     ```
     (Do not fabricate invariant citations — this is the deterministic template fallback path only; the LLM path already grounds via `buildSpecialistInvariantSlice`/`INVARIANT_GROUNDING_CLAUSE` same as every other specialist, no separate work needed there.)

2. **`services/orchestration/specialistRecommender.ts`**
   - `SPECIALIST_LABELS` (line 60-70): add `aletheon: 'Aletheon'`.
   - `SPECIALIST_DESCRIPTIONS` (line 72-82): add `aletheon: 'Constitutional reasoning, knowledge synthesis, institutional memory, revealed context'`.
   - `SPECIALIST_ACTIVATION_GATE` (line 90-100): add `aletheon: null` (always-available — cross-cutting like aigent-z/aigent-c/nakamoto/moneypenny, matching WP-A's "assist across all three bridge campaigns" framing).
   - `computeRoster()` (line 122-145) auto-includes her once the maps above are updated — no change needed there.
   - Optional, cheap, not required: add a keyword-match bonus in `deterministicPick()` (around line 190-212) — `if (entry.id === 'aletheon' && /(constitutional|governance|context|memory|synthesis|institutional)/.test(q)) score += 50;` in both the `primaryGoal` and `q` blocks, mirroring the existing per-specialist keyword idiom. Skip if short on time — she still surfaces via `always-available` base score (20) without it.

3. **`app/api/assistant/ask-agent/route.ts`**
   - `VALID_SPECIALISTS` array (line 318): add `'aletheon'`.
   - No new alias strictly required in `SPECIALIST_ALIASES` (line 325-337) since the canonical id `'aletheon'` is already short/natural; optionally add `alethean: 'aletheon'` given the ratified historical spelling ambiguity (`RES-2026-08-15-ALETHEON-SPELLING-AMBIGUITY-001`) so either spelling resolves.

4. **`app/data/personas.ts`**
   - Add a new entry `"aigent-aletheon": { key: "aigent-aletheon", title: "Aletheon", systemPrompt: "..." }` (insert near the other `aigent-*` entries, e.g. after `aigent-metaye` around line 511 — confirm exact insertion point with a fresh read before editing, the file may have shifted). **Derive the systemPrompt directly from the Agent Card's own text** (`app/api/agents/aletheon/route.ts` — description, constitutional principles in the file's header comment lines 16-20, the 5 skills' descriptions, obligations list, motto) — do not invent new voice/persona content; this keeps WP-A's "reuse existing... never fabricate" instruction intact. Follow the existing persona entries' prose style (see `aigent-z`/`aigent-metaye`/`aigent-researcher` for the register: second person "You are X", numbered "How you help" section, closing tone guidance).

5. **`components/metame/welcome/layouts/SpecialistsLayout.tsx`** (optional, low-risk, improves UX discoverability)
   - `PROMPT_TEMPLATES_BY_SPECIALIST` (line 49, `Partial<Record<SpecialistId, string[]>>` — optional, TS will not force this) — add `aletheon: ["What context am I missing before deciding this?", "Surface the constitutional implications of...", "Help me preserve institutional memory on..."]`. Skip if short on time — it's `Partial`, so omitting it is not a type error, just a smaller quick-prompts list for her card.

### After coding WP-A

- Run `npx tsc --noEmit` scoped to touched files (or full, if budget allows) — expect **zero new errors**; the 5-map pattern is TS-enforced so a missed map surfaces immediately as a compile error, which is the fastest completeness check.
- Add a small test file (e.g. `tests/homecoming-phase-ii-wpa-aletheon.test.ts`) using the existing `sourceAuthority` structural-canary convention (see `tests/homecoming-phase-ii-gate0.test.ts` for the pattern) asserting: `'aletheon'` present in `SpecialistId`/`VALID_SPECIALISTS`/all 3 recommender maps in `specialistRecommender.ts`/`SPECIALIST_PERSONA_KEY`+`SPECIALIST_LABELS` in `specialistRouter.ts`; `personas['aigent-aletheon']` exists in `app/data/personas.ts`; the `ask-agent` route's 400 rejection no longer fires for `specialistId: 'aletheon'` (either a structural check on `VALID_SPECIALISTS.includes('aletheon')` or, if a behavioral harness exists for this route already, reuse it).
- Do NOT touch `services/horizen/registrableAgents.ts`, `app/data/personas.ts`'s other entries, `services/metame/agentLlmOrchestra.ts`'s `RUNTIME_AGENT_IDS`, or attempt to create a `delegation_grants` row / fix `docs/platform-ontology.md` — all out of scope for "smallest reuse-first changes" per the spec; name them as unresolved gaps in the final report instead.

---

## 3. WP-B audit findings

- `services/constitutional/implementationPack.ts` — `ImplementationPack.id` is the canonical packId (confirmed, already used as `packId` in `propose()`'s deployment-proposal and in `DevCommandCenterTab.tsx:1041`'s validation-record correlation).
- `types/devCommandCenter.ts` — `DevLoopStage` has **no `implementation_complete` stage** (only `implementation → consequence_validation` directly) — confirms the spec's claim that this transition is genuinely missing and WP-B is authorized to add it, gated on a valid Execution Return. Do not confuse the real `ImplementationPack` (has `.id`) with the separate, legacy, `id`-less `ImplementationPackage` client-derived readiness-check type (`types/devCommandCenter.ts:338`, built by `buildImplementationPackage()`) — different things, only the former matters here.
- `components/devcommandcenter/layouts/ImplementationLayout.tsx` — existing `generate()` (`/api/constitutional/implementation-pack`), existing `copyPack()` (`navigator.clipboard.writeText(packMarkdown(pack))`, labeled "Copy pack"/"Copied", ~lines 423-429), existing `propose()`, and the existing **autonomous** "Dispatch to Claude" button block (`/api/dev-command-center/implement` → `repository_dispatch` → CI) — **must not be touched or reopened**, per the spec's explicit constraint.
- `components/composer/CapabilityPipelineTab.tsx::packMarkdown()` (full function read, lines 117-217) — already serializes ~90% of what WP-B needs: invariant bindings, areas to touch, forbidden files, excluded/protected areas, unverified-existing-paths, known baseline failures, execution route, constitutional decision, capability evidence, validation plan, receipt plan, consequence preflight. **Two concrete gaps, both small:**
  1. `pack.id` is never printed anywhere in the generated markdown text (only used programmatically elsewhere) — add a line near the top of the serialized output, e.g. `**Pack ID:** \`${pack.id}\``.
  2. No forward-looking "return an Execution Return" instruction exists — only a backward-looking receipting footer. Add a closing section instructing the external actor (Claude Code under the operator's subscription) to produce and return the `ExecutionReturn` fields listed in the spec (packId, actor, branch/commits/PR, filesChanged, validationResults, deviationsFromPack, failuresOrEscalations, discoveries, consequenceObservations, completedAt) rather than silently finishing.
- **The packId-verification mechanism (the exact question this audit was resolving when the session was interrupted):** `app/api/constitutional/implementation-pack/route.ts` (lines 60-154) creates an `implementation_pack_generated` activity receipt on pack generation (via `createActivityReceipt`), but **`pack.id` is only embedded in the human-readable `summary` string** (via `packSlug(pack.id)`) and in `invariantsUsed` — **it is NOT stored in a structured, directly-queryable field today.** Compare with the sibling pattern `services/constitutional/executionTelemetry.ts::recordExecutionTelemetry()` (read in full), which DOES store `actionInput: { pack_id: input.packId, branch: ..., ... }` — a structured JSONB field on the receipt, confirmed queryable via the existing reader `services/receipts/activityReceiptService.ts::getActivityReceiptActionInput(receiptId)` (reads the `action_input` column directly, three-valued null/undefined/value discipline).

  **Resolved plan:** make the **minimal additive change** to `app/api/constitutional/implementation-pack/route.ts`'s existing `createActivityReceipt` call (around line 96-106) to add `actionInput: { pack_id: pack.id }` (or a slightly richer object mirroring `recordExecutionTelemetry`'s shape: `{ pack_id: pack.id, goal, invariant_count: pack.invariantBindings.length }`) — this is a pure addition to an existing call site, non-breaking, and makes "does packId X correspond to a real generated pack" answerable by **querying `activity_receipts` for `actionType='implementation_pack_generated' AND action_input->>'pack_id' = $packId'`**, exactly mirroring the established, working pattern. This is the reuse-first answer to the spec's acceptance canary ("Returned packId must match an existing/generated pack. Wrong/stale pack return is refused.") — no new lookup table needed.

---

## 4. WP-B — exact remaining implementation plan (not yet coded)

1. **`app/api/constitutional/implementation-pack/route.ts`** — add `actionInput: { pack_id: pack.id }` to the existing `implementation_pack_generated` `createActivityReceipt(...)` call (~line 96-106). Purely additive; do not touch the DVN-protected files list (this route is not on it).

2. **New file `services/constitutional/executionReturn.ts`** (mirror `executionTelemetry.ts`'s shape/spirit, do not import/reuse its narrow numeric `ExecutionTelemetry` type directly — the spec explicitly wants a new type for the qualitative fields):
   ```ts
   export interface ExecutionReturn {
     packId: string;
     actor: string;
     branch?: string | null;
     commits?: string[];
     pullRequest?: { number?: number; url?: string } | null;
     filesChanged: string[];
     validationResults: Array<{ name: string; status: 'passed' | 'failed' | 'not-run'; detail?: string }>;
     deviationsFromPack: string[];
     failuresOrEscalations: string[];
     discoveries: string[];
     consequenceObservations: string[];
     completedAt: string;
   }
   ```
   - `verifyPackExists(packId: string): Promise<boolean>` — queries `activity_receipts` for `actionType='implementation_pack_generated'` with `action_input->>'pack_id' = packId` (use the admin client the same way `getActivityReceiptActionInput` does, or add a small sibling reader in `activityReceiptService.ts` if that's cleaner/more consistent with inv.engineering.036 — prefer extending `activityReceiptService.ts` with a `findReceiptByActionInputField()`-style helper ONLY if a second caller will need it; otherwise a local query in this new file is fine for a single call site).
   - `recordExecutionReturn(input: { actingPersonaId: string; ret: ExecutionReturn }): Promise<string | null>` — persists via `createActivityReceipt` with a **new** `ActivityActionType` member (see step 3) and `actionInput` carrying the full `ExecutionReturn` object (JSON-serializable, all fields are strings/arrays/primitives — safe to store as-is).

3. **`services/receipts/activityReceiptService.ts`** — add one new `ActivityActionType` member, e.g. `'implementation_execution_returned'`, next to the existing `'implementation_execution_observed'` (~line 433), with a short comment naming it as the manual/external-actor counterpart (numeric CI telemetry vs. qualitative human-reviewed handoff). Then add the required **additive migration** widening the `activity_receipts` action_type CHECK constraint — mirror the existing migration `supabase/migrations/20260930003100_implementation_execution_observed_receipt_type.sql` exactly (same shape, new value). This file is NOT on CLAUDE.md's DVN-protected list — safe to extend.

4. **Ingestion route** — smallest existing-surface option per the spec ("smallest existing-surface route/UI"). Two reasonable choices, pick whichever has less surface area once you look at the current `ImplementationLayout.tsx` state shape:
   - (a) A new route `app/api/constitutional/execution-return/route.ts` (POST) that validates the body against `ExecutionReturn`, calls `verifyPackExists()` (refuse with 400/`pack-not-found` if it fails — this is the "wrong/stale pack return is refused" canary), calls `recordExecutionReturn()`, and returns `{ ok: true, receiptId }`.
   - (b) A UI affordance on `ImplementationLayout.tsx` (a "Paste Execution Return" textarea + submit button, visually adjacent to the existing "Copy pack" button) that POSTs to the route in (a). This is what makes it operator-usable, not just API-reachable — the spec says "smallest existing-surface route/UI", implying both are wanted, not either/or. Reuse the existing `pack`/`session` state already in scope in that component; do not build a new page.

5. **State transition** — per the spec §"State transition": this work MAY define the missing `implementation → consequence_validation`-adjacent gate (spec calls it "implementation-complete → Validation-ready"), gated strictly on a successfully accepted Execution Return for the session's current `packId`. Do NOT make `Generate Implementation Pack` leave the Implementation stage on its own (spec: "must continue to remain in Implementation"). Find the current stage-transition logic in `DevCommandCenterTab.tsx` (search for where `DevLoopStage` transitions from `'implementation'` — likely near the same area as the `session.generatedPack.id` read at ~line 1041) and add a narrowly-scoped transition function, e.g. `canEnterValidation(session)` returning true only when an accepted Execution Return's `packId` matches `session.generatedPack.id`. This is additive logic, not a rewrite of the existing stage machine.

6. **`packMarkdown()` in `CapabilityPipelineTab.tsx`** — the two content additions named in §3 above (print `pack.id`; add the forward-looking Execution Return instruction footer, listing the exact fields expected, formatted so a human/Claude Code session can produce a matching JSON block to paste back).

7. **Acceptance canaries to test explicitly** (mirror spec wording as test names in a new `tests/homecoming-phase-ii-wpb-execution-return.test.ts`):
   - Copy/manual handoff never dispatches a paid provider (structural: the new route/button never calls `/api/dev-command-center/implement` or any repository_dispatch code path).
   - A submitted `packId` that does not correspond to any `implementation_pack_generated` receipt is refused (behavioral test with a fake/mocked Supabase client, following the `vi.mock`-based convention in `tests/knyts-bridge-cross-persona-attribution.test.ts`).
   - A valid Execution Return is accepted, persisted with the external actor's identity intact (never attributed to "DevOn"), and does not by itself authorize deployment (no `deployment_authorized` receipt is ever written by this path).
   - The existing autonomous "Dispatch to Claude" code path is untouched (diff-based or structural check that `ImplementationLayout.tsx`'s dispatch button block is byte-identical / still calls the same route).

---

## 5. Final report — still to produce (task #215)

Once WP-A and WP-B are coded and tested, compose the final report the spec requires (§"Final report required") covering: exact files changed; reused vs. newly added; Aletheon capability census (LIVE: specialist-routing entry + chat invocation, invariant-grounded reasoning, email draft, Experience Guide update; PARTIAL: CRM cohort scenario — resolver exists but not tool-wired to any agent; MISSING: delegate-scoped memory store, `delegation_grants` row, merge/deploy authority — intentionally not granted); bounded delegation scopes (none minted this pass — flag as the actual remaining gap before Aletheon can act with any authority beyond conversational grounding); proof snippets for each Gate 0/WP-A/WP-B acceptance canary; regression counts (baseline was **17 failed test files / 40 failed tests, 675 TypeScript errors** — established and reconfirmed unchanged multiple times earlier this session; re-run full suite + `tsc --noEmit` before reporting and compare against this baseline, not zero); unresolved gaps (stale `docs/platform-ontology.md`, no `delegation_grants` row for Aletheon, no agent-tool-calling registry for CRM/campaign functions, `agent_persona.delegation_scopes` dead code platform-wide).

**Do not push or merge without explicit operator authorization** — stop after the final report per the spec's closing instruction, exactly as this session has done throughout (all commits this session stayed local/branch-only until an explicit "push" instruction was given for the prior KNYTS Bridge work).
