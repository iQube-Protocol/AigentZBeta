# SPEC-MMC-003 Phase 1 — Companion pairing gate, surface tagging, and post-install verification

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-MMC-003_mcp-assisted-companion-deployment.md` (ratified operator-directed 2026-07-25; §8 records this pass)

> **Operator action required:** the metaMe Companion extension is loaded **unpacked**. None of the `extension/companion-observer/` changes below take effect until you reload it: open `chrome://extensions`, find *metaMe Companion — Constitutional Observer*, click the reload (↻) button, then reopen the popup. A page reload alone is not enough — the background service worker and the popup document are both replaced only on extension reload.

---

## 1. What shipped

Three of SPEC-MMC-003's seven stages. The other four were deliberately not built — see §3.

### 1.1 §3.3 — Persona confirmation now gates pairing (correctness fix, not a feature)

**The defect.** `background.js`'s `connectToMetaMe()` extracted the Supabase session and the active `currentPersonaId` from the metaMe tab in one shot. If the page had no `currentPersonaId` at that moment (a visitor who never opened the wallet; an operator with several personas who never picked one), pairing **completed anyway** with a valid Bearer token and a `null` persona hint. Every subsequent server call then resolved through `getActivePersona`'s step-4 fallback — *"first owned persona, sorted"* — which for any multi-persona account is silently the **wrong** persona. The extension surfaced this only afterwards, as a `personaFound: false` warning string in the popup, by which point the bad session was already persisted in `chrome.storage.local` and the grants cache was already populated against the wrong identity. This is the exact class of failure CLAUDE.md's spine section calls *more dangerous than a 401*: it fails silently and plausibly, with real-looking data for the wrong identity.

**The fix — closed by construction, not by warning.** Confirmation is sequenced *ahead* of the action:

| Piece | Behaviour |
|---|---|
| `PROBE_ACTIVE_PERSONA` (new message) → `probeActivePersona()` | Reads the active tab's `currentPersonaId` and whether a session exists. Returns the persona id **only** — deliberately no tokens, because the popup renders the result. |
| `popup.html` | `connectBtn` ships `disabled` **in the markup** — it is never clickable before the probe answers, not merely re-disabled by script after first paint. |
| `popup.js` | Renders the persona to be paired (masked: `a1b2c3d4…9f8e`, per the three-level reference model — the raw UUID is the owner's private root identifier), plus a *Check again* button, and enables Connect only on a successful probe. |
| `connectToMetaMe(confirmedPersonaId)` | **Strict.** Refuses with `persona-confirmation-required` (no confirmed id supplied), `no-active-persona` (page reports none), or `persona-changed-since-confirmation` (operator switched persona between confirming and clicking). All three refuse **before** `persistAuthSession` — there is no half-paired state. |

`persistActivePersonaId(session.personaId ?? null)` became `persistActivePersonaId(session.personaId)`: the `?? null` placeholder was only reachable via the path that no longer exists.

### 1.2 Bug found and fixed while building it — the extension injected into *any* active tab

`chrome.scripting.executeScript` under the `activeTab` permission runs against **whatever tab is active**, entirely independent of `manifest.json`'s single `host_permissions` entry. `connectToMetaMe()` had no origin check. Clicking *Connect to metaMe* while an unrelated site was the active tab therefore ran `extractSupabaseSessionFromPage()` **on that site** — scanning its `localStorage` for any key containing `auth-token` and, on a hit, persisting a foreign site's bearer token as the extension's metaMe session.

Fixed with a shared origin guard, `isCompanionAppUrl(url)` / `getCompanionAppTab()`, that both injection paths (the new probe and the existing session extraction) route through. A non-Companion active tab now returns `active-tab-not-metame` and nothing is injected or read. Canary: *"the extension only injects into the Companion app origin"*, which also asserts the guard has exactly two call sites so a third injection path cannot be added without going through it.

### 1.3 §3.6 — Runtime registration: the reserved `CompanionSurfaceKind` is now actually stamped

`types/companion.ts` has reserved `'extension-sidebar'` / `'extension-overlay'` since the Phase 0/1 contract, but nothing ever tagged a call with either, so the platform could not distinguish *"the operator acted from the extension"* from *"the operator acted from the web-embed panel"* (SPEC-MMC-003 §0.5). Threaded additively, three ways:

1. **`types/companion.ts`** — `CompanionSurfaceKind` is now *derived* from a new `COMPANION_SURFACE_KINDS` const array (same union, one source of truth), plus `COMPANION_SURFACE_HEADER` (`x-companion-surface`) and `parseCompanionSurfaceKind()`. The parser returns `null` for absent/unknown values — an unknown surface is *unknown*, never silently coerced to `web-embed`.
2. **`background.js`** — `withPersonaHeader` became `withCompanionHeaders(headers, surface)`: the surface rides the **same** helper as `x-persona-id` rather than a second one. Every call site passes an explicit surface — `extension-overlay` for the content script's observation forward and the "Pull Across" context-menu capture (both originate in the page), `extension-sidebar` for the popup's connect/verify grant refreshes.
3. **`sidepanel.js` → the embed page** — the side panel now loads `/triad/embed/companion?surface=extension-sidebar`, and `app/(embed)/triad/embed/companion/page.tsx` validates that param through `parseCompanionSurfaceKind` and passes it to `resolveCompanionContext` instead of the hardcoded `'web-embed'` it used even when mounted inside the extension. This is the one place the surface tag has a **functional** effect today.

`POST /api/companion/capture` reads the header and logs `[companion:capture] surface=… sourceKind=…`. **Observability only, deliberately** — see §2.

### 1.4 §3.7 — One honest tri-state check, replacing three disconnected signals

Three signals already existed but were reported separately, at different moments, in different wordings: `ensureFreshToken` (session valid), the grants fetch's `{ok}` (server actually answers), and `personaFound` (a persona was captured). `VERIFY_COMPANION` → `verifyCompanion()` runs all three in sequence and returns exactly one state, naming the specific failing check rather than a generic error:

- **Connected & verified** — session valid, persona confirmed, grants in sync.
- **Connected, needs attention** — session valid, but persona or grants failed (which one is named).
- **Not connected** — no session.

The popup renders it as a coloured dot + one sentence (emerald / amber / slate; slate house style throughout, no white hairlines), runs it on open and after a successful connect, and offers an explicit *Verify Companion* button. The old `GET_CONNECTION_STATUS` handler is **removed**, not left alongside — it was session-only, and reported a confident "Connected." for a session that had no persona hint and could not reach the server. One status path, not two.

---

## 2. What this pass deliberately did NOT do

- **No new API route.** Nothing was added under `app/api/companion/`.
- **No migration, no schema change.** Neither `companion_captured_objects` nor `companion_observation_latest` has a column for surface provenance, so *persisting* the surface tag would require a migration. Per SPEC-MMC-003 §7 that is held for its own operator go-ahead rather than invented here — hence the capture route logs the surface instead of storing it. **No SQL for the operator to run in this pass.**
- **No DVN pipeline, receipt-writer, or protected-spine file touched.** `services/dvn/*`, `services/ops/*`, `services/identity/getActivePersona.ts`, `services/access/*`, `types/access.ts` are all untouched. No receipt type, payload, or state machine was changed.
- **No new consent capability, and no widening of what the Observer may read.** Deployment (getting paired) and consent (what may be read once running) stay separate concerns, exactly as SPEC-MMC-003 §6 requires.

---

## 3. What was NOT built from SPEC-MMC-003, and why

| Stage | Status | Why not |
|---|---|---|
| **§3.1 Browser detection** | Not built | Genuinely new code with no consumer until §3.2 exists. Building a detector whose only branch is "Chrome-family → click a link that doesn't exist" would be scaffolding for a flow that cannot complete. |
| **§3.2 Install orchestration** | **Cannot be built honestly today** | There is **no Chrome Web Store listing**. The manifest's pinned dev `key` and its single `host_permissions` entry (`https://dev-beta.aigentz.me/*`) are the evidence — this extension is loaded unpacked. Per CLAUDE.md's No Guessing rule, no store URL was invented, and none is referenced anywhere in this pass. **This is the operator-supplied value that unblocks §3.2:** a published listing URL. |
| **§3.3 pairing-code routes** (`/api/companion/pair/code`, `/api/companion/pair/redeem`) | Not built | The primary same-context path (`connectToMetaMe`) works and is now correct. The code path is a robustness nice-to-have for the fresh-install-no-metaMe-tab case; it is two new server routes with their own token-scoping design, which is its own increment rather than a tail-end addition to this one. |
| **§3.4 Passport linking / §3.5 Delegation** | Nothing to build | Both are *sequencing* requirements over already-shipped mechanisms (the embedded wallet; `recommendDelegatedAuthority` + the human authorize step). §1.1's fix is precisely what they needed — the wallet now mounts against a confirmed persona rather than a fallback. Principal–Delegate Separation is untouched: the extension still never authorizes its own delegation. |
| **§5 MCP install-assist** | Not built, not chartered | No MCP gateway for this exists in the repo. §5 was explicitly speculative in the spec and remains so. |

---

## 4. Files changed

| File | Change |
|---|---|
| `extension/companion-observer/background.js` | Persona-confirmation gate + strict `connectToMetaMe`; origin guard for both injection paths; `withCompanionHeaders`; `verifyCompanion`; `PROBE_ACTIVE_PERSONA` / `VERIFY_COMPANION` handlers; `GET_CONNECTION_STATUS` removed |
| `extension/companion-observer/popup.js` | Rewritten around the confirm-then-connect sequence + tri-state rendering |
| `extension/companion-observer/popup.html` | Persona confirmation panel, `Verify Companion` button, status dot; slate house style |
| `extension/companion-observer/constants.js` | `COMPANION_SURFACE_HEADER` + the two extension surface kinds |
| `extension/companion-observer/sidepanel.js` | Passes `?surface=extension-sidebar` to the embed |
| `types/companion.ts` | `COMPANION_SURFACE_KINDS` (union now derived), `COMPANION_SURFACE_HEADER`, `parseCompanionSurfaceKind` |
| `app/(embed)/triad/embed/companion/page.tsx` | Resolves its real surface instead of hardcoding `web-embed` |
| `app/api/companion/capture/route.ts` | Logs surface provenance (observability only) |
| `tests/companion-capture.test.ts` | Canaries updated + five added |
| `codexes/packs/irl/foundation/SPEC-MMC-003_*.md` | Ratified; §8 implementation record |

## 5. Canaries

`tests/companion-capture.test.ts` — 52 passing. Added: the pairing confirmation gate (including *refusals precede persistence*), the origin guard (with a call-site count so a third injection path cannot bypass it), surface stamping on every server-bound call, the popup's disabled-in-markup Connect + masked persona id, and the single tri-state check with the old status path locked out.

Two assertions in that file were failing **before** this pass, for code this pass did not touch, and were repaired as over-strict regexes rather than real violations: the assign-route import check broke when a sibling `getIntentQube` was added to an existing import (now tolerant of additional named imports from the same module), and the `CaptureInboxPanel` spine check was matching its own header comment stating the rule (now matches an actual `authedFetchHeaders(` call). Neither underlying file is in violation; both intents are preserved.

---

*Implementation pass for SPEC-MMC-003, operator-directed 2026-07-25. Composes existing primitives only: no new route, no migration, no parallel identity or consent mechanism.*
