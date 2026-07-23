# PRD-MMC-IMPL-001 — metaMe Companion Phase 2 Implementation Plan (Constitutional Observer + Context Engine)

**metaMe IRL / iQube Protocol / AgentiQ · Engineering implementation plan · Status: DESIGN — implementation plan for an already-ratified architecture (PRD-MMC-001); this plan itself requires operator ratification before code work begins, per the same docs-first, ratify-before-build discipline as PRD-FOI-001.**
**Owner:** AgentiQ Runtime stewards + Identity & Access Spine stewards + Polity Passport Bureau · **Origin:** follow-on implementation plan authored 2026-07-23, per PRD-MMC-001 §8's own final ratification-record item ("On ratification, a separate authorized implementation pass is chartered — not this PRD") and the operator's session instruction: *"All ratified along with phase 2 implementation pass."*
**Governs:** the concrete, file-level build sequence that turns PRD-MMC-001 §4 (the Observer guardrails) and §6 Phase 2 (the Constitutional Observer + Context Engine, consent-gated) into a buildable increment sequence — without re-deriving any architectural decision PRD-MMC-001 already made, and without claiming to build or verify a real browser extension in this sandbox.

**Source document (fully ratified, 2026-07-22/23 — read in full before this plan; this plan makes no independent architectural decisions, only sequencing and file-level ones):**

`codexes/packs/irl/foundation/PRD-MMC-001_metame-companion.md` — every ratification checkbox in its §8 is checked except the last ("a separate authorized implementation pass is chartered"), which is precisely what this document is.

This document is docs-only. **No code was written or modified to produce it.** No `npm`/`tsc`/`vitest` command was run — there is no `node_modules` in the authoring sandbox. Every file reference below was verified by direct read at authoring time (cited inline); nothing is paraphrased from memory or assumed present.

---

## §0 Reconciliation — what already exists, what Phase 2 adds, and the sandbox's hard limit

### 0.1 The three Phase 0/1-era files this plan extends, not replaces

1. **`types/companion.ts`** (read in full) — the existing Companion runtime contract. Its own header comment is explicit and load-bearing: *"observation fields are DELIBERATELY OMITTED here — not modelled as optional fields — so no Phase 0/1 surface can carry observation data even accidentally. Add them only in the §4-ratified Phase 2 pass."* That §4 ratification is now done (PRD-MMC-001 §8, all boxes checked 2026-07-22/23) — this plan is the pass the file's own comment names as the one authorized to add observation types.
2. **`services/companion/runtime.ts`** (read in full) — `resolveCompanionContext()` composes `personaFetch` (identity), `buildCodexUrl` (deep links), and a whitelisted `GET /api/assistant/receipts` read (feed). It is the Phase 0/1-era runtime resolver this plan's Increment 3 extends with a new, additive input source — never replaced, never forked.
3. **`app/(embed)/triad/embed/companion/page.tsx`** (read in full) — the existing minimal Companion shell: a 288px rail (identity chip + Phase 1 Timeline, read-only) beside an embedded `SmartWalletDrawer`. Both panels already use the canonical slate house style (`border-slate-800`, `bg-slate-900/40` — CLAUDE.md "Canonical Surface Styling").

### 0.2 The hard sandbox-limitation constraint — stated up front, not glossed over

**This sandbox cannot build, package, or test a real browser extension.** There is no browser here, no extension-manifest tooling, no way to load a content script into a live tab, and no way to confirm a content script actually observes a live page. This plan draws a hard line between:

- **Buildable and verifiable in this sandboxed Next.js/TypeScript environment** (what the increments below actually ship): the consent/capability-grant **data model** (types, storage shape, grant/revoke state machine — pure functions, unit-testable with `vitest` in any environment that has `node_modules`, even though *this* authoring sandbox cannot run them); the **server-side API routes** that back a consent UI (spine-authenticated, T0/T1-disciplined); the Context Engine's **input contract** (the shape of a "browser context" observation object and exactly how it composes with the existing IRE, `services/invariants/resolution.ts`); a **canary test suite** for all of the above, mirroring `tests/companion-runtime.test.ts`'s shape; and a **UI component for capability-grant management** rendered inside the existing Companion embed shell, which can later be driven by a real extension's content script but is itself buildable and code-reviewable now, independent of any extension existing.
- **NOT buildable or verifiable here — flagged as requiring a separate, later, environment-specific pass**: the actual browser-extension `manifest.json`, content scripts, background/service worker, any real DOM/tab reading, and any claim that sandboxed code constitutes "a working browser extension." **No increment in this plan claims to ship, test, or verify a real extension.** Every increment below produces code and types that model what an extension would eventually call into — never the extension itself.

This is not a minor caveat — it is the single most important scoping fact in this plan. A future builder reading this document must not conclude that Increment 1–5 "is" the Observer; it is the **substrate the Observer would be built on top of**, entirely testable without a browser, plus a management UI whose true driver (a live content script) does not exist yet.

### 0.3 Real file-state facts verified for this plan (not assumed)

1. **`services/invariants/resolution.ts`** (287 lines, read in full; CFS-037/PRD-IRE-001, ratified 2026-07-17) — `resolveConstitutionalField(intentText: string, extra?: Partial<GroundingContext>): Promise<ResolvedConstitutionalField>` is the IRE's one entry point. Five phases: Qualify (keyword `extractField` over `intentText`) → Resolve (universal proxy-namespace pass) → Expand (`computeFieldSnapshot` over `extra.domains` or the empty-perception fallback) → Calibrate (structural coordinates only; `constitutional: null` until CCR) → Assemble. **No existing "observation" or "browser" parameter exists anywhere in this file today.** Confirms the PRD's own §0.4 framing exactly: Phase 2's Context Engine feeds this SAME function a new `extra: Partial<GroundingContext>` derived from observed browser context — it does not touch the function signature, the five phases, or the coordinate calibration logic.
2. **`services/invariants/grounding.ts`** (read: header + `GroundingContext` interface, lines 1–52) — the exact shape the IRE's `extra` parameter accepts: `{ domains?: string[]; ontologyClassIds?: string[]; namespaces?: InvariantNamespace[]; statuses?: InvariantStatus[]; limit?: number }`. This is the **entire surface** a browser-context input has to target — a Phase 2 observation cannot invent new IRE parameters; it can only populate `domains` (and optionally `ontologyClassIds`) from whatever it observed, exactly like any other caller of `resolveConstitutionalField`.
3. **`services/access/evaluateAccess.ts`** (read: header + lines 1–80) and **`services/identity/getActivePersona.ts`** (read: header + lines 1–80) — both confirmed as the PARAMOUNT-protected spine files named in CLAUDE.md's "Identity & Access Spine" section and PRD-MMC-001 §4.4/§7. **Neither is modified by any increment in this plan.** Every server route this plan adds calls `getActivePersona(request)` for identity resolution exactly as every other spine-aware route does — composition, never a parallel resolver.
4. **`supabase/migrations/20260710000000_persona_agent_assignments.sql`** (read in full) — the concrete, citable RLS pattern this plan's grant-storage sketch mirrors: `persona_id UUID NOT NULL REFERENCES public.personas(id)` (T0, server-only column), `ENABLE ROW LEVEL SECURITY`, a `_owner_read` policy (`auth.role() = 'service_role' OR persona_id IN (SELECT id FROM personas WHERE auth_profile_id = auth.uid())`), and a `_service_write` policy (service-role only, all writes go through the spine-guarded API route, never direct client writes). Increment 2's grant table (§2) follows this exact shape — not a new RLS design.
5. **`tests/companion-runtime.test.ts`** (216 lines, read in full) — the existing canary for `types/companion.ts` / `services/companion/runtime.ts`. It (a) greps the *source text* of `types/companion.ts` for absent T0 field declarations and absent browser-observation field declarations (`currentTab`, `pageDocument`, `browsingHistory`, `clipboard`), and (b) exercises `resolveCompanionContext`'s fail-closed behaviour. **This test's grep-for-absence checks are the reason Increment 1 below adds a NEW sibling type file rather than editing `types/companion.ts` in place** — editing that file to add the very fields this canary asserts are absent would require rewriting an existing, ratified canary as part of a docs-only pass, which this plan does not do. A sibling file keeps `types/companion.ts` and its existing canary intact and correct, and gives Phase 2 its own type module with its own future canary (Increment 5).
6. **`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`** (skimmed: header + prop interface, lines 1–60) and **`app/components/content/SmartWalletDrawer.tsx`** (skimmed: header + imports, lines 1–60) — confirmed as the two components PRD-MMC-001 §0.2/§0.3 names as reused "line-for-line." **No increment in this plan proposes modifying either file.** The Observer's "offers" (PRD component 3) render as SmartTriad copilot suggestions in a future presentation-surface pass; this plan's UI work (Increment 4) is scoped to the grant-management surface only, not to SmartTriad's offer-rendering — extending SmartTriad's offer surface to observation-sourced suggestions is out of scope (§4) because it depends on a real extension existing to originate an offer in the first place.

### 0.4 Where the Observer UI mounts — the file-reading-grounded decision

**Decision: the capability-grant management UI mounts inside the EXISTING `/triad/embed/companion` shell (`app/(embed)/triad/embed/companion/page.tsx`), as a new rail section, not a new host page.**

Grounds for this call, from the actual file read (§0.1 item 3): the shell already has (a) a working identity resolution path (`useCodexEmbedAuthBridge` → `resolveCompanionContext` → T1 identity), (b) a rail column that already renders one read-only list (the Timeline) using the exact slate-house-style card pattern (`rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2`) a grant list would reuse verbatim, and (c) `CompanionSurfaceKind` already names `'web-embed'` as the Phase 0/1 surface and `'extension-sidebar'` / `'extension-overlay'` as the Phase 2+ surfaces that do not exist as buildable code in this sandbox (§0.2). Since the real extension surface cannot be built or tested here, but the consent data model and API very much can be, hosting the grant-management UI in the **surface that already exists and already resolves identity correctly** is the only choice that produces something reviewable in this pass. When a real extension-sidebar surface is eventually built (a separate, environment-specific pass), it re-renders the same grant-management component against the same API routes — the UI component itself is written surface-agnostic (a plain React component taking `personaIdHint` and callbacks) precisely so it is not rebuilt for that later pass.

---

## §1 Purpose and scope

This plan turns PRD-MMC-001 §4 (the Observer guardrails: per-capability consent, revocation, T0-never-leaves, "observed never asserted") and §6 Phase 2 (the Constitutional Observer + Context Engine) into a concrete, file-level, buildable-in-this-sandbox increment sequence.

**In scope:**

- Increment 1 — the capability-grant data model (types, grant/revoke state machine) as a new sibling type module.
- Increment 2 — server-side consent/grant API routes (grant, revoke, list), spine-authenticated.
- Increment 3 — the Context Engine input contract: the shape of a browser-context observation object and its composition into the existing IRE's `GroundingContext`.
- Increment 4 — the capability-grant management UI, mounted inside the existing Companion embed shell.
- Increment 5 — canary tests for Increments 1–4.

**Explicitly out of scope for this plan** (PRD-MMC-001's own words, not this plan's invention):

- **Phase 3** (Constitutional Overlay + Universal Search + Notifications, PRD-MMC-001 §6) — not chartered here.
- **Phase 4** (additional presentation surfaces — mobile/desktop/VS Code/widget, §6) — not chartered here.
- **The actual browser-extension manifest, content scripts, and background/service worker** — cannot be built or verified in this sandbox (§0.2); flagged as a separate, environment-specific pass, not silently deferred without naming it.
- **Any real live-DOM / live-tab observation** — no increment below reads an actual browser tab; Increment 3 defines the *shape* an observation object must have, not a mechanism that produces one.
- **SmartTriad's offer-rendering surface for observation-sourced suggestions** (PRD component 3's "offers... exactly like SmartTriad today, except globally") — depends on a real observation source existing to originate an offer; not chartered here (§0.3 item 6).
- **Modifying `services/access/evaluateAccess.ts`, `services/identity/getActivePersona.ts`, `types/companion.ts`, `services/invariants/resolution.ts`'s five-phase logic, `SmartTriadCopilotLayer.tsx`, or `SmartWalletDrawer.tsx`** — every increment composes with these, none modifies them.

---

## §2 Increment-by-increment plan

### Increment 1 — Capability-grant data model + types

**Goal:** A typed, revocable grant state machine for the §4.1 capability table (identity-only baseline / current-tab / selection / page-document / downloads / clipboard / notifications / history), as pure types + pure functions — zero I/O, zero React, zero server dependency.

**Files touched:**

| File | New or modified | What it contains |
|---|---|---|
| `types/companionObserver.ts` (**new file**) | New | `ObserverCapability` union (`'current-tab' \| 'selection' \| 'page-document' \| 'downloads' \| 'clipboard' \| 'notifications' \| 'history'` — identity-only is the always-on baseline per §4.1 and is NOT a member of this union, mirroring how the PRD's own table marks it "n/a (baseline)"); `ObserverCapabilityScope` (`'global' \| 'site'` — only `current-tab` and `page-document` support `'site'` scope per the PRD §4.1 table's "per-site + global" / "per-site" annotations; every other capability is global-only, enforced by a `SCOPE_SUPPORT` lookup, not by convention); `ObserverCapabilityGrant` interface (`capability`, `scope`, `siteDomain?: string`, `grantedAt: string`, `revokedAt?: string`); `ObserverGrantState` (a `Record<ObserverCapability, ObserverCapabilityGrant[]>`-shaped map, empty array = never granted, matching `types/companion.ts`'s own "deliberately absent, not merely optional" discipline — an ungranted capability is represented by an EMPTY array, never a `false` boolean, so a Phase-1-only build of this file trivially satisfies "nothing granted" with no special-casing). **Module header states explicitly, per CLAUDE.md tier discipline**: this file may be serialised to a browser surface (it is the T1/T2 grant-state shape a client renders), so the same five-forbidden-T0-fields rule as `types/companion.ts` applies verbatim — no `personaId` field anywhere in this file. |
| `services/companion/observerConsent.ts` (**new file**) | New | Pure state-machine functions operating on `ObserverGrantState`: `grantCapability(state, capability, scope, siteDomain?): ObserverGrantState` (idempotent — granting an already-granted, unrevoked capability+scope returns the state unchanged, matching the T2-safe-commitment idempotency discipline CLAUDE.md's HMS section establishes for a different identifier class but the same principle: same input, same result, no duplicate grant rows); `revokeCapability(state, capability, scope, siteDomain?): ObserverGrantState` (marks the matching grant's `revokedAt`, never deletes the row — an audit-preserving revoke, mirroring the DVN pipeline's own "never silently drop, always record state" discipline); `isCapabilityGranted(state, capability, siteDomain?): boolean` (true only for a grant whose `revokedAt` is unset AND whose scope matches — a `'site'`-scoped grant for `example.com` does NOT grant `other.com`); `listActiveGrants(state): ObserverCapabilityGrant[]` (revoked rows excluded). All four functions are pure — no fetch, no Supabase client, no React — exactly the "canary-friendly, node-drillable" style `services/invariants/resolution.ts`'s own calibration helpers (`calibrateStructural`, `calibrateOperational`) already establish in this codebase (§0.3 item 1), reused as a design pattern, not as code. |

**What's reused vs. new:** Reused: the "deliberately absent, not optional" discipline from `types/companion.ts`'s own header; the RLS/service-write pattern from `20260710000000_persona_agent_assignments.sql` (cited for Increment 2, not this one); the pure-function/no-I/O style of `resolution.ts`'s calibration helpers. New: both files in full — this is Phase 2's genuinely new data model, per PRD-MMC-001 §0.4's own naming of "the browser-context observation source" as the honest, flagged-for-scrutiny new component.

**Verification / acceptance:**

- A parity/shape canary (Increment 5, §2 below) asserting `Object.keys(SCOPE_SUPPORT)` covers exactly the 7 `ObserverCapability` values, and that only `current-tab`/`page-document` allow `'site'` scope — locking the §4.1 table's own scope column against silent drift, per `inv.engineering.036/037`.
- Unit tests (Increment 5) exercising `grantCapability`/`revokeCapability`/`isCapabilityGranted` idempotency and revoke-preserves-history behaviour — all runnable with plain `vitest`, no Supabase, no network; genuinely buildable and testable in any environment with `node_modules`, including a later CI pass, even though this authoring sandbox cannot execute them itself.

**Explicit non-goals for Increment 1:**

- No server route, no Supabase table, no React component — those are Increments 2–4.
- No change to `types/companion.ts` — this is a sibling file (§0.1 item 5, §0.3 item 5).
- No `personaId` or any T0 field anywhere in either file.

**Dependencies:** none — buildable immediately, independent of Increments 2–4.

---

### Increment 2 — Server-side consent/grant API routes

**Goal:** Spine-authenticated routes to grant, revoke, and list a persona's active Observer capability grants, backed by a new persona-scoped table following the exact RLS shape `persona_agent_assignments` already establishes.

**Depends on:** Increment 1 (the `ObserverCapability`/`ObserverCapabilityGrant` types).

**Files touched:**

| File | New or modified | What it contains |
|---|---|---|
| `app/api/companion/observer/grants/route.ts` (**new file**) | New | `GET` — calls `getActivePersona(request)` (existing spine resolver, unmodified), reads the caller's active grants, returns a T1-safe JSON array of `ObserverCapabilityGrant`-shaped rows (capability/scope/siteDomain/grantedAt/revokedAt — **no `personaId` in the response body**, exactly the discipline `GET /api/wallet/active-persona` already applies). `POST` — body `{ capability, scope, siteDomain? }`, validates `scope` against Increment 1's `SCOPE_SUPPORT` lookup (a `'site'` scope request for a global-only capability is rejected with 400, not silently coerced), calls `grantCapability` (Increment 1, pure) over the current DB-read state, persists the new row, returns the updated grant. Fails closed: no `getActivePersona` resolution ⇒ 401, no grant read/write attempted. |
| `app/api/companion/observer/grants/[capability]/route.ts` (**new file**) | New | `DELETE` — same spine authentication; calls `revokeCapability` (Increment 1) and persists the `revokedAt` timestamp on the matching row(s) (scoped by an optional `?site=` query param for per-site grants). Never deletes the row — audit-preserving, per Increment 1's own revoke semantics. |
| `supabase/migrations/<TBD-timestamp>_companion_observer_grants.sql` (**new file, illustrative sketch only — not a migration to run in this pass**) | New (deferred) | Sketch, for the eventual builder, of the table this plan's routes read/write: `companion_observer_grants(id UUID PK, persona_id UUID NOT NULL REFERENCES personas(id) — T0 server-only column, capability TEXT NOT NULL, scope TEXT NOT NULL CHECK (scope IN ('global','site')), site_domain TEXT NULL, granted_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ NULL)`, RLS mirroring `20260710000000_persona_agent_assignments.sql` verbatim (`_owner_read`: `auth.role() = 'service_role' OR persona_id IN (SELECT id FROM personas WHERE auth_profile_id = auth.uid())`; `_service_write`: service-role only — no direct client writes, all writes go through the two API routes above). **This SQL is NOT presented as ready-to-run** — per this plan's own docs-only scope, no migration ships in this pass; the builder of Increment 2 writes the real migration file (with a real timestamp) and runs it, following this sketch's shape, not inventing a new RLS design. |

**What's reused vs. new:** Reused: `getActivePersona` (unmodified — composition only), the `persona_agent_assignments` RLS pattern (mirrored, not re-derived), Increment 1's pure grant-state functions (the routes are a thin persistence + spine-auth shell around them, never reimplementing the state machine inline). New: both route files, the table sketch.

**Verification / acceptance:**

- A canary mirroring `tests/companion-runtime.test.ts`'s shape (Increment 5): mock `getActivePersona` to return `null` (unauthenticated) and assert both routes return 401 with no DB call attempted (fail-closed, same pattern `resolveCompanionContext` already proves for the client-side resolver).
- A canary asserting the route's JSON response body contains no `personaId`/`authProfileId`/`rootDid` key anywhere (the same `collectKeys()` helper pattern `tests/companion-runtime.test.ts` already implements, reused verbatim as a test utility, not reinvented).
- Manual review (no live DB in this sandbox): confirm the route's Supabase query is `.eq('persona_id', ctx.personaId)` scoped, mirroring every other spine-authenticated persona-scoped read in the codebase — never a raw, unscoped table read.

**Explicit non-goals for Increment 2:**

- The actual migration is NOT run in this pass — no `node_modules`, no live Supabase connection in this sandbox, and this plan is docs-only per its own scope.
- No change to `getActivePersona.ts` or `evaluateAccess.ts` — grants are read/written directly by these two new routes using the existing resolver's output, never a new gate function.
- No client-side code in this increment — that is Increment 4.

**Dependencies:** Increment 1.

---

### Increment 3 — Context Engine input contract (composes into the existing IRE, does not extend it)

**Goal:** Define the exact shape of a "browser context" observation object and the pure function that turns it into the `Partial<GroundingContext>` the existing `resolveConstitutionalField()` already accepts — feeding the SAME engine a new input source, per PRD-MMC-001 §0.4's own framing, never a second grounding engine.

**Depends on:** Increment 1 (an observation object is only ever populated for a capability that is actually granted — `isCapabilityGranted` gates what a caller is allowed to construct).

**Files touched:**

| File | New or modified | What it contains |
|---|---|---|
| `types/companionObserver.ts` | Modified (additive, same file as Increment 1) | ADD `BrowserContextObservation` interface: `{ grantedCapabilities: ObserverCapability[]; currentTabDomain?: string; currentTabTitle?: string; selectionText?: string; pageDocumentExcerpt?: string; observedAt: string }`. Every optional field is populated **only** when its corresponding capability is present (and unrevoked) in `grantedCapabilities` — the type does not enforce this at the type level (TypeScript cannot express "field X iff Y is in array Z"), so **the constructing code is the enforcement point**, named explicitly in the next row. `pageDocumentExcerpt` is capped at a small fixed length (e.g. 2,000 chars) in the type's own doc comment as the minimum-disclosure discipline PRD-MMC-001 §0.9/§4.2 requires — this is a full-page *excerpt* for grounding, never the full raw DOM. |
| `services/companion/observerContext.ts` (**new file**) | New | `assertObservationRespectsGrants(observation: BrowserContextObservation, state: ObserverGrantState): void` — throws if any populated field's capability is not `isCapabilityGranted` in `state` (Increment 1); this is the runtime enforcement point the type system cannot provide, and it is the single choke point every caller must pass through before an observation is used for anything. `toGroundingContext(observation: BrowserContextObservation): Partial<GroundingContext>` — a pure mapping function targeting the **exact, verified** `GroundingContext` shape from `services/invariants/grounding.ts` (§0.3 item 2): maps `currentTabDomain` (when present) into a single-element `domains` array (e.g. `{ domains: [observation.currentTabDomain] }`), and returns `{}` when no domain signal exists — deliberately NOT inventing new `GroundingContext` fields, since the IRE's own file confirms that interface's shape is closed today. `buildObserverIntentText(observation, userTypedIntent?: string): string` — composes the text `resolveConstitutionalField`'s first parameter needs, preferring an explicit user-typed intent when present (an Observer *offer* is always human-initiated per PRD §4.2 "observed, never asserted" — it never auto-resolves on passive observation alone) and falling back to a synthesized string from `currentTabTitle`/`selectionText` only when the human has clicked "help me with this" or equivalent — this function does not decide *when* to call the IRE, only *what text* to pass once a human has asked. |

**The composition this increment locks down, stated explicitly:** `resolveConstitutionalField(buildObserverIntentText(observation, userIntent), toGroundingContext(observation))` — this is a call to the **existing, unmodified** `resolveConstitutionalField` (`services/invariants/resolution.ts`) with browser-derived arguments, not a new function that reimplements any of its five phases. No increment in this plan touches `resolution.ts`, `grounding.ts`, or any of the IRE's internals.

**What's reused vs. new:** Reused: `resolveConstitutionalField`'s full signature and five-phase behaviour (§0.3 item 1), `GroundingContext`'s exact shape (§0.3 item 2) — both cited and composed against, neither modified. New: `BrowserContextObservation`, `assertObservationRespectsGrants`, `toGroundingContext`, `buildObserverIntentText`.

**Verification / acceptance:**

- A canary (Increment 5) asserting `toGroundingContext` never emits a key outside `GroundingContext`'s own five fields (`domains`/`ontologyClassIds`/`namespaces`/`statuses`/`limit`) — a structural type-shape canary that would fail loudly if a future edit tried to smuggle a new field into the IRE's input via this seam.
- A canary asserting `assertObservationRespectsGrants` throws when a `pageDocumentExcerpt` is populated but `'page-document'` is absent from `grantedCapabilities` (and passes when it is present) — the consent-enforcement choke point, tested in isolation from any real browser.
- A canary asserting `buildObserverIntentText` never returns a non-empty string from `currentTabTitle`/`selectionText` alone when no `userIntent` is supplied — locking "observed, never asserted": the Context Engine never self-triggers a resolution from passive observation alone.

**Explicit non-goals for Increment 3:**

- No modification to `services/invariants/resolution.ts` or `services/invariants/grounding.ts` — composition only.
- No real observation source — `BrowserContextObservation` is a shape a future extension's content script would need to populate; nothing in this increment produces a live instance from an actual page (§0.2).
- No wiring into any UI or copilot surface — that is explicitly deferred (§4) since it depends on an observation source existing.

**Dependencies:** Increment 1.

---

### Increment 4 — Capability-grant management UI

**Goal:** A surface-agnostic React component rendering the §4.1 capability table as a live grant/revoke UI, mounted inside the existing `/triad/embed/companion` shell (§0.4's decision) — reading/writing via Increment 2's routes, never a direct Supabase call from the client.

**Depends on:** Increment 1 (types), Increment 2 (the routes it calls).

**Files touched:**

| File | New or modified | What it contains |
|---|---|---|
| `components/companion/ObserverGrantPanel.tsx` (**new file**) | New | A presentational component taking `personaIdHint: string` as its only required prop (surface-agnostic — the same component a future extension-sidebar surface would mount unchanged, per §0.4's reasoning). Renders the 7 `ObserverCapability` rows from Increment 1's union, each with a toggle + (for `current-tab`/`page-document`) a scope selector, using `personaFetch` (never raw `fetch`, per CLAUDE.md's PARAMOUNT client-spine-fetch rule) against Increment 2's `GET/POST/DELETE /api/companion/observer/grants` routes, threading `personaIdHint` on every call so all reads/writes resolve the SAME persona (the same discipline `resolveCompanionContext` already applies). Narrates state "observed, never asserted": a capability with no grant reads "Not shared" (not "Off" — avoiding any language implying a default-on baseline that isn't there), and `history`'s row carries the PRD §4.1 "most sensitive; strongest warning" copy verbatim as a visible warning string, not just a design note. Revocation is always a single click — no confirm-dialog friction beyond what `ConfirmDialog` (the existing canonical primitive, CLAUDE.md "File and Component Discipline") already provides for destructive actions, reused rather than a bespoke modal. |
| `app/(embed)/triad/embed/companion/page.tsx` | Modified (additive) | ADD a second rail section, "Observer permissions," below the existing Timeline section (§0.1 item 3's exact card style: `border-slate-800 bg-slate-900/40`), mounting `<ObserverGrantPanel personaIdHint={personaId} />` only when `identity` is non-null (mirrors the existing Timeline's own `identity ?` conditional at line ~131) — an unauthenticated visitor sees no grant UI, matching "fails closed" everywhere else on this page. No other part of the file changes: the wallet mount, the identity chip, and the Timeline list are untouched. |

**What's reused vs. new:** Reused: `personaFetch` (PARAMOUNT), the existing rail's exact card styling and conditional-render pattern, `ConfirmDialog` (existing primitive) for the revoke action. New: `ObserverGrantPanel.tsx`, the one additive rail section in `page.tsx`.

**Verification / acceptance:**

- Manual review only (no `node_modules`/browser in this sandbox to render it): confirm `ObserverGrantPanel.tsx` imports `personaFetch` and never a raw `fetch` or `authedFetchHeaders` — the exact grep pattern `tests/persona-spine-fetch.test.ts` already enforces codebase-wide, so this file passes that existing canary without a new one being written for it.
- Manual review: confirm the component takes no `personaId` prop that gets rendered into the DOM as text or attribute (T1 hint only, never displayed as a raw identifier) — mirroring the identity chip's own existing pattern of showing `displayLabel`, never the raw persona UUID.

**Explicit non-goals for Increment 4:**

- No extension-sidebar or extension-overlay surface — `ObserverGrantPanel` is written surface-agnostic, but no extension shell exists in this pass to host it a second time (§0.2).
- No SmartTriad copilot integration, no "offers" UI (PRD component 3's suggestion surface) — that depends on Increment 3's `BrowserContextObservation` having a real producer, which does not exist yet.
- No visual design pass beyond matching the existing shell's established slate house style — no new design system introduced.

**Dependencies:** Increments 1, 2.

---

### Increment 5 — Canary tests for Increments 1–4

**Goal:** Lock every T0-absence, consent-enforcement, and IRE-composition guarantee above with tests mirroring `tests/companion-runtime.test.ts`'s exact shape and rigor, so a future edit cannot silently regress any of them.

**Depends on:** Increments 1–4 (tests the code they produce).

**Files touched:**

| File | New or modified | What it contains |
|---|---|---|
| `tests/companion-observer.test.ts` (**new file**) | New | Mirrors `tests/companion-runtime.test.ts` section-for-section: (1) a source-grep asserting `types/companionObserver.ts` declares no forbidden T0 field (`personaId`/`authProfileId`/`rootDid`/`kybeAttestation`/`fioHandle`) — the exact regex pattern from the existing canary, reused verbatim as a shared test helper rather than re-typed; (2) `grantCapability`/`revokeCapability`/`isCapabilityGranted` idempotency + revoke-preserves-history unit tests (Increment 1); (3) `SCOPE_SUPPORT` parity canary — exactly 7 capabilities, only `current-tab`/`page-document` site-scoped (Increment 1); (4) `toGroundingContext` never emits a key outside `GroundingContext`'s 5 fields, and `assertObservationRespectsGrants` throws/passes correctly (Increment 3); (5) `buildObserverIntentText` never self-triggers from passive observation alone (Increment 3); (6) the two new API routes return 401 + make no DB call when `getActivePersona` resolves null, mirroring the existing resolver's own fail-closed test (Increment 2). |
| `tests/companion-runtime.test.ts` | Not modified | Confirmed by this plan's own reasoning (§0.3 item 5) as staying exactly as-is — its grep-for-absence assertions about `types/companion.ts` remain true because Increment 1 never edits that file. |

**Verification / acceptance:** the file itself is the deliverable; "verification" is that a future CI run of `vitest tests/companion-observer.test.ts` (in an environment with `node_modules`, which this authoring sandbox lacks) passes. This plan does not claim the tests were run — only that they are written to the same pattern as an existing, passing canary in this codebase.

**Explicit non-goals for Increment 5:** no live-browser test of any kind (§0.2) — every test in this file is a pure-function or mocked-fetch unit test, exactly like its model file.

**Dependencies:** Increments 1–4.

---

## §3 Sequencing rationale

1. **Increment 1 before everything else is a hard dependency, not a preference.** Increments 2, 3, and 4 all import `ObserverCapability`/`ObserverCapabilityGrant`/`ObserverGrantState` from Increment 1's type file; none can be typed or reviewed without it existing first.
2. **Increment 2 before Increment 4** because the grant-management UI (Increment 4) calls Increment 2's routes — building the UI first would mean stubbing a fetch against routes that don't exist, and reviewing a UI that cannot be exercised even against a mock server response shape.
3. **Increment 3 is independent of Increments 2 and 4** and could in principle build in parallel with them — it only depends on Increment 1's types (to gate what an observation is allowed to carry) and on the already-existing, unmodified `resolution.ts`/`grounding.ts`. It is sequenced third here because the Context Engine's input contract is conceptually the "highest-risk, most novel" piece (PRD §0.4) and benefits from Increment 1's consent model being reviewed and stable first, so `assertObservationRespectsGrants` has a settled `ObserverGrantState` shape to enforce against.
4. **Increment 5 last, but not deferred** — every increment above names its own canary in its "Verification / acceptance" row; Increment 5 is where those individual canaries are actually written as one test file, mirroring how `tests/companion-runtime.test.ts` covers both `types/companion.ts` and `services/companion/runtime.ts` in one file rather than two.
5. **The real extension build is placed after all five increments, not interleaved, and is explicitly named as a separate pass** (§0.2, §4) — every increment above is genuinely buildable and reviewable without it existing, and forcing it into this sequence would mean this plan claims a capability (building/testing a browser extension) the authoring sandbox does not have.

---

## §4 Explicit non-goals / deferred work

- **The real browser-extension manifest, content scripts, and background/service worker** — cannot be built or tested in this sandbox (§0.2). A future, environment-specific pass (one with an actual browser + extension-packaging toolchain available) is required, and that pass's job is narrowly to produce a content script that (a) reads only what §4.1's granted capabilities allow, (b) populates `BrowserContextObservation` (Increment 3) faithfully, and (c) calls `assertObservationRespectsGrants` before using any observed value — i.e., that pass consumes this plan's contract; it does not redefine it.
- **Phase 3** (Constitutional Overlay + Universal Search + Notifications, PRD-MMC-001 §6) — not chartered here.
- **Phase 4** (mobile/desktop/VS Code/embedded-widget presentation surfaces, §6) — not chartered here.
- **SmartTriad's Observer "offers" UI** (PRD component 3's suggestion-rendering surface, e.g. "Import this FATF guidance into IRL? Extract invariants?") — depends on a real observation source (the extension pass above) existing to originate an offer from; this plan builds the substrate the offer would eventually be grounded on (Increment 3), not the offer-rendering UI itself.
- **The SessionQube's browser-context fields** (PRD component 13 — "applications visited, captured evidence, generated work") — this is PAG-001's SessionQube, extended additively per PRD-MMC-001 §0.1; wiring `BrowserContextObservation` data into that SessionQube projection is a follow-on increment for whichever session builds the PAG-001 SessionQube integration TODO already named in `types/companion.ts`'s `CompanionSessionRef` comment — not this plan.
- **Any live-DOM/live-tab verification, screenshot, or "tested in a browser" claim** — none exists anywhere in this plan; every acceptance criterion above is either a pure-function unit test, a mocked-fetch test, or a manual code-review-style check performable from source alone.
- **A real Supabase migration run** — Increment 2's table is sketched, not created; the actual migration file (with a real timestamp) and its execution are left to the builder of Increment 2, per this plan's own docs-only, no-`node_modules` scope.

---

## §5 Open engineering questions requiring a build-time decision

### 5.1 Per-site grant storage granularity — how many rows, keyed how?

Increment 1's `ObserverCapabilityGrant` allows `siteDomain` on `'site'`-scoped grants for `current-tab`/`page-document`. This plan does not resolve whether Increment 2's table stores one row per (persona, capability, site) tuple (simple, but a user granting page-document access to 50 sites accumulates 50 rows) or a single row per (persona, capability) with a `site_domains TEXT[]` array column (fewer rows, but requires array-containment RLS predicates that `20260710000000_persona_agent_assignments.sql`'s cited pattern does not need to handle). Both are correct; this is a storage-shape decision for whoever builds Increment 2, not an architecture decision this plan should force.

### 5.2 Does `history` need a distinct, stronger consent flow than the other six capabilities?

PRD-MMC-001 §4.1 marks `history` "most sensitive; strongest warning" but does not specify a mechanically different consent flow (e.g., a re-confirmation step, a cooldown before it takes effect, or a mandatory re-grant interval) versus simply a stronger warning string in the same toggle UI. Increment 4 as scoped renders `history`'s warning copy inline with the same toggle pattern as the other six. Whether `history` warrants a structurally different (not just textually different) consent mechanism is flagged for the operator to decide before Increment 4's UI is finalized — this plan does not invent a two-step confirmation flow speculatively.

### 5.3 Where does `assertObservationRespectsGrants`'s enforcement point actually run — client, server, or both?

Increment 3 places `assertObservationRespectsGrants` in `services/companion/observerContext.ts`, callable from anywhere. It does not resolve whether the real extension pass (§4) should call it client-side (in the content script, before an observation is even transmitted) as well as server-side (before any resolution call uses it) — defense in depth would suggest both, but this plan does not mandate a specific architecture for a component (the content script) it cannot build here. Flagged for the extension-pass builder.

### 5.4 Does the grant-management UI need real-time cross-tab sync?

If an operator has two browser tabs open to `/triad/embed/companion` (or, eventually, two devices), and revokes a capability in one, Increment 4 as scoped does not specify whether the other tab's `ObserverGrantPanel` reflects the change live (via polling, a Supabase realtime subscription, or a manual refresh only). This plan's minimal acceptance bar (§2, Increment 4) is satisfied by a manual-refresh-only implementation; whether a stronger guarantee is required before Phase 2 is considered "shipped" is an open question for the operator, not decided here.

---

## §6 Ratification record

**Status: RATIFIED 2026-07-23 (operator). Every increment below is authorized to begin code work.**

- [x] Operator ratifies the §0 reconciliation — that Increment 1 adds a NEW sibling type file (`types/companionObserver.ts`) rather than editing `types/companion.ts` in place, preserving `tests/companion-runtime.test.ts` unchanged and correct.
- [x] Operator ratifies the hard sandbox-limitation framing (§0.2) — that no increment in this plan builds, packages, or tests a real browser extension, and that the actual extension manifest/content-script/background-worker is explicitly deferred to a separate, environment-specific pass.
- [x] Operator ratifies §0.4's decision — the capability-grant management UI mounts inside the existing `/triad/embed/companion` shell, not a new host page, with the component itself written surface-agnostic for later reuse in an extension-sidebar surface.
- [x] Operator ratifies Increment 1's file list and scope (§2) — the `ObserverCapability`/`ObserverCapabilityGrant`/`ObserverGrantState` types and the pure grant/revoke state-machine functions.
- [x] Operator ratifies Increment 2's file list and scope (§2) — the two spine-authenticated API routes and the illustrative (not-run) migration sketch mirroring `persona_agent_assignments`'s RLS pattern.
- [x] Operator ratifies Increment 3's file list and scope (§2) — the `BrowserContextObservation` shape, the consent-enforcement choke point (`assertObservationRespectsGrants`), and the composition into the existing, unmodified `resolveConstitutionalField`/`GroundingContext`.
- [x] Operator ratifies Increment 4's file list and scope (§2) — `ObserverGrantPanel.tsx` and the one additive rail section in the existing Companion embed page.
- [x] Operator ratifies Increment 5's scope (§2) — a new sibling canary file mirroring `tests/companion-runtime.test.ts`'s shape, with `tests/companion-runtime.test.ts` itself left unmodified.
- [x] Operator ratifies the §3 sequencing rationale, in particular that the real extension build is placed after all five increments and treated as a separate, environment-specific pass rather than interleaved.
- [x] Operator has reviewed §5's four open engineering questions and **delegates each to the builder of the relevant increment** (5.1 grant-storage granularity → Increment 2 builder; 5.2 whether `history` needs a structurally stronger consent flow → Increment 4 builder, default to the plan's as-scoped single-warning-string approach unless the builder flags a reason to escalate; 5.3 client-and/or-server enforcement point for `assertObservationRespectsGrants` → the future extension-pass builder; 5.4 cross-tab live sync → Increment 4 builder, default to the plan's manual-refresh-only minimal bar) — none resolved definitively here, all explicitly delegated rather than silently deferred.
- [x] This document is cross-referenced from PRD-MMC-001's own ratification record (§8) as the "separate authorized implementation pass" it names — done in the same commit that ratifies this plan.

All boxes checked 2026-07-23. Increments 1–5 are authorized to begin, in the dependency order §3 specifies (1 first; 2 and 3 may proceed in parallel once 1 lands; 4 after 1+2; 5 last).

---

*Authored docs-only, 2026-07-23. Reconciles `codexes/packs/irl/foundation/PRD-MMC-001_metame-companion.md` (fully ratified 2026-07-22/23) into a Phase-2-only build sequence. Every file reference verified by direct read at authoring time: `types/companion.ts`, `services/companion/runtime.ts`, `app/(embed)/triad/embed/companion/page.tsx`, `services/invariants/resolution.ts`, `services/invariants/grounding.ts`, `services/access/evaluateAccess.ts`, `services/identity/getActivePersona.ts`, `supabase/migrations/20260710000000_persona_agent_assignments.sql`, `tests/companion-runtime.test.ts`, `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` (header/props only), `app/components/content/SmartWalletDrawer.tsx` (header/imports only). No code was written; no `npm`/`tsc`/`vitest` command was run (no `node_modules` in the authoring sandbox). This plan explicitly and repeatedly distinguishes what is buildable/verifiable in that sandbox (the consent data model, the server routes, the IRE input contract, the grant-management UI, and canary tests for all of it) from what is not (the real browser extension — manifest, content script, background worker — and any live-browser observation), per the task's own instruction not to let sandboxed code be mistaken for a working extension. Structural/tone reference: `codexes/packs/agentiq/updates/2026-07-22_prd-foi-001-implementation-plan.md`. Builds nothing; proposes a build sequence for operator ratification.*
