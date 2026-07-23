# PRD-MMC-IMPL-003 — metaMe Companion Phase 4 Implementation Plan (Movement I — Capture)

**Status: DESIGN — docs-first, ratify-before-build.** Follows the same discipline as PRD-MMC-IMPL-001 (Phase 2) and PRD-MMC-IMPL-002 (Phase 3): nothing below gets built until the Ratification Record at the end is checked off.

**Companion to:** `codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md` (DESIGN, awaiting ratification) — this plan operationalizes exactly one of its four movements: **Movement I — Capture** ("Legacy Internet → Constitutional Runtime… the user never uploads, the user constitutionalizes," SPEC §3). Movements III (Act beyond search), IV (Project), and the `myResearch` tab are explicitly NOT in scope here — SPEC-MMC-001 §11 leaves "whichever Movement(s) the operator prioritizes next" to a separate, later ratification, and the operator named Capture first.

**Origin:** operator session instruction, 2026-07-23 — "focused on flow as the priority," Movement I selected as the first increment on the builder's recommendation (Capture is the one movement nothing else in the flow can happen without — Organize/Act/Project all presuppose something has already been captured).

**Naming note (operator, 2026-07-23): Recognize → Constitute, not "upload → capture."** "Capture" is retained as the section label for continuity with SPEC-MMC-001 §3's own naming, but the plan's own increments describe two genuinely distinct things happening, not one: the browser-side right-click is a **Recognition** event — a human deciding "this matters" — and the Workspace Inbox landing is where **Constitution** actually happens: the object stops being "content on the web" and becomes an object within the runtime (identity, provenance, ledger eligibility, standing opportunity). **Capture is the interaction; constitutionalization is the operation.** This is not a cosmetic rename — §0.8 below states the invariant this distinction protects, and it is why Increment 2's ingest route (not the extension) is where a captured thing actually crosses the threshold.

---

## §0 Reconciliation — what already exists, what Capture adds, and the two real gaps that shape this plan's scope

Every fact below was verified by direct file read or grep at authoring time (2026-07-23), not assumed. This section exists because, per this repo's own established discipline (PRD-MMC-001 §0, PRD-MMC-IMPL-001/002 §0, SPEC-MMC-001 §0), a plan that doesn't first state what's real cannot be trusted to scope what's new correctly.

### 0.1 The extension has zero capture surface today — confirmed by grep, not inferred

`extension/companion-observer/manifest.json` permissions are exactly `["storage", "activeTab", "scripting", "sidePanel"]`. **`contextMenus` is not among them, and `chrome.contextMenus` appears nowhere in `background.js` or `content.js`.** Grepping the whole extension folder for "capture" or "bring into" / "bringInto" returns zero hits. SPEC-MMC-001 §0.5 already said this plainly ("Movements I, III, and IV… none of which the extension has started building") — this plan confirms the specific mechanism (context menus) that §6's signature interaction ("highlight text → right-click → 'Bring into…'") requires is entirely absent, not partially built.

The extension's existing message-passing shape (`background.js`'s `chrome.runtime.onMessage` switch over `PING` / `CHECK_GRANT` / `OBSERVATION` / `CONNECT_METAME` / `GET_CONNECTION_STATUS` / `REFRESH_GRANTS`, and `content.js`'s Promise-wrapped `chrome.runtime.sendMessage` helper) is the pattern this plan's new `CAPTURE_REQUEST` message type extends — a new case in an existing switch, not a new transport.

### 0.2 `BrowserContextObservation` is deliberately excerpt-capped and cannot carry a capture payload — a new type is required, not an extension of the existing one

`types/companionObserver.ts`'s `BrowserContextObservation` caps `pageDocumentExcerpt` at `PAGE_DOCUMENT_EXCERPT_MAX_CHARS = 2000` by explicit design ("a page EXCERPT for grounding, never the full raw DOM"). `app/api/companion/observer/observation/route.ts` persists only a single current-observation row per persona ("live browsing context, not an audit trail" — its own doc comment). Neither is fit for Capture's job: a captured object is a **durable**, potentially many-of-them, full(er)-content record — a different data shape and a different persistence model, not a bigger excerpt. This plan defines a sibling type (`types/companionCapture.ts`) and a new, additive table, mirroring exactly how PRD-MMC-IMPL-001 Increment 1 added `types/companionObserver.ts` as a sibling to `types/companion.ts` rather than editing it.

### 0.3 The real gap SPEC-MMC-001 §6 glossed over: most of its named destinations have no backing constructor

SPEC-MMC-001 §6's example ("Bring into… Workspace / Research / Venture / Story / Ledger") reads as if all five destinations are equally reachable today. Verified, they are not:

| Destination | Constructor found | Fit for a raw captured object? |
|---|---|---|
| **Intent** | `createIntentQube(input)` — `services/iqube/intentQube.ts:195` | Yes — takes `intentName`/`intentType`/`rationale`, a real match for "capture this as something to act on." |
| **Venture** | `createVentureQube(input)` — `services/venture/ventureQubeService.ts:148` | Partial — `seed` is thesis-shaped text (problemStatement/valueProposition/mission), not a raw-content field; enforces a venture-tier plan limit. A captured object can be *referenced from* a venture, not poured into its thesis fields. |
| **Research** | `POST /api/research/objects` → `upsertResearchObject`/`recordResearchObjectCreated` (`services/research/lifecycle.ts`) | Admin/steward-gated (`cartridgeFlags?.isAdmin`) — not a general-persona creation path. Routing an ordinary user's capture through this would either require a policy change (out of scope for a docs-only plan) or would silently fail/403 for non-admins. |
| **Workspace, Story, Ledger, Cartridge, Canvas** | **None found.** Targeted globs for `*storyQube*`, `*ledgerQube*`, `*cartridgeQube*`, `*canvasQube*` return nothing. | N/A |

**This plan does not invent five new Qube constructors to close that gap** — that would be exactly the "parallel creator" pattern CLAUDE.md's Core Principle forbids, and a materially bigger architectural decision than a Capture increment should make unilaterally. Instead, it takes the reading SPEC-MMC-001 §4 itself already supports: **Workspace is the membrane every incoming object passes through.** Every capture lands in ONE real, new, generic destination — a Workspace inbox — regardless of what the user eventually wants to do with it. Assigning it onward to Venture or Intent (the two destinations with a real constructor) is offered as an immediate, optional quick-action at capture time; assigning it to Research, Story, Ledger, Cartridge, or Canvas is **explicitly out of scope for this plan** and named as a follow-on architectural decision (§4 below), not silently dropped.

### 0.4 `assertObservationRespectsGrants` is the consent-enforcement pattern to mirror, not extend in place

`services/companion/observerContext.ts`'s `assertObservationRespectsGrants(observation, state): void` throws when a populated `BrowserContextObservation` field's capability isn't granted, and is called twice today — once client-side in `background.js` (pre-check) and once server-side in `observation/route.ts` (defense in depth, re-validated against the DB-stored grant state, never trusting the client's claim). Capture's payload shape differs (source kind, larger content, a URL), so this plan adds a **sibling** assertion (`assertCaptureRespectsGrants`) rather than overloading the existing one to accept two unrelated shapes — same double-call discipline (client pre-check + authoritative server re-check), same `ObserverGrantState`/`isCapabilityGranted` primitives from Increment 1 of Phase 2, no new consent model.

One immediately useful fact this reconciliation surfaces: Phase 2's `ObserverCapability` union already includes `'downloads'`, and nothing in the codebase uses it yet (grep confirms no caller checks `isCapabilityGranted(state, 'downloads', …)` anywhere). PDF capture is exactly what that capability was modeled for — this plan is its first real consumer, not a new capability type.

### 0.5 `services/content/pdfExtractionService.ts` exists and is directly reusable for PDF capture — composed, not forked

This service does full-text/page/chunk PDF extraction (used elsewhere for episode PDFs) but is not wired into Companion today. When a captured object's source is a PDF, this plan's ingest route calls this existing service server-side (given a URL or uploaded bytes) rather than asking the content script to extract PDF text client-side — the extension only needs to identify "the user is capturing a PDF" and pass the URL/bytes through.

### 0.6 Corpus Scout is a real precedent, but for a different trust model — cited, not reused directly

Corpus Scout's pipeline (`app/api/corpus-scout/candidates/route.ts` → `createCandidateSource` → steward review/approve → `ingestApprovedSource`) is admin/steward-gated and multi-step by design — a curation workflow for building the invariant corpus, not a one-click end-user action. Capture's "Pull Across" is the opposite trust model: any persona, on their own already-granted browser capabilities, moving their own observed content into their own Workspace inbox — no steward review gate, because nothing is being admitted into shared constitutional memory, only into the capturing persona's own space. The two pipelines are cited against each other here so a future reader doesn't mistake one for a template for the other.

### 0.7 The extension CAN be authored and live-tested in this environment — established precedent, not re-derived

PRD-MMC-IMPL-001 §7 (Increment 6) already established, by actually doing it, that a Manifest V3 extension can be authored and loaded into the pre-installed Chromium under `xvfb-run` + an isolated `playwright-core` install, with its background service worker confirmed live. This plan's extension-side increment (§2, Increment 4) reuses that exact recipe rather than re-deriving whether it's possible.

### 0.8 The governing invariant this plan serves, and what the extension actually is

Stated once, plainly, because it governs every increment above rather than being a property of any one of them:

> **Nothing enters the Constitutional Runtime except by an explicit act of constitutionalization.**

This is not new doctrine invented for Capture — it is the same law already implicit in `assertObservationRespectsGrants`'s fail-closed design (§0.4), in the Identity & Access Spine's "never a raw fetch, never an unauthenticated write" discipline, and in SPEC-MMC-001 §9's own "an object crossing the Threshold automatically gains provenance, constitutional identity, workspace assignment" framing. Capture is the first movement to make it operationally visible: the Workspace Inbox (Increment 3) is not a holding area or a generic "recent items" list — it is the constitutional point at which something ceases to be "content on the web" and becomes an object within the runtime. Increment 2's ingest route is where that transition actually happens (server-side, consent-re-verified, persona-scoped); the extension (Increment 4) never constitutes anything itself, it only recognizes and hands off.

That reframes what the browser extension is *for*. It is not gaining a "capture feature" the way a browser extension gains a feature. Its job is to **mediate movement between two epistemic environments** — the conventional web (abundant, unstructured, unattributed) and the constitutional runtime (governed, attributable, actionable). Every increment in this plan is in service of that mediation, not of making the extension "do more."

---

## §1 Purpose and scope

Turn SPEC-MMC-001's Movement I (§3, §6, §9 "Pull Across") into a concrete, file-level, buildable-in-this-sandbox increment sequence, with the honest scope reduction §0.3 establishes: **capture always lands in the Workspace inbox first; Intent and Venture are the only two "assign directly" quick-actions this pass builds; Research/Story/Ledger/Cartridge/Canvas destinations are named as deferred, not built.**

**In scope:**

- Increment 1 — the `CapturedObject` type + the capture consent gate (`assertCaptureRespectsGrants`), as a sibling module to `types/companionObserver.ts` / `services/companion/observerContext.ts`.
- Increment 2 — the `captured_objects` table + spine-authenticated ingest/list/assign API routes.
- Increment 3 — the Workspace inbox UI (`MyWorkspaceTab` gains an "Inbox" section) + the two quick-actions (assign to Intent / assign to Venture).
- Increment 4 — the extension's context-menu + "Pull Across" capture affordance (manifest permission, background handler, content-script capture triggers), authored AND live-tested per §0.7's established recipe.
- Increment 5 — canary tests for Increments 1–3 (server-verifiable in this sandbox) + the extension smoke-test transcript for Increment 4 (per §0.7's precedent, not claimed without running it).

**Explicitly out of scope for this plan** (named, not silently dropped):

- **Research, Story, Ledger, Cartridge, Canvas as direct capture destinations** — no backing constructor exists for four of these five (§0.3); Research's constructor exists but is admin-gated. Closing this gap is a follow-on architectural decision, not this plan's to make.
- **Movement III (Act beyond search) and Movement IV (Project)** — separate SPEC-MMC-001 movements, separately chartered per the operator's own sequencing.
- **The `myResearch` myCluster tab** — SPEC-MMC-001 §5, not this plan.
- **AI-conversation, Slack, and email capture sources** — SPEC-MMC-001 §3/§6 name these as target objects; this pass scopes the content-script capture triggers to what a generic webpage/selection/PDF context menu can reach honestly (§2 Increment 4's non-goals) — a ChatGPT/Slack/Gmail-specific DOM-scraping integration is a distinct, app-specific follow-on, not a generic "any page" capability.
- **Modifying `types/companionObserver.ts`, `services/companion/observerContext.ts`, `app/api/companion/observer/*` (existing routes), `services/iqube/{experienceQube,intentQube}.ts`, `services/venture/ventureQubeService.ts`, or `services/content/pdfExtractionService.ts`** — every increment composes with these, none modifies them.

---

## §2 Increment-by-increment plan

### Increment 1 — `CapturedObject` type + capture consent gate

**Goal:** A typed, consent-gated shape for "something pulled across from the Legacy Internet," as a sibling to Phase 2's Observer types — zero I/O, zero React.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `types/companionCapture.ts` (**new**) | New | `CaptureSourceKind` union: `'webpage' \| 'selection' \| 'pdf' \| 'image'`. (Email/GitHub-issue/Slack/AI-conversation sources are named in SPEC §3/§6 but deferred per §1's non-goals — the union is written so adding a source kind later is additive, not a breaking change.) `CapturedObject` interface: `{ sourceKind: CaptureSourceKind; sourceUrl?: string; title?: string; contentText: string; capturedAt: string }`. `CAPTURED_CONTENT_MAX_CHARS` constant (proposed: 20,000 — enough for a real article/selection/PDF-extracted-page, still bounded, still not a raw DOM/file dump; exact figure is a build-time tuning call, not an architectural one). `CapturedObjectRecord` (adds `id`, `status: 'inbox' \| 'assigned' \| 'archived'`, `assignedDestination?: 'intent' \| 'venture'`, `assignedRefId?: string` — the T1-safe shape returned to the client; **no `personaId` field**, same discipline as `types/companion.ts`/`types/companionObserver.ts`). `SOURCE_KIND_TO_CAPABILITY` lookup: `webpage`/`selection` → `'selection'` or `'page-document'` (mirrors what's actually being read); `pdf` → `'downloads'` (§0.4's unused capability, now consumed); `image` → `'page-document'` (an image capture reads page context, not a distinct browser permission). |
| `services/companion/captureConsent.ts` (**new**) | New | `assertCaptureRespectsGrants(capture: Pick<CapturedObject, 'sourceKind'>, state: ObserverGrantState, siteDomain?: string): void` — throws unless `isCapabilityGranted(state, SOURCE_KIND_TO_CAPABILITY[capture.sourceKind], siteDomain)` (reusing Increment 1 of Phase 2's `isCapabilityGranted`, imported not reimplemented). Mirrors `assertObservationRespectsGrants`'s throw-based, single-purpose shape exactly — a sibling function for a sibling type, not a generalized "check anything" gate. |

**Verification/acceptance:** a shape canary asserting `SOURCE_KIND_TO_CAPABILITY` covers exactly the 4 `CaptureSourceKind` values (locks the mapping against silent drift, `inv.engineering.036/037` style); a unit test asserting `assertCaptureRespectsGrants` throws for an ungranted capability and passes for a granted one, for each of the 4 source kinds.

**Explicit non-goals:** no server route, no table, no UI — those are Increments 2–4. No change to `types/companionObserver.ts` or `observerContext.ts`.

**Dependencies:** none (depends only on already-existing Phase 2 primitives — `ObserverCapability`, `ObserverGrantState`, `isCapabilityGranted`).

---

### Increment 2 — `captured_objects` table + ingest/list/assign routes

**Goal:** Durable, persona-scoped storage for captures, and the three spine-authenticated routes the Workspace inbox (Increment 3) and the extension (Increment 4) both call.

**Depends on:** Increment 1.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `supabase/migrations/<TBD-timestamp>_companion_captured_objects.sql` (**new, illustrative sketch — not run in this pass**) | New (deferred) | `captured_objects(id UUID PK, persona_id UUID NOT NULL REFERENCES personas(id) — T0 server-only, source_kind TEXT NOT NULL, source_url TEXT NULL, title TEXT NULL, content_text TEXT NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT now(), status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox','assigned','archived')), assigned_destination TEXT NULL CHECK (assigned_destination IN ('intent','venture')), assigned_ref_id TEXT NULL)`. RLS mirrors `20260710000000_persona_agent_assignments.sql` verbatim (`_owner_read`: service-role OR `persona_id IN (SELECT id FROM personas WHERE auth_profile_id = auth.uid())`; `_service_write`: service-role only, all writes via the routes below). Same "sketch, not a migration to run in this docs-only pass" framing PRD-MMC-IMPL-001 Increment 2 used for `companion_observer_grants`. |
| `app/api/companion/capture/route.ts` (**new**) | New | `POST` — `getActivePersona(request)` (401 if absent); body `{ capture: CapturedObject }`; loads the persona's real `ObserverGrantState` (same loader `observation/route.ts` already uses — composed, not reimplemented) and calls `assertCaptureRespectsGrants` server-side (defense in depth, never trusting a client-claimed grant, mirroring `observation/route.ts`'s own pattern exactly); truncates `contentText` to `CAPTURED_CONTENT_MAX_CHARS` if the caller somehow exceeds it (fail-safe, not fail-open); inserts a row with `status: 'inbox'`; returns the T1-safe `CapturedObjectRecord`. `GET` — lists the caller's own `captured_objects` rows (`.eq('persona_id', ctx.personaId)`-scoped, newest first), same response-body T0-absence discipline as `GET /api/companion/observer/grants`. |
| `app/api/companion/capture/[captureId]/assign/route.ts` (**new**) | New | `POST` — body `{ destination: 'intent' \| 'venture', ...destination-specific fields }`. Loads the capture row (persona-scoped, 404 if not owned), calls the EXISTING constructor: `destination: 'intent'` → `createIntentQube({ personaId, intentName: body.intentName ?? capture.title, intentType: body.intentType ?? 'capture', rationale: capture.contentText.slice(0, 500), activeCartridge: 'companion' })` (composes `services/iqube/intentQube.ts`, never forks it); `destination: 'venture'` → `createVentureQube({ personaId, name: body.name ?? capture.title, seed: { problemStatement: capture.contentText.slice(0, 1000) } })` (composes `services/venture/ventureQubeService.ts`, respecting its existing plan-tier limit — a capture-driven venture creation is NOT exempt from that limit, it is a normal call to the same function). On success, updates the capture row: `status: 'assigned'`, `assigned_destination`, `assigned_ref_id` (the new Intent/Venture's id). |

**What's reused vs. new:** Reused — `getActivePersona`, the grant-loading pattern from `observation/route.ts`, `createIntentQube`, `createVentureQube`, the `persona_agent_assignments` RLS shape. New — the table, the two route files.

**Verification/acceptance:** a fail-closed canary (mock `getActivePersona` → null, assert 401 + no DB call, mirroring every prior Companion route's own test); a canary asserting the capture route's consent re-check actually throws for an ungranted `sourceKind`→capability mapping (constructing a request that claims a PDF capture with no `'downloads'` grant, confirming rejection); a canary asserting the assign route calls the real `createIntentQube`/`createVentureQube` functions (import-presence check) rather than any parallel insert.

**Explicit non-goals:** migration not run in this pass (no live Supabase/`node_modules` in the authoring sandbox, same constraint as every prior IMPL plan); no `research`/`workspace-native`/`story`/`ledger`/`cartridge`/`canvas` destination in the assign route (§0.3, §1) — attempting one of those returns 400 "destination not yet supported," never a silent no-op.

**Dependencies:** Increment 1.

---

### Increment 3 — Workspace inbox UI

**Goal:** Render captured objects inside the existing `MyWorkspaceTab` as an "Inbox" section — the concrete UI expression of SPEC-MMC-001 §4's "Workspace is the membrane every incoming object passes through."

**Depends on:** Increments 1, 2.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `components/companion/CaptureInboxPanel.tsx` (**new**) | New | Surface-agnostic component (same discipline as `ObserverGrantPanel.tsx` — takes `personaIdHint`, uses `personaFetch`, never raw `fetch`), lists `status: 'inbox'` captures via `GET /api/companion/capture`, each row showing source-kind icon, title, a content snippet, and two quick-action buttons — "Bring into Intent" / "Bring into Venture" — that call `POST /api/companion/capture/[id]/assign` and remove the row from the inbox list on success (optimistic, matching `RuntimePanel`'s established pattern in this session's own MoneyPenny work: local state update + re-fetch, never a full-page reload). An "assigned" or "archived" capture never reappears in the inbox view — matching Content Capsule Containment's spirit (§0.2 of SPEC-MMC-001): once assigned, the object's home is the destination, not a lingering duplicate in the inbox. |
| `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` (**modified, additive**) | Modified | ADD a new "Inbox" section (own card, same slate house style as the rest of the tab) mounting `<CaptureInboxPanel personaIdHint={personaId} />` above (or beside) the existing Ideas/Drafts/Intents sections — no existing section removed or restructured. *(Exact mount point is a build-time layout call for whoever implements this increment, reading the file's current structure first — not pre-decided here since this plan's research pass did not read `MyWorkspaceTab.tsx`'s full body.)* |

**Verification/acceptance:** manual review (no `node_modules`/browser in this authoring sandbox to render it) confirming `CaptureInboxPanel.tsx` imports `personaFetch` and never raw `fetch`/`authedFetchHeaders` (the same grep pattern the persona-spine-fetch canary enforces codebase-wide); confirming the component renders no raw `personaId` as visible text.

**Explicit non-goals:** no drag-and-drop "Pull Across" animation or any Legacy-Internet-side visual — that's the extension's job (Increment 4); this increment is the Constitutional-Internet-side landing surface only.

**Dependencies:** Increments 1, 2.

---

### Increment 4 — Extension: context-menu capture + "Pull Across"

**Goal:** The actual Legacy-Internet-side trigger — SPEC-MMC-001 §6's "highlight text → right-click → 'Bring into…'" — authored AND live-tested per §0.7's established recipe, not merely written to spec.

**Depends on:** Increments 1, 2 (the routes it calls).

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `extension/companion-observer/manifest.json` | Modified (additive) | ADD `"contextMenus"` to `permissions`. No other permission added — capture reuses `activeTab`/`scripting` already granted for the Observer. |
| `extension/companion-observer/background.js` | Modified (additive) | ADD a `chrome.contextMenus.create` registration on extension install/update (mirroring the existing `chrome.runtime.onInstalled` pattern if one exists, else a new minimal one) for two menu items: "Pull Across → metaMe" (on `contexts: ['page','selection','image']`) and, when the persona has an active connection (§7.1's existing `metameAuthSession`), submenu-style destination hints are NOT built in this pass (a flat "Pull Across" landing in the Workspace inbox is the v1 UX — a destination submenu is a fast-follow once the inbox UI proves out, not invented speculatively here). ADD a `CAPTURE_REQUEST` case to the existing `chrome.runtime.onMessage` switch: builds a `CapturedObject` from the context-menu click info (`info.selectionText` for selection captures, `tab.url`/`tab.title` for page captures, `info.srcUrl` for image captures), calls `assertCaptureRespectsGrants` locally (client pre-check, same double-gate pattern as `OBSERVATION`), then POSTs to `/api/companion/capture` using the SAME `ensureFreshToken`/Bearer-token mechanism §7.1 already built for the grants/observation calls (composed, not reimplemented) — genuinely new code here is the PDF branch: when the captured page IS a PDF (checked via `tab.url` ending `.pdf` or content-type sniffing where available), the extension does NOT extract text client-side; it sends `{ sourceKind: 'pdf', sourceUrl: tab.url }` and the server-side route (Increment 2, extended here) calls `services/content/pdfExtractionService.ts` to produce `contentText` server-side (§0.5) — named explicitly as a small, additive extension of Increment 2's route rather than a silent scope-creep, since Increment 2 as originally scoped assumed the extension always supplies `contentText` directly. |
| `extension/companion-observer/content.js` | Modified (additive) | ADD a helper the background worker can request via message (`GET_SELECTION_CONTEXT` or similar) to retrieve the current page's selection text / title when a context-menu action fires without `info.selectionText` already populated (Chrome's `contextMenus` API already supplies `info.selectionText` for the `selection` context directly, so this may be a thin fallback only — exact necessity is a build-time finding, not asserted here as certainly needed). |

**Live-verification plan (per §0.7's established recipe — `xvfb-run` + isolated `playwright-core` + `/opt/pw-browsers/chromium-1194`):**
1. Load the updated extension; confirm the context menu item registers (Playwright can inspect `chrome.contextMenus` state via the background service worker's global scope, same technique §7.1 already used to confirm `ensureFreshToken` etc. exist as callable functions).
2. Drive a mocked `CAPTURE_REQUEST` message directly (bypassing the actual right-click, same limitation §7.1 named for `connectToMetaMe`'s `activeTab` user-gesture requirement) with a seeded `ObserverGrantState` lacking the `selection` grant; confirm `assertCaptureRespectsGrants` throws and no network call fires.
3. Same, with the grant present and a mocked `fetch` standing in for `/api/companion/capture`; confirm the POST body is a well-formed `CapturedObject` matching Increment 1's shape.
4. For the PDF branch: seed a `tab.url` ending `.pdf`; confirm the message sent omits `contentText` and includes `sourceKind: 'pdf'` + `sourceUrl` only (i.e., confirm the extension correctly defers extraction to the server rather than attempting its own).

**Explicit non-goals:** no destination submenu (v1 is inbox-only, per this increment's own scope note above); no email/Slack/AI-conversation/GitHub-issue-specific capture triggers (§1 non-goals) — those need app-specific DOM knowledge this generic context-menu approach doesn't have; no drag-based "Pull Across" gesture (§6's literal drag metaphor) — a right-click menu is the v1 mechanism, a drag interaction is a UX enhancement for a later pass, not required to satisfy the movement's substance; no full end-to-end run against a live, logged-in metaMe deployment (same limitation §7.1 named — no real Supabase session exists in this sandbox).

**Dependencies:** Increments 1, 2.

---

### Increment 5 — Canary tests for Increments 1–3

**Goal:** Lock the type-shape, consent-enforcement, and route fail-closed guarantees with tests mirroring `tests/companion-observer.test.ts`'s exact shape and rigor.

**Depends on:** Increments 1–3.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `tests/companion-capture.test.ts` (**new**) | New | Mirrors `tests/companion-observer.test.ts` section-for-section: (1) source-grep confirming `types/companionCapture.ts` declares no forbidden T0 field; (2) `SOURCE_KIND_TO_CAPABILITY` parity canary (exactly 4 source kinds, each mapped to a real `ObserverCapability`); (3) `assertCaptureRespectsGrants` throw/pass unit tests per source kind; (4) the two capture routes return 401 + make no DB call when `getActivePersona` resolves null; (5) the assign route imports `createIntentQube`/`createVentureQube` by name (a structural canary that would fail loudly if a future edit swapped in a parallel insert instead of the real constructors — `inv.engineering.037` style). |

**Verification/acceptance:** the file is the deliverable; a future `vitest tests/companion-capture.test.ts` run (in an environment with `node_modules`, which this authoring sandbox lacks, same caveat every prior IMPL plan states) is expected to pass.

**Dependencies:** Increments 1–3.

---

## §3 Sequencing rationale

1. **Increment 1 first, hard dependency** — Increments 2–4 all import `CaptureSourceKind`/`CapturedObject`/`assertCaptureRespectsGrants`.
2. **Increment 2 before Increments 3 and 4** — both the inbox UI and the extension call its routes; building either first means stubbing against routes that don't exist.
3. **Increment 3 and Increment 4 can proceed in parallel** once Increment 2 lands — the inbox UI doesn't depend on the extension existing (it can be exercised by seeding rows directly via the API for review), and the extension's capture POST doesn't depend on the inbox UI rendering.
4. **Increment 5 last** — mirrors PRD-MMC-IMPL-001 §3's own rationale for its Increment 5 placement.

---

## §4 Explicit non-goals / deferred work

- **Research, Story, Ledger, Cartridge, Canvas as direct capture-assign destinations** (§0.3) — no backing constructor exists for four of the five; Research's exists but is admin-gated. Closing this gap requires either (a) a new, generic "attach a captured reference to any constitutional object" primitive (a bigger, cross-cutting design decision beyond a Capture-scoped plan), or (b) five separate destination-specific decisions. Flagged for a follow-on plan, not silently dropped.
- **A destination submenu at capture time** (richer than "always lands in Workspace inbox") — a UX enhancement once the inbox-first flow is validated, not required for Movement I's substance.
- **Email, Slack, GitHub-issue, and AI-conversation-specific capture triggers** — SPEC-MMC-001 §3/§6 name these; this plan's context-menu mechanism is generic-webpage-shaped and does not attempt app-specific DOM scraping for any of them.
- **The literal drag-based "Pull Across" gesture** — a right-click context menu satisfies the movement's substance (constitutionalize, don't upload) without requiring a drag-and-drop implementation; the gesture itself is a follow-on UX pass.
- **Any change to `types/companionObserver.ts`, `services/companion/observerContext.ts`, existing `app/api/companion/observer/*` routes, `services/iqube/{experienceQube,intentQube}.ts`, `services/venture/ventureQubeService.ts`, or `services/content/pdfExtractionService.ts`** — every increment composes with these, none modifies them.
- **Any live, logged-in end-to-end run against a real metaMe deployment** — this sandbox has no real Supabase session/cookie to authenticate against (same limitation named in PRD-MMC-IMPL-001 §7/§7.1).
- **A Recognition Agent between the Workspace Inbox and Assign** (operator observation, 2026-07-23) — the natural next intelligence layer this Inbox enables: `Pull Across → Workspace Inbox → Recognition Agent → Suggested Destinations → operator confirms`, surfacing something like "this looks like evidence for your Financial Services corpus" or "this appears related to Venture Alpha" before the operator manually picks Intent/Venture. Explicitly deferred — Increment 3 as scoped ships the two manual quick-actions only, with no inference layer. Named here so the Inbox's data shape (Increment 1/2) isn't accidentally built in a way that would need reworking to host this later; no field or route in this plan should be read as ruling it out.

---

## §5 Open engineering questions requiring a build-time decision

### 5.1 `MyWorkspaceTab.tsx`'s exact mount point for the Inbox section

This plan's research pass did not read `MyWorkspaceTab.tsx`'s full body — Increment 3's builder must read it first and choose a mount point that doesn't disrupt the existing Ideas/Drafts/Intents layout, following the file's own established section pattern rather than inventing a new one.

### 5.2 Capture content-length ceiling — 20,000 chars is a proposal, not a ratified number

Increment 1 proposes `CAPTURED_CONTENT_MAX_CHARS = 20,000` as a reasonable "real document, still bounded" figure, distinct from the Observer's 2,000-char excerpt cap. This is a tuning decision for whoever builds Increment 1 to confirm or adjust, not an architectural one requiring re-ratification if changed.

### 5.3 PDF capture's failure mode when `pdfExtractionService.ts` cannot fetch/parse the URL

Increment 4's PDF branch defers extraction to the server, but this plan does not resolve what the capture route (Increment 2) does when that extraction fails (paywalled PDF, non-PDF content at a `.pdf`-suffixed URL, extraction timeout) — return a 4xx with a clear reason, or store a capture row with an empty `contentText` and a `status` flag indicating extraction failed? Flagged for Increment 2's builder to resolve using this repo's existing "never fail silently, always surface a clear reason" discipline.

### 5.4 Whether the "Bring into Venture" quick-action should bypass or respect the venture-tier plan limit

`createVentureQube` enforces an existing plan-tier venture-count limit (§0.3). This plan's position (stated in Increment 2's own row) is that a capture-driven venture creation gets NO special exemption — same limit, same function, same failure mode as any other venture creation — but this is worth the operator's explicit confirmation at ratification time since it's a user-facing failure path (`capture succeeds, "bring into venture" then fails on plan-limit`) this plan is choosing not to soften.

---

## §6 Ratification record

- [ ] Operator ratifies the §0 reconciliation — in particular that Capture's first increment scopes to Workspace-inbox-as-universal-landing-surface plus two "assign" quick-actions (Intent, Venture), with Research (admin-gated) and Story/Ledger/Cartridge/Canvas (no constructor exists) explicitly deferred rather than built with new parallel constructors.
- [ ] Operator ratifies Increment 1's scope (§2) — `CapturedObject`/`CaptureSourceKind` types and `assertCaptureRespectsGrants`, as a sibling module to the existing Observer types, reusing `ObserverCapability`'s existing (and previously unused) `'downloads'` grant for PDF capture.
- [ ] Operator ratifies Increment 2's scope (§2) — the `captured_objects` table sketch, the ingest/list route, and the assign route composing the EXISTING `createIntentQube`/`createVentureQube` constructors (never forking them), including that a capture-driven venture creation respects the existing plan-tier limit with no exemption (§5.4).
- [ ] Operator ratifies Increment 3's scope (§2) — the Workspace Inbox panel, surface-agnostic and `personaFetch`-only, mounted additively inside the existing `MyWorkspaceTab`.
- [ ] Operator ratifies Increment 4's scope (§2) — the context-menu + Pull Across extension changes, authored AND live-tested per the §0.7/PRD-MMC-IMPL-001-§7 recipe, v1 landing exclusively in the Workspace inbox (no destination submenu yet), with PDF content extraction deferred server-side to the existing `pdfExtractionService.ts`.
- [ ] Operator ratifies Increment 5's scope (§2) — a new sibling canary file mirroring `tests/companion-observer.test.ts`'s shape.
- [ ] Operator has reviewed §5's four open engineering questions and delegates each to the builder of the relevant increment (5.1 → Increment 3 builder; 5.2 → Increment 1 builder, default 20,000 unless a reason to change surfaces; 5.3 → Increment 2 builder, default to a clear 4xx over a silently-empty capture; 5.4 → confirmed no exemption, per this plan's stated position, unless the operator says otherwise here).
- [ ] This document is cross-referenced from SPEC-MMC-001's own future ratification record as "the separate authorized implementation pass" its §11 names for whichever Movement is prioritized first (Movement I, per operator instruction).
- [x] **Operator ratifies the "Recognize → Constitute" naming distinction and the governing invariant** (§0.8: "Nothing enters the Constitutional Runtime except by an explicit act of constitutionalization") as framing this plan and its siblings (Discovery, Threshold, future Projection work) operate under. — **RATIFIED 2026-07-23 (operator)**
- [x] **Operator confirms the Recognition Agent (§4) stays explicitly out of scope for this pass** — named as a natural future increment the Inbox's data shape should not preclude, not something to build now. — **RATIFIED 2026-07-23 (operator)**

---

*Authored docs-only, 2026-07-23. Reconciles `codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md` (DESIGN) into a Movement-I-only build sequence, following the exact structural and evidentiary discipline of PRD-MMC-IMPL-001/002. Every file reference verified by direct read or grep at authoring time via a dedicated research pass: `extension/companion-observer/{manifest.json,background.js,content.js}`, `types/companionObserver.ts`, `services/companion/observerContext.ts`, `app/api/companion/observer/observation/route.ts`, `services/iqube/{experienceQube,intentQube}.ts`, `services/venture/ventureQubeService.ts`, `services/research/lifecycle.ts`, `app/api/research/objects/route.ts`, `app/api/corpus-scout/candidates/route.ts`, `services/corpusScout/{provenance,ingestionBroker}.ts`, `services/content/pdfExtractionService.ts`. No code was written; no `npm`/`tsc`/`vitest` command was run. Builds nothing; proposes a build sequence for operator ratification.*

*Amended 2026-07-23, same day, on operator review: added §0.8 (the "Recognize → Constitute" naming distinction and the governing invariant "Nothing enters the Constitutional Runtime except by an explicit act of constitutionalization"), the strategic reframing of the extension as a constitutional membrane rather than a feature-gaining browser extension, and the Recognition Agent as a named-but-deferred future increment (§4). No increment's file list, scope, or dependency graph changed — this amendment is framing and one forward-looking non-goal, not new build scope.*
