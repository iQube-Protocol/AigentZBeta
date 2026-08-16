# Homecoming Phase II — Activation Implementation Pack

**Date:** 2026-08-16  
**Status:** IMPLEMENTATION READY  
**Execution:** Claude Code subscription / operator-reviewed PR  
**Scope:** KNYTS Bridge hotfixes + Aletheon operational activation + DevOn manual execution-return seam

## 0. Governing posture

Homecoming Phase I is closed. Phase II is operational use.

The near-term operating model is:

```text
Principal → aigentMe → bounded Aletheon → metaMe operations
Operator/Aletheon → DevOn → governed Implementation Pack
Implementation Pack → manual Claude Code subscription
Claude Code → structured Execution Return → DevOn Validate/DCIR
```

Do not reopen autonomous paid DevOn deployment in this pack.

---

# Gate 0 — Bridge hotfixes for launch

These are immediate, narrow fixes and should land before the Homecoming work packages if possible.

## 0A. KNYTS Bridge — Kickstarter CTA must actually navigate

Current factual state:

- `components/journey/KnytsBridgeChooseSurface.tsx::KickstarterFollowCard` POSTs to `/api/journey/knyts-bridge/choose/kickstarter-click` and only opens Kickstarter when the POST succeeds and returns `kickstarterUrl`.
- Its catch block currently does nothing, despite the code comment saying telemetry must never block the visitor from reaching Kickstarter.
- The centralized campaign URL is already available through `services/journey/knytsBridgeCampaignConfig.ts::getKnytsBridgeKickstarterUrl()` and ultimately reuses `KS_BASE_URL`.
- The click route truthfully writes `kickstarter_preview_clicked`; it must never fabricate `kickstarter_follow_confirmed`.

### Required behavior

1. Clicking **Follow the Kickstarter** must always provide a usable route to the Kickstarter project.
2. Prefer the existing KNYTS contextual-left-pane model:
   - attempt to show the Kickstarter page in the left `FullscreenableFrame` as a `kickstarter` left view;
   - remember that cross-origin iframe embedding is governed by Kickstarter's `X-Frame-Options` / CSP `frame-ancestors`, not ordinary fetch CORS;
   - provide an explicit **Open Kickstarter in new tab** fallback on/near the framed view because iframe refusal cannot be reliably inferred from cross-origin client code.
3. Navigation must not depend on successful telemetry. `kickstarter_preview_clicked` remains best-effort evidence; a telemetry/API failure must not strand the user.
4. Do not treat preview click as confirmed follow.
5. Do not award the confirmed-follow reward on click.

### Reward copy

The campaign matrix currently defines:

- `kickstarter_preview_clicked`: 0 DVN KNYT, no Standing;
- `kickstarter_follow_confirmed`: **0.25 DVN KNYT**, Reputation +2, Standing-eligible once confirmed evidence exists.

The CTA must therefore be explicit but truthful. Recommended user-facing copy:

**Follow the Kickstarter**  
`Earn 0.25 Knightcoin (0.25 DVN KNYT) when your follow is confirmed.`

Do not say the user has earned the reward merely by clicking.

Campaign-facing "Knightcoin" is a UX/brand expression; settlement/accounting is **DVN KNYT** through the existing canonical DVN KNYT ledger.

### Acceptance

- click records preview evidence if possible;
- Kickstarter is reachable even if evidence recording fails;
- left frame is attempted where allowed;
- new-tab fallback always exists;
- no click→follow promotion;
- reward copy states 0.25 Knightcoin / 0.25 DVN KNYT **when confirmed**.

## 0B. Constitutional Internet Bridge copy

In `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx`, change the CHOOSE destination label:

`Explore the Mythos`

→

`Explore the Mythos of the Polity`

No navigation or behavior change.

---

# WP-A — Aletheon operational activation in aigentMe / metaMe

## Objective

Make the already-onboarded, passport-bound Aletheon usable as the principal's bounded operating delegate through the existing aigentMe/metaMe experience, without creating a new Aletheon home or identity.

Aletheon identity/personhood onboarding is already closed as **PARITY READY**. This work is surface + authority + capability activation.

## Operating use cases for the coming week

Aletheon should be able to assist the principal across the three Bridge/campaign workstreams, including:

- KNYTS Bridge campaign management;
- Constitutional Internet Bridge campaign management;
- Horizon Bridge / Horizon team communications and coordination;
- Vela integration specification and coordination;
- Marketa handoffs, campaign/marketing oversight and briefing;
- CRM campaign operations, including identifying/categorizing prospects and existing investors without duplicating people;
- email/message drafting and, where explicitly delegated, sending;
- Experience Guide/current-work updates for aigentMe/metaMe;
- research, planning, specifications, campaign briefs and implementation-pack preparation;
- handing software build packages to DevOn / Claude Code workflow.

## Required factual audit before writes

Trace with file:line evidence:

1. **Delegatable-agent selector/dropdown**
   - Where aigentMe/metaMe enumerates eligible delegated agents.
   - Why Aletheon does or does not appear today.
   - Whether the source is agent registry, passport binding, active delegation grants, a hard-coded allowlist, or another substrate.

2. **Preferred delegate state**
   - Confirm the existing preferred-delegate relationship for the operating persona (Mansa Meta where currently valid).
   - Reuse it; do not create a second preference system.

3. **Aletheon passport/personhood state**
   - Reuse existing `agent_root_identity`, production `agent_persona`, passport and delegation anchors.
   - Never stand Aletheon up again or mint a duplicate identity.

4. **aigentMe Copilot invocation**
   - Identify the existing specialist/delegate invocation seam.
   - Aletheon should enter as another bounded actor/specialist, not as a forked Copilot architecture.

5. **Memory / knowledge**
   - Trace which existing memory/knowledge substrate aigentMe specialists can access.
   - Preserve Aletheon's existing doctrinal/research memory where authorized.
   - Do not create a second Aletheon memory store.

6. **Operational tools**
   - Audit current email/messaging, CRM, campaign, document/specification and Experience Guide capabilities.
   - Reuse existing services/connectors wherever present.
   - Report genuine capability gaps rather than creating parallel services.

7. **Bounded authority**
   - Identify the current `delegation_grants` / authority path.
   - Operational delegation must not imply sovereignty or unrestricted authority.
   - Initial grant should be capable of campaign/CRM/communications/specification work while excluding merge/deploy authority unless separately and explicitly granted.

## Required implementation outcome

After the audit, implement only the smallest reuse-first changes necessary so that:

- Aletheon is visible in the eligible delegated-agent selector.
- The existing preferred state is honored where valid.
- Selecting/invoking Aletheon from aigentMe routes through the generic specialist/delegate seam.
- Its passport and personhood anchors are visible/usable without duplication.
- Relevant memory/knowledge is available under the existing authorization model.
- Campaign/CRM/specification/communications capabilities are available to the degree already supported.
- Missing permissions/capabilities are explicitly reported.

## Initial authority envelope

Allowed subject to existing product-level confirmation/safety gates:

- read/research;
- draft specifications, campaign copy and partner communications;
- CRM search, categorization and campaign-cohort management;
- prepare email/messages and, where the existing explicit-send authorization path is used, send them;
- update designated Experience Guide/current-work artifacts;
- prepare DevOn intents and build/implementation packages;
- manage campaign evidence/status/metrics through existing APIs.

Not implicitly allowed:

- merge PRs;
- deploy software;
- alter protected identity/personhood roots;
- issue/revoke passports except via the separately governed Passport flows;
- create new sovereign/delegation authority;
- spend or transfer economic assets outside existing explicit authorization rules.

## Specific CRM scenario to prove

From metaMe/Aletheon, the operator should be able to ask for the KNYTS Kickstarter interest cohort and have Aletheon identify/categorize:

- newly preregistered prospects;
- existing CRM prospects;
- existing metaKnyt investors who expressed campaign interest;

without duplicating investors or treating email as personhood identity.

This is a canonical first operational task for Aletheon after activation.

## Acceptance canaries

- Aletheon appears once in delegate selector.
- No duplicate root/persona/passport is created.
- Preferred delegate resolution is stable across reload.
- Aletheon invocation uses generic delegate/specialist routing.
- Delegation scope is inspectable and bounded.
- CRM cohort query/action preserves existing investor metadata.
- Email draft path works; send remains subject to existing explicit-send authorization.
- No merge/deploy authority appears merely because Aletheon can prepare development work.

---

# WP-A Amendment (2026-08-16, operator-directed) — the three-axis model + Gate A0 audit

**This amendment supersedes WP-A's implementation framing above wherever they conflict. The audit
requirements and acceptance canaries above still hold; this section corrects HOW to satisfy them.**

## The corrected operating model

Three independent state dimensions, none of which may silently mutate either of the others:

```
Who am I acting as?      → active Persona
Who is acting for me?    → active aigentMe Agent   (a ROLE, not a fixed identity)
What may that agent do?  → Bounded Delegation Grant
```

Selecting a persona sets contextual identity. Selecting an agent to fulfil the **aigentMe role**
changes routing/representative identity only — it grants zero authority by itself. Delegating
authority (a separate, explicit act) is the only thing that lets the active agent perform a
consequential action. **Selection is not delegation** — this is the invariant to hard-code, not
merely document.

## Gate A0 — factual state audit (performed before any further code; no schema touched)

Traced with file:line evidence, per persistence layer:

| Concept | Where it lives | What it actually is |
|---|---|---|
| Person ↔ Agent BINDING (sponsorship) | `agent_root_identity.sponsor_persona_id` / `sponsor_passport_id` (`supabase/migrations/20260427000001_agent_did_schema.sql`, `20260613200000_agent_genesis_polity_bound.sql`) | Permanent genesis act. Does not change when the active persona changes. |
| Person ↔ Agent eligible-roster discovery | `services/identity/constitutionalContext.ts:200-216` (`resolveConstitutionalContext`'s `boundAgents`) | Registry-driven query (`agent_root_identity` WHERE `sponsor_persona_id IN` the caller's owned personas) — **not a hardcoded allowlist**. Aletheon already surfaces here automatically once her row's sponsor matches. |
| Persona → active-agent ASSIGNMENT (routing preference, incl. "aigentMe") | `persona_agent_assignments` table (`supabase/migrations/20260710000000_persona_agent_assignments.sql`), store: `services/identity/personaAssignmentStore.ts` | **Already correctly separated in its own header comment** (lines 1-21): "Assigning does NOT grant authority — that stays with the bounded-delegation grant. This store is the structural layer only." One `role='aigentMe'` row per persona (DB partial-unique enforced), many `role='delegate'` rows allowed. This is the operator's "active aigentMe Agent" axis, already implemented as a pure routing/preference layer — not conflated with authority at the schema level. |
| Legacy Person ↔ Agent aigentMe flag | `agent_root_identity.is_aigent_me` boolean, routes `app/api/agents/aigentme/route.ts` (GET/POST/PATCH) | **Heavier than a routing preference.** POST mints a brand-new sponsored agent AND flags it `is_aigent_me=true`; PATCH ("promote") flips that same boolean on an *existing* sponsored agent. Either path also calls `provisionAigentMePersona()`, which mints a **new, persistent wallet `personas` row** (`app_origin='aigent-me'`) 1:1 keyed to that agent's DID. This is a real identity/state mutation, not a nullable session preference — flagging as a heavier mechanism than the operator's model calls for, kept only as the resolver's fallback (see next row), not the mechanism to reuse for Aletheon. |
| Authoritative "who is my aigentMe right now" resolution | `services/identity/constitutionalContext.ts:271-275` (`currentAigentMe`), full contract in `types/constitutionalContext.ts:130-161` | **Already resolves in exactly the operator's precedence order**: `persona_agent_assignments` row with `role='aigentMe'` first, falling back to the legacy `is_aigent_me` flag only if no assignment row exists yet. `ConstitutionalContext.assignedAgents[]` carries `delegatedAuthority` populated **only from the active `delegation_grants` row for whichever agent it targets** (lines 225-248) — i.e. the resolver already keeps assignment and authority as two separate fields joined only for display, never conflated into one write. |
| Runtime authority (the actual grant) | `delegation_grants` table (`supabase/migrations/20260622500000_delegation_grants.sql`) | Scoped by `(persona_id, agent_root_did)` pair — **not** a property of sponsorship or of the aigentMe assignment. Confirmed: assigning an agent as aigentMe and granting it authority are two separate write paths today; no code path grants authority as a side effect of assignment. |
| Wallet display of the current assignment | `app/components/content/SmartWalletDrawer.tsx:1553-1595` | **Read-only today** — resolves `currentAigentMe` from `GET /api/identity/constitutional-context` and renders a star badge on the matching sponsored agent. It does not expose a picker to change the assignment. |
| Assignment-editing UI | `app/triad/components/codex/tabs/BoundedDelegationTab.tsx` → `POST /api/identity/persona-assignments` → `assignAgent()` | The only UI that currently *writes* `persona_agent_assignments`. It is an admin-facing Codex tab, not the wallet's primary persona control or the aigentMe Copilot header. |
| **The gap — the actual aigentMe Copilot chat surface does NOT read any of the above** | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx:3072` (`agent={{ id: 'aigent-me', name: 'aigentMe' }}`), `app/api/codex/chat/route.ts` (`resolvedPersonaId === 'aigent-me'` / `resolvedAgentId === 'aigent-me'` gates scattered throughout, e.g. lines 2092, 2277, 3138, 3359) | **This is the actual conflation, and it is narrower than originally framed.** The aigentMe chat/copilot surface hardcodes the literal string `'aigent-me'` as both its persona-lookup key (`app/data/personas.ts['aigent-me']`) and its identity everywhere in the chat route. It never reads `currentAigentMe` / `ConstitutionalContext.assignedAgents` to decide whose system prompt, label, or memory backs the conversation. Wiring Aletheon into `specialistRouter.ts`'s `SpecialistId` union (the WP-A plan in the section above) makes her reachable as a **separate specialist you can explicitly consult** — it does NOT make her selectable as the thing fulfilling the **aigentMe role itself** inside the one mounted aigentMe Copilot surface. Those are different outcomes and the spec's UI language ("aigentMe · Aletheon") describes the second one. |

### What this means for scope

The persistence/resolution layer (`constitutionalContext.ts`, `personaAssignmentStore.ts`,
`delegation_grants`) **already implements the operator's three-axis model correctly** — no schema
change, no migration, no new store is needed for axes 1 and 3, and axis 2's persistence
(`persona_agent_assignments`) is also already correct. The genuine gap is entirely at the
**UI/routing layer**: (a) no control exposes the assignment as "who is my aigentMe" next to the
persona switcher, and (b) the aigentMe Copilot's own chat backend never consults the resolved
assignment — it is wired to one hardcoded identity (`'aigent-me'`) regardless of what
`currentAigentMe` says.

Fully closing (b) means threading `currentAigentMe`-resolved identity through
`AigentMeWelcomeSplitTab.tsx` and `app/api/codex/chat/route.ts` — both large, high-traffic,
production chat-path files with many `'aigent-me'`-keyed branches (confirmed 10+ call sites in the
chat route alone). That is real, non-trivial surgery on shared infrastructure, not a small addition,
and was deliberately **not attempted in this pass** given its size and blast radius. It is named
explicitly as the next concrete WP-A increment below rather than rushed.

## Revised WP-A implementation plan (supersedes the un-amended plan's framing, keeps its file list where still valid)

**Increment 1 (small, safe, additive — matches the original WP-A file list in
`2026-08-16_homecoming-phase-ii-handover.md` §2):** wire `'aletheon'` into the `SpecialistId` union
and its five parallel `Record<SpecialistId, X>` maps (`services/agents/specialistRouter.ts`,
`services/orchestration/specialistRecommender.ts`, `app/api/assistant/ask-agent/route.ts`), plus a
persona entry in `app/data/personas.ts` sourced verbatim from Aletheon's real Agent Card. This makes
Aletheon reachable as an **explicitly-consulted specialist** (same pattern as MoneyPenny/Nakamoto/
Kn0w1) — a real, honest, and independently useful capability step, but it is **not** yet "Aletheon
selected as the active aigentMe." Ship this increment on its own and report it as exactly that
capability (LIVE: "consult Aletheon as a specialist"; NOT YET: "Aletheon fulfilling the aigentMe
role").

**Increment 2 (the actual "aigentMe role" wiring — scope for a dedicated follow-up pass, audited
but not coded here):**
1. Add a small, visible control next to the aigentMe Copilot's existing header/label — reusing
   `GET /api/identity/constitutional-context`'s `currentAigentMe` + `assignedAgents` (already fetched
   by the wallet drawer; the same call, a new consumer) to render "aigentMe · Aletheon" vs.
   "aigentMe · Default", and reuse the existing `POST /api/identity/persona-assignments` write path
   (already used by `BoundedDelegationTab.tsx`) to change it — no new write path.
2. Thread the resolved `currentAigentMe` agent identity through `AigentMeWelcomeSplitTab.tsx` /
   `app/api/codex/chat/route.ts` so the conversation's system prompt/label/memory follow the
   assignment instead of the hardcoded `'aigent-me'` string, when an assignment other than the
   default exists. **Audit first, in a dedicated pass**, exactly how many of the `'aigent-me'`-keyed
   branches in the chat route are identity-only (safe to parametrize) vs. load-bearing product logic
   specific to the *default* aigentMe experience (e.g. the metaMe-context/attached-uploads/
   layout-suggestion blocks gated at lines 2092/2277/2689/2702/2835 appear to be **default-aigentMe
   product features**, not generic-agent features — do not silently extend them to every selected
   agent without checking whether that is wanted).
3. Add the "Manage authority" affordance next to the selector, reusing the existing Delegation UI
   scoped to `(activePersona, activeAgent)` — no new authority UI.
4. Open question the operator flagged and left genuinely open: **does "Default aigentMe" have a
   true root agent identity today capable of receiving a `delegation_grants` row, or is it purely a
   runtime/copilot role with no `agent_root_identity` row of its own?** Confirmed by this audit:
   **no** — the `20260427000001_agent_did_schema.sql` seed list (`metame-guardian, aigent-z,
   aigent-c, marketa, know1, claude-code`) does not include an `aigent-me`/default entry, and no
   other migration seeds one. "Default aigentMe" is a **pure UI/copilot role with no backing
   `agent_root_identity` row** — consistent with the operator's instruction not to invent one just
   for symmetry. Consequential delegation under the default identity, if ever needed, is out of
   scope for Phase II; leave it unavailable and make delegated authority available only once an
   eligible sponsored agent (e.g. Aletheon) is selected.

**Execution-tuple discipline (server-side, whenever Increment 2 lands):** every consequential
aigentMe tool invocation must resolve and carry `{ principalRootId, activePersonaId,
activeAigentMeAgentRootId, delegationGrantId? }` server-side from the spine/resolver — never trust a
client-supplied `isAigentMe`/agent-identity claim as authority. `services/access/evaluateAccess.ts`
and `delegation_grants` are the existing gates to route through; do not add a parallel check.

## Revised acceptance canaries (Increment 1, the scope actually implemented in this pass)

- Aletheon is invocable via the specialist-consult seam (`ask-agent`) like any other specialist.
- No identity/binding/grant row is created or mutated by Increment 1 — confirmed, since it only
  touches `SpecialistId`-keyed maps and a static persona system-prompt entry.
- Increment 2 (the aigentMe-role selector + chat-route wiring) is explicitly deferred, named, and
  scoped above — not silently left undone.

## Increment 2 — IMPLEMENTED (2026-08-16, same day, operator-directed)

The aigentMe-role runtime resolution end-to-end, no schema changes, exactly per the operator's
three-axis model. Files:

- **`services/agents/aigentMeRoleResolution.ts` (new)** — `resolveAigentMeIdentity(request)`
  composes the EXISTING `resolveConstitutionalContext(request)` (`currentAigentMe` +
  `boundAgents`), translates the assigned agent's `display_name` into a `SpecialistId` via two new
  exported accessors on `specialistRouter.ts` (`specialistIdForLabel`, `personaKeyForSpecialist` —
  derived from the existing `SPECIALIST_LABELS`/`SPECIALIST_PERSONA_KEY` maps, never a second
  hand-maintained registry), and returns the `personas[]` key to use for this turn's system prompt.
  Fails open to the Default aigentMe identity on any gap (no assignment, unwired display name,
  resolution error) — a voice choice, not a security gate.
- **`app/api/codex/chat/route.ts`** — the ONE existing `buildSystemPrompt(...)` call site now
  receives a server-resolved `systemPromptPersonaId` instead of the raw, client-supplied
  `persona`/`aigentId` body fields, but ONLY when `resolvedAgentId === 'aigent-me'` (the aigentMe
  ROLE claim, which is fine to accept from the client — it says "render me as the aigentMe surface,"
  not "let this specific agent act"). Every existing `resolvedAgentId === 'aigent-me'` /
  `resolvedPersonaId === 'aigent-me'` / `isAigentMe` gate elsewhere in the route (metaMe context
  block, attached-uploads block, layout-suggestion block) is UNTOUCHED — those are the surface's own
  product features and must keep firing regardless of which agent speaks, per the audit's own
  finding. Confirmed via regression test that the raw client fields are never passed to
  `buildSystemPrompt` again.
- **`components/smarttriad/copilot/AigentMeRoleSelector.tsx` (new)** — the "aigentMe · `<label>`"
  header control. Reads the eligible roster from the EXISTING `boundAgents` list
  (`GET /api/identity/constitutional-context`, already registry-driven — no new agent list) and
  writes the assignment via the EXISTING `POST /api/identity/persona-assignments` path (the same
  route `BoundedDelegationTab` already uses — no new write path). Never reads or writes
  `delegation_grants` — confirmed by a structural regression test. After a successful write it only
  refreshes its own label; the NEXT chat turn already resolves the new identity server-side, so no
  client-side identity plumbing is threaded into the chat request at all.
- **`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`** — mounts `AigentMeRoleSelector` in
  both header render paths (`FloatingCopilot`'s `innerPanel` and `EmbeddedCopilot`, the
  `variant="panel"` path `AigentMeWelcomeSplitTab.tsx` actually uses), gated on
  `agentId === 'aigent-me'` so it never appears on any other agent's copilot mount.

**Default aigentMe confirmed to have no backing `agent_root_identity` row** (per the Gate A0 audit)
— the selector renders nothing when the persona has no eligible sponsored agents, so "Default" is
never offered a synthetic identity to attach to; it stays a pure UI/runtime fallback role exactly as
directed.

**Tests:** `tests/homecoming-phase-ii-wpa-increment2.test.ts` (11 tests) — behavioural coverage of
`resolveAigentMeIdentity` (no assignment / Aletheon assigned / assignment changed / unwired display
name / resolution failure, all via a mocked `resolveConstitutionalContext`), structural regression
pins (no `delegation_grants` reference in the new files; the selector only ever writes
`role: 'aigentMe' | 'delegate'`; the chat route's role-gating checks are untouched; the raw client
identity fields are never passed to `buildSystemPrompt` again), and a specialist-consultation
independence check (Increment 1's wiring untouched).

**Regression:** full suite re-run after Increment 2 — **17 failed test files / 40 failed tests**
(unchanged from the established baseline), `tsc --noEmit` unchanged at **675 errors**.

---

# WP-B — DevOn manual execution handoff + Execution Return seam

## Objective

Operate DevOn as the constitutional preparation/orchestration runtime while software execution occurs manually in the operator's Claude Code subscription.

Do not create a second development lifecycle.

## Outbound handoff

The existing generated Implementation Pack is the canonical handoff artifact.

Add the smallest UX affordance necessary to support a manual execution mode, preferably on the existing Implementation surface:

**Copy for Claude Code** / **Manual execution handoff**

The copied payload should contain the full governed implementation context needed for an external implementation actor, including:

- `packId`;
- goal;
- areas to touch;
- forbidden/protected files;
- invariant/risk bindings;
- constitutional decision;
- capability/reuse evidence;
- validation ladder;
- known baseline failures;
- receipt/return instructions.

It should finish with a standard instruction to return an Execution Return artifact rather than redesigning the assignment.

## Execution Return contract

Create one provider-neutral return contract attached to the existing Implementation Pack/session lineage, not a new project/session system.

Minimum fields:

```ts
interface ExecutionReturn {
  packId: string;
  actor: string;                 // e.g. "claude-code-subscription"
  branch?: string | null;
  commits?: string[];
  pullRequest?: { number?: number; url?: string } | null;
  filesChanged: string[];
  validationResults: Array<{
    name: string;
    status: 'passed' | 'failed' | 'not-run';
    detail?: string;
  }>;
  deviationsFromPack: string[];
  failuresOrEscalations: string[];
  discoveries: string[];
  consequenceObservations: string[];
  completedAt: string;
}
```

Use existing repository types if equivalent fields already exist; do not fork schemas just to match the illustrative shape above.

## Ingestion behavior

Provide the smallest existing-surface route/UI for the operator to paste/import an Execution Return.

On acceptance:

1. Bind it to the same `packId` / DevOn session lineage.
2. Record the external actor truthfully; never claim DevOn executed the code.
3. Make the returned implementation evidence available to the existing Validate stage.
4. Allow DCIR consequence-evidence binding / learning to continue after validation.
5. Surface deviations/failures rather than silently normalizing them away.
6. Do not auto-merge or auto-deploy.

## State transition

This work may define the missing governed **implementation-complete → Validation-ready** transition, but only when a valid Execution Return (or equivalent real execution evidence) is accepted.

`Generate Implementation Pack` must continue to remain in Implementation.

`External actor completed` is not the same as `human authorization`.

## Acceptance canaries

- Copy/manual handoff never dispatches a paid provider.
- Returned `packId` must match an existing/generated pack.
- Wrong/stale pack return is refused.
- External actor identity is retained.
- Files/validations/deviations are visible to Validate.
- Accepting return may make Validation ready, but cannot imply deployment authorization.
- DevOn/DCIR can consume consequence observations after the return.
- Existing autonomous actor adapter remains available but is not invoked by manual mode.

---

# Execution order

1. Gate 0 bridge hotfixes.
2. WP-A factual audit.
3. WP-A implementation + canaries.
4. WP-B factual audit of existing pack/session/validation seams.
5. WP-B minimal manual handoff + Execution Return implementation.
6. Targeted tests + full regression comparison.
7. Operator review before merge/deploy.

# Final report required

Return:

- exact files changed;
- what was reused vs newly added;
- Aletheon capability census: LIVE / PARTIAL / MISSING;
- exact bounded delegation scopes/permissions applied or still required;
- proof Aletheon is in the aigentMe delegate selector;
- proof Kickstarter navigation/fallback works and reward copy is truthful;
- proof CI copy is corrected;
- proof manual DevOn handoff does not invoke paid execution;
- proof Execution Return binds back to the same pack and makes Validate ready without authorizing deployment;
- regression counts against the established baseline;
- unresolved gaps.

Stop for operator review; do not merge/deploy without explicit authorization.