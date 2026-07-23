# PRD-MMC-IMPL-002 — metaMe Companion Phase 3 Implementation Plan (Constitutional Overlay + Universal Search + Notifications)

**Status: DESIGN — docs-first, ratify-before-build.** Follows the same discipline as PRD-MMC-IMPL-001 (Phase 2): nothing below gets built until the Ratification Record at the end is checked off.

Companion to: `codexes/packs/irl/foundation/PRD-MMC-001_metame-companion.md` (RATIFIED 2026-07-22) §7's Phase 3 line:

> **Phase 3 — Constitutional Overlay + Universal Search + Notifications.** App-specific overlays (10) composing existing standing/capability/registry reads; the federated cross-surface search index (8); browser-surface constitutional notifications (12).

PRD-MMC-001's own component table names all three as part of the PRD's "genuinely new" honest list (§3, the components-13 review) — none of this is a thin projection of an already-shipped primitive; each has a real new part, named precisely below so scope doesn't drift during build.

---

## §1 What already exists to reuse (Extend, Don't Duplicate — researched, not assumed)

| Component | Existing reads to federate/compose | Exact source |
|---|---|---|
| Universal Search | IRL research overview | `GET /api/research/overview` (`app/api/research/overview/route.ts`) |
| | Registry (iQubes / assets / library) | `GET /api/registry/iqube`, `GET /api/registry/assets` (`matchesFilter`/`AssetListFilter`), `GET /api/registry/library` |
| | Capability graph | `services/capability/capabilityGraph.ts` (`buildCapabilityGraph`, `recommendProducers`) via `GET /api/capability/producers` |
| Constitutional Overlay | Standing | `GET /api/venture/standing-summary` → `readStandingForVenture()` (`services/venture/standingForVenture.ts`) → `computeStandingScore()` (`services/standing/standingScore.ts`) |
| | Capability graph | same as above |
| | Registry | same as above |
| | Observed app context | `types/companionObserver.ts`'s `BrowserContextObservation` (`grantedCapabilities`, `currentTabDomain`, `currentTabTitle`, `selectionText`, `pageDocumentExcerpt`, `observedAt`) — contract exists; **no live producer posts a real one to the server yet** (Increment 6's own header flagged this; `content.js` builds one locally and only acks it to the extension's own background worker — nothing today ships it to a Companion API). This is a real, load-bearing gap the Overlay depends on — see §3 Increment 2. |
| Universal Notifications | Delegation events | `services/delegation/delegationGrantStore.ts` over `delegation_grants` |
| | Passport status transitions | `services/passport/passportStatusMachine.ts` (`renewal_due → expired_non_renewal`, receipt kind `passport_status_changed`) |
| | General constitutional events | `services/orchestration/orchestrationEvents.ts` over `orchestration_events` |
| | "Awaiting approval" UI precedent (not yet a notification) | `components/metame/workbench/{WorkbenchLedger,IntentChainPanel,ActiveWorkDetailLayout}.tsx` |
| | **NOT this** | `app/api/wallet/notifications/route.ts` (`wallet_notifications`) is a different, unrelated wallet-agent notification system — a false cousin, not what this extends. |
| All three | Single composition point | `services/companion/runtime.ts`'s `resolveCompanionContext()` (`{surface, identity, session, feed, resolvedAt}`) — the file this session already built as the Companion's one context resolver. Phase 3 extends THIS, not a parallel resolver. |

No "standing increased" event exists anywhere today — that emission is new (§3 Increment 3).

---

## §2 Scope, precisely (what's new vs. what's composed)

- **Universal Search (component 8):** the unifying federated-query/rank/merge layer is NEW. The four reads it federates (research overview, registry ×3, capability producers) already exist and are called, never re-queried at the table level.
- **Constitutional Overlay (component 10):** the overlay-composition layer (mapping an observed domain to a "shape" — e.g. `github.com` → repo-shaped card citing Standing/capabilities/contributors/research/IRL refs; a banking-class domain → QriptoCENT/Wallet/Passport/Risk/Delegations) is NEW, and so is the missing observation-ingest endpoint that gives it real domain context to react to (§1's flagged gap). The standing/capability/registry reads it composes already exist.
- **Universal Notifications (component 12):** the constitutional-events → notification-feed reader is NEW (delegation/passport/standing routed into `resolveCompanionContext()`'s feed as first-class notification items, not generic receipts). The "standing increased" event emission is NEW (no such event exists today). The underlying events (delegation grants, passport status, orchestration events) already exist and are read, not re-modeled.

---

## §3 Increments

### Increment 1 — Universal Search façade

- New route `GET /api/companion/search?q=...` — fans out to the four existing reads in §1 in parallel, applies a simple relevance rank (substring/keyword match on title/name fields — no ML ranking in this pass, stated as a non-goal below), merges into one result list tagged by source (`research | registry-iqube | registry-asset | registry-library | capability`).
- Consumer: extend the Companion popup's existing Wallet/Companion toggle (`app/(embed)/triad/embed/companion/page.tsx`) to a three-way toggle — `Wallet | Companion | Search` — reusing the exact segmented-control pattern already built, not a new UI primitive. A simple query box + result list, each result deep-linking to its source surface via `buildCodexUrl()` (CLAUDE.md's canonical inter-cartridge nav helper) — never a bespoke nav path.
- T1/T2 discipline: search results carry only display-safe fields (titles, T2-safe refs) already returned by the underlying routes — no new T0 exposure, since nothing here reads a new data class beyond what those routes already return to their existing callers.

### Increment 2 — Constitutional Overlay

- **First, closes the flagged gap:** a new route `POST /api/companion/observer/observation` (spine-authenticated) that accepts a `BrowserContextObservation`-shaped body from the extension's background worker, re-validates it server-side against the persona's actual stored grants (never trusting the client's own `grantedCapabilities` claim — mirrors `assertObservationRespectsGrants`'s logic but re-run server-side against the DB-backed grant state, defense in depth), and stores only the CURRENT observation per persona (a single latest-observation row, not an append-only log — this is live context, not an audit trail; the DVN/receipt discipline governs audit-worthy events, not passive browsing context).
- `extension/companion-observer/background.js`'s existing `OBSERVATION` message handler (currently just acks locally, per its own comment: "no live, authenticated Companion API session exists to forward this to") gets the missing forward call to this new endpoint added.
- Overlay composition: a small, explicit domain → shape mapping table (illustrative first set, stated as the actual scope — not an open-ended domain classifier): `github.com`/`*.github.com` → repo-shaped card (Standing + capability-graph position + IRL refs, keyed by best-effort repo-name match against the registry — no attempt to resolve an arbitrary repo to a specific iQube if no match exists, degrades to "no linked iQube found" honestly); a small illustrative banking-domain set → QriptoCENT/Wallet/Passport/Risk/Delegations card (reuses the SAME wallet/standing reads as Increment 1, not a new read path). Renders as a fourth Companion popup mode, gated on `currentTabDomain` matching a known shape — otherwise shows "no overlay for this page" rather than a fabricated generic card.

### Increment 3 — Universal Notifications

- Extend `resolveCompanionContext()`'s feed builder (`mapReceiptsToFeed()`, `services/companion/runtime.ts`) to also pull from `delegation_grants` (status transitions), `passport_status_changed` receipts, and a new "standing increased" comparison — computed by snapshotting `computeStandingScore()`'s result per persona per session and diffing against the previous stored snapshot (new, minimal — a `previous_standing_score` column or small side table, whichever this session's existing Standing schema most cleanly extends; exact shape decided by whoever builds this increment, following the same schema patterns already used elsewhere in this repo, not invented from scratch).
- These render as a distinct, visually-flagged subset of the Timeline feed (an unread-style dot/badge) — not a separate notification system, since `resolveCompanionContext()` is already the one context resolver every Companion surface reads.

---

## §4 Explicit non-goals for this pass

- No native OS/browser push notifications (`Notifications` browser permission is already modeled in `types/companionObserver.ts`'s capability list but wiring actual OS-level push delivery is out of scope here — this phase's "Universal Notifications" is an in-Companion feed, not a system tray popup).
- No ML/embedding-based search ranking — substring/keyword match only, stated plainly rather than silently underdelivering against an implied "smart search."
- Constitutional Overlay ships with an illustrative first domain set (GitHub + one banking-class example), not a general-purpose arbitrary-app classifier — expanding the domain table is a natural follow-up, not blocked by this pass.
- No change to DVN/receipt pipelines, identity spine, or any CLAUDE.md-protected file.

---

## §5 Verification plan

- Increment 1: query for a term known to exist in at least two of the four federated sources; confirm both appear, correctly tagged, with working deep links.
- Increment 2: seed a test observation via the new endpoint (bypassing the extension for a controlled test), confirm the server-side grant re-validation actually rejects a claim for an ungranted capability (the same fail-closed test pattern Increment 3's canaries already established for the client-side version). Confirm the GitHub-shaped card renders for a `currentTabDomain` of `github.com` and the "no overlay" state renders honestly for an unmapped domain.
- Increment 3: seed a delegation-grant status change and a passport-status transition in a test persona's data, confirm both surface as tagged Timeline items; manually flip a standing score across two snapshots and confirm a "standing increased" item appears exactly once (not duplicated on every subsequent poll).

---

## §6 Ratification Record

- [ ] Operator confirms Increment 1 (Universal Search) scope as described — federated façade over the four named existing reads, keyword-match ranking only, folded into the existing popup's toggle pattern.
- [ ] Operator confirms Increment 2 (Constitutional Overlay) scope — including that it requires building the previously-deferred observation-ingest endpoint first, and that the domain-shape mapping ships with only an illustrative first set (GitHub + one banking example), not a general classifier.
- [ ] Operator confirms Increment 3 (Universal Notifications) scope — an extension of the existing Timeline feed with a new "standing increased" event, not a separate notification system or native OS push.
- [ ] Operator confirms the §4 non-goals (no OS push, no ML search ranking, illustrative-only overlay domain set).
