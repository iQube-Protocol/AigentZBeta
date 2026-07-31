# PRD-MMC-IMPL-005 — metaMe Companion Phase 6 Implementation Plan (Movement IV — Project)

**Status: DESIGN — docs-first, ratify-before-build.** Follows the same discipline as PRD-MMC-IMPL-001/002/003/004.

**Companion to:** `codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md` (DESIGN) — operationalizes **Movement IV — Project**, the last of the four named movements: "Constitutional Runtime → Legacy Internet. The runtime projects work back into the outside world: publish an article, send an email, create a GitHub PR, respond in Slack, generate an investor update, create a calendar event, update a CRM, drive browser automation. Nothing is trapped inside metaMe." (SPEC §3)

**Origin:** operator instruction, 2026-07-23 ("Keep going!"), continuing MMC Flow after Movements I (Capture) and III (Act), both shipped this session.

---

## §0 Reconciliation — Movement IV splits cleanly into "already built, needs exposure" and "genuinely unbuilt, needs new external credentials" — and this plan only takes the first half

This is the most consequential §0 in the MMC Flow series so far, because — unlike Capture and Act, whose real gaps were both small UI additions over already-safe, already-authenticated internal seams — **half of Movement IV's named verbs require NEW external credentials and NEW connector classes**, which is a materially different risk class than anything built so far this session (mirroring exactly the caution this repo already applies to MoneyPenny's money-moving gate, CLAUDE.md's Security/Access Gates section, and the DVN Pipeline Protection rule). This section draws that line explicitly so the increments below don't blur it.

### 0.1 Already built, real external-write connectors exist today — verified, not assumed

Two registries back `POST /api/connectors/execute` (`services/google/connectors.ts`'s 12-entry `GOOGLE_CONNECTORS` map; `services/marketa/marketaConnector.ts`'s Mailjet sender). Live, non-stub destinations in `POST /api/assistant/create-artifact` (925 lines, read in full): **gmail** (draft, eager-create), **calendar** (private event eager-create, or external-invite gated behind approval), **drive** (google-doc / google-sheet / slide-outline). Per-connector approval is real and already wired: `google.gmail.send`, `google.calendar.invite-external`, and `google.drive.share-doc` all declare `requiresApproval: true`, enforced by `app/api/connectors/execute/route.ts`'s HMAC-signed `approvalToken` flow (`POST /api/assistant/approve-action` mints it). **`create a calendar event` and materializing a Doc/Sheet/Slide are therefore NOT new work — they already exist, authenticated, approval-gated, and proven in production via the exact pattern `PostApprovalDraftButton`/`ArtifactSendButton` (`components/metame/workbench/IntentChainPanel.tsx`) already uses for Gmail.** The only real gap for these is that `PostApprovalDraftButton` today only offers the Gmail-draft form — it never surfaces Calendar or Drive as sibling choices, even though the exact same `create-artifact` → `connectors/execute` pipeline already handles them.

### 0.2 Four of SPEC §3's named verbs are 100% unbuilt and require NEW external credentials — explicitly out of scope for this pass

Verified by direct search, not assumed absent:

| Verb | Status |
|---|---|
| **Create a GitHub PR** | No PR-create path anywhere. The repo's own GitHub integration (`app/api/dev-command-center/_lib/github.ts`) is explicitly read-only (its own docstring says so); the one write surface (`app/api/dev-command-center/github/merge/route.ts`) merges an existing PR, never creates one. The GitHub Actions DCC pipeline (`.github/workflows/claude-implement.yml`) is a **false cousin** — it dispatches Claude Code to implement packs via CI, unrelated to a runtime object driving a PR creation call. |
| **Respond in Slack** | No Slack integration exists. The only hit anywhere in `services/` is a UI-only `'slack'` string inside `services/intentChains/dispatcher.ts:53`'s `dispatch_hint.composer_kind` type union — a hint that a client "should render a Slack-shaped composer," never wired to any Slack Web API call. No `SLACK_*` env var is referenced anywhere in the repo. |
| **Update a CRM** | "CRM" in this codebase means exclusively the INTERNAL `services/crm/*` reputation/standing system (this session's own prior work). Zero references to an external CRM (Salesforce/HubSpot/etc.) exist anywhere. |
| **Drive browser automation** | The Companion extension (`extension/companion-observer/`, built this session for Capture) is read/observe + one-way write-to-server (Capture). It has no DOM-mutation primitive anywhere — no `.click()`, no `dispatchEvent`, no form-fill, no Playwright/CDP integration. Automation FROM the runtime OUT to drive a live page is entirely unbuilt. |

**Each of these four requires a genuinely new external-service credential (a GitHub write token with PR-create scope, a Slack bot token, a third-party CRM API key, or a browser-automation runtime) and a new connector class this repo has never had.** Per this repo's own established discipline for consequential new capability (CLAUDE.md's Security/Access Gates section: gates are never removed or added as a debugging shortcut; the DVN Pipeline Protection section: infrastructure changes need explicit operator approval before coding; and this session's own MoneyPenny P4-5/P4-6 precedent: the money-moving gate was explicitly held back for separate operator sign-off rather than built under a general "keep going") — **this plan does NOT build any of these four.** They are named, not silently dropped, and each would need its own separate charter with explicit operator authorization for the new credential/connector class before any code is written.

### 0.3 "Publish" exists, but only onto metaMe's own domain — SPEC's "outside world" framing is only half-true here too

`app/api/composition/publish/route.ts` + `services/artifact/compositionPublish.ts` (the Studio→Artifact-Runtime publish seam), `app/api/content/smart/[id]/publish/route.ts` (a real draft→`published` status transition), and `app/api/public/irl/doc/route.ts` (a genuinely public, unauthenticated content route) together mean **"publish an article" already has a real, working mechanism** — but every one of them publishes into metaMe's own content system or public API surface, never to an external platform (Medium, Substack, a public CMS). This plan does not build a third-party publish target; it is named here so a future reader doesn't conflate "publish already works" with "publish reaches the outside world" — per SPEC's own literal claim, it doesn't yet.

### 0.4 Where the new Project affordances mount

`components/metame/workbench/IntentChainPanel.tsx`'s `PostApprovalDraftButton` (read in full, prior session pass) is the existing, proven pattern: an inline form → `POST /api/assistant/create-artifact` → `ArtifactSendButton` (handles the approval-token dance when the underlying connector requires it) → done. It is scoped to `child.intentName`-matched email intents only (`isEmailIntent = /email|gmail|outreach|message|draft/i.test(child.intentName)`). This plan generalizes it into a small chooser offering the artifact types that ALREADY have live connectors — Email, Calendar event, Google Doc — reusing the exact same downstream flow for all three, never forking it per type.

---

## §1 Purpose and scope

**In scope — Increment 1:** Generalize `PostApprovalDraftButton` (renamed conceptually, not necessarily in code, to reflect its broader job) into a small "Project this" chooser offering three artifact types that already have live, authenticated, approval-gated connectors: **Draft email** (unchanged, already works), **Create calendar event** (new inline form: title/start/end — calls the existing `calendar`-destination path), **Create Google Doc** (new inline form: title only — calls the existing `drive`-destination path). All three funnel through the SAME `ArtifactSendButton`/approval-token flow already built — no new backend route, no new connector, no new external credential.

**In scope — Increment 2:** Canary tests for Increment 1.

**Explicitly out of scope for this plan** (named, not silently dropped — each needs its own future charter + explicit operator authorization for a new external credential before any code):

- **GitHub PR creation** (§0.2) — needs a GitHub write token with PR-create scope; no connector class exists.
- **Slack posting** (§0.2) — needs a Slack bot token; the one hit found is a UI-only type-literal, not an implementation.
- **External CRM updates** (§0.2) — needs a third-party CRM API credential; only the internal reputation CRM exists today.
- **Browser automation** (§0.2) — needs a fundamentally different extension architecture (DOM-mutation primitives, likely a CDP/Playwright-driven runtime); the extension is read/observe + one-way capture-write only.
- **Publishing to a third-party platform** (§0.3) — the existing publish mechanism is metaMe-domain-only; extending it outward is a separate, larger decision.
- **`marketa-cohort`-style bulk sends, Google Sheets/Slides as additional Increment-1 quick-actions** — Sheets/Slides have live connectors too (§0.1) but are deferred to keep Increment 1's form surface small; a natural Increment 3 for whoever picks this up next, not blocking this pass.
- **Any change to `app/api/connectors/execute/route.ts`, `services/google/connectors.ts`, `app/api/assistant/create-artifact/route.ts`, or `app/api/assistant/approve-action/route.ts`** — every increment composes these, none modifies them.

---

## §2 Increment-by-increment plan

### Increment 1 — Generalize the post-approval Project chooser

**Goal:** Three "Project this" quick-actions (Email/Calendar/Doc) on an approved child intent, all reusing the exact existing create-artifact → connectors/execute → approval pipeline.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `components/metame/workbench/IntentChainPanel.tsx` | Modified (additive) | `PostApprovalDraftButton`'s idle state currently renders a single "Draft email" button gated on `isEmailIntent`. ADD two sibling idle-state buttons — "Create calendar event" and "Create Google Doc" — always offered (not gated on an intent-name regex, since Calendar/Doc are generically useful, unlike the email-specific heuristic) alongside the existing email button (which keeps its own `isEmailIntent` gate unchanged — additive only, existing behavior untouched). Each opens its own minimal inline form (Calendar: title pre-filled from `child.intentName`, start/end datetime inputs; Doc: title pre-filled, no body field needed since `create-artifact`'s `google-doc` type creates an empty/templated doc) and on submit calls `POST /api/assistant/create-artifact` with `{ artifactType: 'calendar-block' \| 'google-doc', destination: 'calendar' \| 'drive', title, sourceIntentId: child.intentId, connectorInput: {...} }` — the exact same call shape `create()` already uses for Gmail, just a different `artifactType`/`connectorInput`. On success, renders the SAME `ArtifactSendButton` component already used for the email path (it already handles the approval-token dance generically via `connectorId`/`actionInput` from the response — no per-type forking needed there). |

**What's reused vs. new:** Reused — `create-artifact`'s `calendar`/`drive` destinations (unmodified), `ArtifactSendButton` (unmodified, already generic over `connectorId`), the `phase` state machine (`idle`/`form`/`creating`/`done`/`error`) `PostApprovalDraftButton` already has. New — two additional idle-state buttons + their two minimal inline forms (title+start+end for Calendar; title only for Doc) and their two `create-artifact` call variants.

**Verification/acceptance:**
- A canary (Increment 2) asserting the component still calls only `create-artifact`/`connectors/execute`/`approve-action` — no new route.
- A canary asserting the email path's existing `isEmailIntent` gate and request shape are unchanged (regression protection — this is an additive-only pass).
- Manual review: confirm `personaFetch` only, no raw `fetch`.

**Explicit non-goals:** no Sheets/Slides quick-action (deferred, §1); no change to the underlying connectors or create-artifact route.

**Dependencies:** none (composes only already-shipped, unmodified surfaces).

---

### Increment 2 — Canary tests

**Goal:** Lock the composition-not-duplication guarantee and the regression protection for the existing email path.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `tests/companion-project.test.ts` (**new**) | New | Mirrors `tests/companion-act.test.ts`'s structural-grep style: asserts the new Calendar/Doc buttons call `create-artifact` with the correct `artifactType`/`destination` pairs; asserts no new route/connector file is introduced; asserts the pre-existing `isEmailIntent` regex and Gmail call shape are byte-for-byte unchanged (regression canary); asserts `personaFetch(` only. |

**Dependencies:** Increment 1.

---

## §3 Sequencing rationale

Two increments, sequential, same small scope as PRD-MMC-IMPL-004 (Act) — no parallelism needed.

---

## §4 Explicit non-goals / deferred work

- **GitHub PR, Slack, external CRM, browser automation** (§0.2) — each needs a new external credential and connector class; flagged for separate future charters with explicit operator sign-off, never built under a general "keep going" instruction, mirroring this session's own MoneyPenny P4-5/P4-6 precedent.
- **Third-party publish target** (§0.3) — the existing publish mechanism stays metaMe-domain-only.
- **Sheets/Slides as Increment-1 quick-actions** — live connectors exist (§0.1) but deferred to keep this pass's form surface minimal.

---

## §5 Open engineering questions requiring a build-time decision

### 5.1 Should the Calendar/Doc buttons be gated by intent-name heuristics like the email button, or always offered?

This plan's default (§2 Increment 1) is "always offered" for Calendar/Doc since there's no reliable name-pattern equivalent to `isEmailIntent` for "this should become a calendar event" — but a builder may find a better heuristic (e.g. intent names containing "meeting"/"schedule"). Not an architectural decision either way.

### 5.2 Should GitHub PR / Slack / CRM / browser automation be chartered as one follow-on plan or four separate ones?

Each has a distinct credential class and risk profile (a GitHub write token is very different from a browser-automation runtime). This plan does not resolve whether they should be bundled into one "Movement IV, Phase 2" charter or four independent ones — an operator sequencing decision, not an architectural one.

---

## §6 Ratification record

- [ ] Operator ratifies §0's reconciliation — in particular that Calendar/Doc dispatch already has live, authenticated, approval-gated connectors (so Increment 1 is UI-only, no new credential), and that GitHub PR / Slack / external CRM / browser automation are explicitly OUT of scope, each requiring its own future charter and new credential before any code.
- [ ] Operator ratifies Increment 1's scope (§2) — generalizing `PostApprovalDraftButton` into a three-way Email/Calendar/Doc chooser, all reusing the existing `create-artifact` → `connectors/execute` → `approve-action` pipeline unmodified.
- [ ] Operator ratifies Increment 2's scope (§2) — a structural canary plus a regression canary for the pre-existing email path.
- [ ] Operator confirms the four deferred verbs (§0.2) stay deferred — no new external credential is provisioned or connector class started as part of this pass.

---

*Authored docs-only, 2026-07-23. Reconciles `codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md` (DESIGN) into a Movement-IV-only build sequence. Every file reference verified by direct read or grep at authoring time via a dedicated research pass: `app/api/connectors/execute/route.ts`, `app/api/assistant/create-artifact/route.ts` (read in full), `services/google/connectors.ts`, `services/marketa/marketaConnector.ts`, `app/api/dev-command-center/_lib/github.ts`, `app/api/dev-command-center/github/merge/route.ts`, `services/intentChains/dispatcher.ts`, `services/crm/*`, `services/artifact/{constitutionalPublishingSystem,publicationRegistry,compositionPublish}.ts`, `app/api/composition/publish/route.ts`, `app/api/content/smart/[id]/publish/route.ts`, `app/api/public/irl/doc/route.ts`, `extension/companion-observer/*`. No code was written; no `npm`/`tsc`/`vitest` command was run. Builds nothing; proposes a build sequence for operator ratification.*
