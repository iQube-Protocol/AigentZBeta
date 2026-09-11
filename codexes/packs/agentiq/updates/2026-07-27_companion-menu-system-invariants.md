# Companion Menu System — Constitutional Capability Brief (CCB v2)

**The first Capability Completion Artifact under CCR-001**
(`codexes/packs/irl/foundation/CCR-001_constitutional-capability-completion.md`), and therefore the
reference example of the format. It is a Constitutional Capability Brief (CFS-049) carrying
CCR-001's completion sections — **not a second artifact family** (CFS-049 Amendment A). Schema:
`capability-completion-artifact/v2.0`.

**Operator-requested, 2026-07-27:** *"It may be worth defining what the invariants of this menu
system are so we don't have to keep playing this game of whack-a-mole where fixing one thing
breaks another persistently."*

This is that definition. Eleven invariants, each with the defect that proved it and the canary that
enforces it. **Every one of them was learned from a live regression** — none is speculative.

## Capability identity

| Field | Value |
|-------|-------|
| Capability ID | `companion-menu-system` |
| Display label | Companion Menu System |
| Artifact version | 1.0 |
| Schema | `capability-completion-artifact/v2.0` |
| Date | 2026-07-27 |
| Governing documents | `CCR-001`, `CFS-049`, `SCOPE-MMC-004`, `PRD-MMC-001` |
| Artifact path | `codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md` |
| Registry status | **Not yet registered** in CFS-032. Registration is the acceptance ceremony and belongs to CCR-001 Phase 4; recorded here honestly rather than claimed. The parent capability `metame-companion` IS registered and carries its own Brief. |

## Behavioural capability statement

The Companion menu system is the single navigational authority for the Companion shell: one row of
controls, owned by the copilot, through which a citizen chooses which surface occupies the body —
conversation, avatar, wallet, search, workspace, overlay, activity or permissions. Choosing a
surface swaps what the body renders while the row itself stays put and stays legible above it; the
page the citizen happens to be browsing may refine what the row offers but may never change what
they chose. A correct implementation is one where every rendered control acts on the surface it is
rendered on, where exactly one component decides what the body shows at any moment, and where the
row's geometry stays true through every surface change.

## Purpose

The menu system took ten fix cycles because nothing named the rule each fix was breaking. Seven of
its ten defects were the same shape, and each fix was locally correct and invisible to the next
one. This artifact exists so the next person to touch it — a new session, another agent, a
reimplementer on a different stack — inherits the rules rather than rediscovering them one
regression at a time.

## Location

### Surfaces
- Companion browser extension → the control row beneath the body, on every surface
- Platform copilot → the same row, where the close chevron is the only way to dismiss the panel

### Source paths
- `app/(embed)/triad/embed/companion/page.tsx` — the Companion shell
- `app/components/codex/CodexCopilotLayer.tsx` — the copilot that hosts it
- `services/companion/companionNavigation.ts` — the nav vocabulary
- `services/companion/quickLinks.ts` — quick links
- `extension/companion-observer/content.js` — the per-tab observer that produces the observed-page signal
- `extension/companion-observer/background.js` — the single writer of the shared observation record

## Invocation

- A citizen presses a control in the copilot's menu row; the host is notified and swaps the body.
- The host supplies `bodySlot` / `onWalletLaunch`, taking ownership of the body for that surface.
- The copilot's own mode toggle enters or leaves avatar, echoing the change back to the host.
- Quick links are offered from the strip, ranked by the observed page but gated by the chosen surface.

## Capability boundary

### Owns
- The navigation vocabulary and the single row that renders it
- Which surface is active, as one value shared by host and copilot
- The geometry of the row, and the body offset that keeps the row legible above the body
- Whether a control is eligible to render on this deployment

### Does not own
- What any surface's body actually renders — a host that supplies `bodySlot` owns that
- The wallet's contents, lifecycle, or internal state
- The avatar SDK's DOM, which it injects outside any container given to it
- The page beneath the Companion, which is observed and never controlled
- Authorization for anything the row navigates to — that is the identity and access spine's

### Dependencies
- `services/companion/companionNavigation.ts` for the vocabulary — never a local list
- The host shell for `bodySlot` / `onWalletLaunch` ownership handover
- `services/companion/quickLinks.ts` and the domain resolver for the observed-page signal

### External authorities
- The identity and access spine — every destination re-resolves its own gate; the row grants nothing
- The D-ID avatar SDK, which renders at `document.body` level and can write `document.body.style`
- The host deployment, which decides whether the close control can act at all

### Emits

<!-- Added 2026-07-28 under the `Emits` extension (schema v2.0). Recorded from
     what the code does: the menu row itself writes nothing — navigating is not
     a state transition — and the single emission below belongs to the observer
     MS-10 governs. -->

- **durable-record** `companion_observation_latest` — one row per persona, upserted on `persona_id` with last-writer-wins, forwarded by the extension background worker's `OBSERVATION` handler after the local consent check. The worker is the only writer for every tab (MS-10), and it suppresses the write when the observation's material content is unchanged. No receipt: the row is context for ranking the strip, not an assertion the platform makes to anyone.

### Emission rationale

Not applicable — `Emits` is non-empty. Recorded here only to note what is deliberately absent: choosing a surface, swapping the body, entering or leaving avatar, and following a quick link all emit nothing, because none of them is a state transition of record (CFS-053 §5.3). Every consequence a citizen sees after pressing a control is emitted by the surface navigated to, under that surface's own capability, and the row grants no authority of its own (MS-9, and the spine entry under External authorities).

## Implementation freedom

Nothing here fixes the framework, the styling, the control shapes, the transport between host and
copilot, or the number of surfaces. A reimplementation may use different components, a different
event mechanism, and a different visual language and still be correct. What may not differ is the
*arity*: one navigation, one owner per surface, one state behind two views, one rect per overlay,
one measurement that tracks the node actually mounted, and one record of what has been observed. Every invariant below constrains how
many things may describe or own one thing — not what any of them is made of.

## Why whack-a-mole kept happening

Seven of the ten failures below are the SAME shape: **two things describing or owning one thing,
and the stale one winning.** Two wallets, two menus, two modes, two measurements, two labels, two
signals — and, in MS-10, one cache PER TAB all claiming to describe one shared row. Each fix was correct locally and invisible to the next defect, because nothing named the
rule being broken. Naming them turns "a fix broke something else" into "a canary failed."

The second recurring shape is a **mechanism that is present but inert** — a needle that matches
nothing, an observer watching a detached node. Nothing errors; the feature simply never fires,
and it reads as "still broken" after a fix that was genuinely applied.

---

## MS-1 — One navigation

The copilot's menu row is the only navigation. No surface may render a second control for a
concept the menu already owns.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** the Companion's own bottom nav row duplicating the copilot's (retired 2026-07-26);
  the Partner Workspace rendering a tier-3 row AND an in-component surface row, which disagreed
  with each other on screen (2026-07-27).
- **Enforced by:** `tests/partner-workspace.test.ts` — the area tabs carry no `subTabs`, and the
  component's own row is suppressed when a menu owns selection.

## MS-2 — One owner per surface

Exactly one component decides what occupies the body. When a host supplies `bodySlot` /
`onWalletLaunch`, the host owns it and the copilot must hold **no parallel state** for the same
surface — not even harmless-looking state, because `bodySlot` precedence hides it until the moment
it doesn't.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** twice. The copilot's wallet stayed mounted after the citizen navigated away
  (2026-07-26); then `launchWallet` set private `walletPanelOpen` *and* notified the host, so
  pressing Agent Me surfaced a stale wallet over the conversation (2026-07-27).
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — `hostOwnsWalletSurface` hands the
  launch over, `walletFillsSurface` is off in that arrangement, and exactly one opener exists.

## MS-3 — One state, two views

Mode (`chat` / `avatar`) is one value. Host and copilot stay in agreement in **both** directions,
and neither may keep its own idea of which surface is active.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** entering avatar via the copilot toggle left the host's `activeNavItem` frozen, so
  every later nav click wrote state the avatar branch never rendered (2026-07-26). Then the chat
  echo returned the *current* item unless it was `avatar`, so from any bodySlot surface the Agent
  Me button looked dead (2026-07-27).
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — the bidirectional sync and the
  return-to-conversation echo.

## MS-4 — Measure what is mounted

Any geometry derived from a **conditionally rendered** node must re-measure when that node
changes. A zero measurement is a teardown artifact, **never** a layout value.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** the ten-cycle defect. The footer carrying the whole menu row was measured by a
  `ResizeObserver` attached with `[]` deps. Entering avatar detached the node (`offsetHeight` 0);
  returning to chat mounted a new node the observer never saw. Height stuck at 0 for the life of
  the mount, so the body rendered *underneath* the near-transparent menu bar — which reads
  simultaneously as "the menu is broken" and "the opacity has disappeared." Ten fixes to the D-ID
  avatar host could never have reached it, because the broken geometry was the copilot's own.
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — callback ref, previous observer
  disconnected, zero-guard present, and the mount-once shape explicitly forbidden.

## MS-5 — A deliberate act outranks an ambient observation

Selecting a surface is something the citizen **did**. The page under the Companion is something
that merely **happens to be there**. Context refines what a choice offers; it never overrides the
choice. Only a surface that is *about* the page (`overlay`) — or has no topic of its own
(`agent-me`) — falls through to the observation.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** quick-link ranking read `shape ?? domain ?? surface` on the reasoning that an
  asserted page shape is "the stronger signal." But `dev-beta.aigentz.me` carries a verified
  Domain Profile, so during testing the shape *always* resolved and pinned the strip to one needle
  on every surface — the carousel stopped changing with the tabs (2026-07-27).
- **Enforced by:** `tests/companion-1-1-quicklinks.test.ts` — the precedence is pinned
  surface-first, and every surface needle must change the visible strip.

## MS-6 — Gate, then rank; never subtract

Ranking runs **after** gating. It may reorder, and reordering before the limit legitimately
changes *which* items are visible — but it may never widen the offer, empty it, or change how many
are offered.

- **Provenance:** pre-release-intercepted
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** never shipped, but the first ranking design filtered instead of ranking, which
  would have let an unrecognised page empty a surface that works fine with no observation at all.
- **Enforced by:** `tests/companion-1-1-quicklinks.test.ts` — a surface needle cannot subtract or
  widen, compared against the *unlimited* permitted set.

## MS-7 — An inert mechanism is a defect

A signal that can never fire is a bug even though nothing errors. Ship no needle, filter, or
observer without evidence that it matches something real.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** `workspace: ['mycluster']` matched nothing because ranking read the visible label
  only, and `myCluster` is a tab **group** whose members are labelled myCanvas / myWorkspace /
  myCartridge / myLedger. The strip stayed frozen and read as "quick links still static"
  (2026-07-27).
- **Enforced by:** `tests/companion-1-1-quicklinks.test.ts` — every surface needle, and every
  declared host destination, must reach at least one link an ordinary citizen can be offered.

## MS-8 — An overlay is anchored to the box it occupies, and does not intercept

A floating layer takes **one rect** — the box it is meant to fill. Position from one element and
size from another is a misplacement waiting to happen, and a high-z layer with no
`pointer-events: none` swallows clicks wherever it lands.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** the avatar host took its position from the panel and its size from the frame. The
  repo carries the scar tissue: an earlier commit raised six unrelated components to `z-200` to
  escape this overlay.
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — the anchor reads the frame, and
  reading the panel rect again fails.

## MS-9 — A control that cannot act must not render

Every rendered control does something on this surface. A control whose only effect is on a
different deployment is a dead control and must be gated out, not left as decoration.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** the copilot's close chevron in the Companion, where the Companion's own chrome
  closes the panel — and then the over-correction that removed it from the platform copilot, where
  it is the only way to dismiss the copilot.
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — the chevron is present by default
  and gated only by `hideCloseControl`.

## MS-10 — One observer, one record

The Companion's observation of the page the citizen is on is **one shared record** —
`companion_observation_latest`, one row per persona, last writer wins. Any decision to SKIP writing
it — a dedupe, a cache, a "nothing changed" check — must be made **where that record lives**. An
observer that remembers only what *it* last sent cannot know the record still holds it, and will
suppress the very write that would correct it.

Two corollaries, both of which the defect below produced:

- **A stale observation must never render as current.** The record describes the tab in view; when
  it describes a different one, every surface reading it is wrong at once — the Overlay card, the
  quick-link ranking, and anything that grounds on the observed domain.
- **A refresh mechanism above a suppression it cannot see is inert (MS-7).** The Overlay's Refresh
  button and its 5s poll both worked perfectly: they asked the active tab to re-observe, and the
  re-observation was then discarded below them. Nothing errored, and the button read as dead.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** the per-tab `lastSentSignature` in `content.js` (added 2026-07-25 to stop a network
  write per tab flick, which was a real cost and a correct concern — in the wrong place). The
  content script runs once per tab, so every open tab held its own copy of a claim about one shared
  row. Observe `claude.ai`, switch to a `github.com` tab, switch back: `claude.ai`'s script compared
  against its own last send, found it identical, and suppressed. The row stayed on `github.com`
  permanently. The operator's Overlay read **REPOSITORY — GITHUB.COM** while their active tab was
  `claude.ai`, the quick-link strip ranked on the github `software` needle (MS-5's `??` chain never
  reaching the `claude.ai` host needle), and Refresh could not help because its re-observe hop lands
  in `observeAndSend` — the function doing the suppressing (2026-07-27).
- **Fixed by:** relocating the suppression to `forwardObservationToServer` in `background.js` — the
  one thing that writes the record for every tab — and recording the signature only once the SERVER
  accepted the write. The per-tab version recorded on the local consent ack, so a refused forward
  also suppressed its own retry.
- **Enforced by:** `tests/companion-observer.test.ts` — the real shipped `content.js` and
  `background.js` run in `node:vm` with a fake `chrome`, one page context per tab over one message
  bus and one server. Three canaries: returning to an already-observed tab after another tab wrote
  must write again; an unchanged page with no intervening tab must still cost no write (so the fix
  cannot be a revert); and a forward the server refused must be retried, not suppressed.

---

## MS-11 — A cache may not answer authoritatively before it is hydrated

A cache that mirrors durable state has a **third** state besides granted and denied: *not loaded
yet*. Any read that cannot distinguish "I know the answer is no" from "I do not know yet" must
**wait**, not answer. This is the sharpest possible case for it — a consent cache, where the
fail-closed default is otherwise exactly right.

Fail-closed is correct for consent, and it is precisely what made this invisible: answering "denied"
looks like the safe direction, so nothing errors, nothing warns, and the surface degrades into a
state indistinguishable from the citizen never having granted anything. **Answering "denied" for
"not loaded yet" is a lie with the same consequences as wrongly answering "granted", in the other
direction** — and in a consent system the second is audited while the first is assumed benign.

- **Provenance:** regression-derived
- **Status:** canonical
- **Stage:** canonical
- **Broke it:** `background.js`'s `CHECK_GRANT` handler answered **synchronously** from
  `grantStateCache`, which starts as `emptyGrantState()` and is filled by an **asynchronous**
  `chrome.storage.local.get` callback. MV3 evicts the worker after ~30s idle, so the message that
  *wakes* the worker is dispatched to `onMessage` on an earlier task than the hydration callback.
  Every grant check on a cold-started worker therefore returned `false`, on every domain, and
  `buildObservation` populated **no fields at all** — posting `{grantedCapabilities: [], observedAt}`
  with no `currentTabDomain`. The server upserted a domainless row, so the Overlay fell back to the
  last row that had ever written successfully and rendered a **days-old site** for hours
  (`CLAUDE.AI` while the active tab was `chatgpt.com`, then `github.com`). The citizen's
  `scope: 'global'` `current-tab` grant was in `chrome.storage.local` the entire time, and the
  extension popup correctly reported **"grants in sync"** — storage *was* in sync; only the
  in-memory mirror was empty (2026-07-30).
- **Why the MS-10 canary was blind to it:** the harness's fake `chrome.storage.local.get` invoked
  its callback **synchronously**. That one detail made this entire defect class inexpressible: the
  cache was always hydrated before any message could be dispatched, so a synchronous read always
  looked correct. **A fake that is easier to satisfy than the real API cannot falsify anything.**
  The fake now defers its callback, as Chrome's does.
- **The diagnostic tell, and the trap:** the page console showed an unbroken run of
  `[metaMe Observer] background observation handling result: {ok: true}`. That ack reports the
  **local consent result only** — it is sent before the forward resolves and says nothing about
  whether the server accepted the write. Reading it as "persisted" cost hours. The forward's real
  outcome (`observation forward failed: TimeoutError: signal timed out`) is logged **only in the
  service worker console** (`chrome://extensions` → Inspect views → `service worker`), never the
  page console. When an observation is not landing, that is the only console that can tell you.
- **Fixed by:** a `grantStateReady` promise gate resolved by the hydration callback. Every grant
  read awaits it — `CHECK_GRANT` and `OBSERVATION` (both now async responders, returning `true` to
  hold the message channel open) and `performCapture`, which is the likeliest of the three to run on
  a cold worker since a context-menu click is exactly the kind of one-off event that wakes one.
- **Also fixed alongside:** `content.js` **awaited** `REFRESH_GRANTS`, whose handler performs a
  server fetch with a 10s ceiling — more than double the content script's own 4s message ceiling. It
  therefore could not succeed whenever the server was slow: it stalled every observation for the
  full 4s and continued anyway. That was the true source of the recurring
  `background did not respond in time` warnings. The refresh is a **cache warm, never a
  precondition**, so it is now fire-and-forget; the following checks read the fresh state on the
  next observation, one 5s poll cycle later.
- **Enforced by:** `tests/companion-observer.test.ts` — "a cold-started worker answers grant checks
  from STORAGE, not from its empty initial cache". `hydrationDelayMs` pins the hydration callback
  after the waking message rather than racing it. Verified to fail against the pre-fix code with
  `expected [ undefined ] to deeply equal [ 'claude.ai' ]` — the domainless observation itself.

---

## Open defect — site-scoped grants store a URL where a hostname is compared

Found while diagnosing MS-11, **not yet fixed**, and currently **masked** by the global grant that
sits beside it. Live grant state contains:

```json
{ "capability": "current-tab", "scope": "site", "siteDomain": "https://github.com/" }
```

`isCapabilityGranted` compares `g.siteDomain === siteDomain`, and its caller passes
`location.hostname` — `"github.com"`. `"https://github.com/" !== "github.com"`, so **every
site-scoped grant is dead on arrival**: it can never match the domain it was granted for. Only the
`scope: 'global'` grant is doing any work today, which is why this has never surfaced as a symptom.

Whoever fixes this must fix it at the **write** path (normalise to a hostname when the grant is
recorded) *and* migrate the existing rows — normalising only at comparison time would leave the
stored records misleading, and a stored record that does not mean what it says is the MS-10/MS-11
shape again. Needs a canary asserting a site-scoped grant matches the host it names, and does not
match a different one.

---

## Open defect — quick links may offer a destination that does not exist (MS-7 shape)

Operator-reported 2026-07-30, immediately after MS-11 was fixed and the Overlay began tracking the
active tab correctly. **Not yet fixed — parked as a fast follow-up, to be taken with a broader
quick-links review the operator has scoped separately.**

**Scope, as corrected by the operator — this is NOT all metaMe deep links.** The `myCluster` quick
links deep-link correctly. The failing ones are the **Financial Services** targets, and the operator's
own read is that *that cartridge/tab may not technically exist*. Two reported symptoms are very
likely **one root cause**:

1. A **`metaMe · Financial Services`** chip lands on the cartridge home rather than the section it names.
2. A **`Venture Lab α · Financial Services`** chip 404s outright:

```
https://dev-beta.aigentz.me/triad/embed/codex/venture-lab?personaId=<uuid>&from=companion&fromTab=agent-me&tab=financial-services
→ "Failed to load codex — Codex not found"
```

Confirmed during triage: the slug **does** exist in the hand-curated registry
(`data/codex-configs.ts`, `slug: 'venture-lab'`), and the 404 reproduced under two different
personas, so it is neither a bad slug in the link nor persona-scoped. What has NOT been verified is
whether `financial-services` is a real tab id on either cartridge — and if it is not, both symptoms
follow directly: a link naming a nonexistent tab either falls back to the cartridge root (symptom 1)
or fails the lookup outright (symptom 2), depending on which resolver handles it first.

**If that is the cause, this is MS-7 — an inert mechanism is a defect.** A quick link offering a
destination that cannot exist is the same class as a needle that can never fire: nothing errors, and
the citizen reads a working feature as broken. The repair is then to gate link *offering* on the
target actually resolving, not to special-case the two labels.

Where to look: `services/companion/quickLinks.ts` builds these targets, `cartridgeLinkTarget()`
picks the window, and `buildCodexUrl()` (`utils/codex-nav.ts`) is the canonical builder taking
`{ tab, personaId, from, fromTab }`. For the 404 specifically, also check the dual-source collision
CLAUDE.md documents under "Cartridge / Codex Registration" — and **read that section before touching
the registry**: its documented failure mode is that "fixing" a duplicate by deleting the
hand-curated definition silently strips every interactive tab and breaks the slug other surfaces
target.

Whatever the cause, the fix must keep identity propagation intact — CLAUDE.md's "Inter-Cartridge
Navigation" rule requires `personaId` to travel on every cross-cartridge link, so a repair that
hardcodes a path and drops the query params trades one defect for a worse one.

Note that MS-11 masked all of this: until the Overlay tracked the real tab, the strip ranked on a
stale domain, so a wrong destination was indistinguishable from a wrong ranking.

---

## Third-party embeds — the standing caution

The D-ID avatar SDK renders **outside** the container it is given: it injects nodes at
`document.body` level and can write `document.body.style`. No amount of styling the host wrapper
reaches them. Any third-party widget embedded in this shell must be assumed to do the same, which
means: unmount it when it is not in use, sweep its artifacts on teardown, and restore any
document-level styles it may have taken.

## Reproduction procedure

1. Define the navigation vocabulary in ONE module and render every control from it — no surface may re-list it locally.
2. Give the row a single owner: the copilot renders the controls; the host that supplies `bodySlot` owns what they reveal.
3. Hold the active surface and the chat/avatar mode as ONE value, synced in both directions, with no private copy on either side.
4. Attach the row's geometry measurement with a callback ref that disconnects the previous observer and re-measures on every mount; discard a zero as a teardown artifact rather than writing it as a height.
5. Offset the body by the measured row height so the row stays legible above whatever the body renders.
6. Gate the offered quick links by the chosen surface FIRST, then rank the survivors by the observed page — never filter during ranking.
7. Gate out every control whose effect belongs to a different deployment, and let each remaining control act on this surface.
8. Anchor any floating layer to the single rect of the box it fills, with `pointer-events: none` unless it is meant to receive input.
9. Unmount third-party embeds when unused and sweep the document-level artifacts they leave behind.
10. Make every "nothing changed, skip the write" decision where the record being written lives — never in a per-observer cache of what that observer last sent — and record the skip-key only once the write was actually accepted.
11. Ship one canary per invariant, in the same change as the behaviour it guards.

## Modification rules

- Before changing anything in the menu system, name which invariant your change relies on.
- A change that would violate an invariant is a discussion, not an implementation.
- A defect that fits none of the eleven is a twelfth invariant — add it here with its defect and its canary in the same change that fixes it.
- Never add a second control, a second owner, a second mode value, or a second measurement for something the list above already assigns to one place.
- Never widen a canary's tolerance to make a violating change pass; the canary is the invariant's only enforceable form.
- Changing the vocabulary in `services/companion/companionNavigation.ts` is a vocabulary EXTENSION and needs the operator's sign-off — the ratified set is pinned by canary.

## Known hazards

- Third-party embeds render outside the container they are given — see the standing caution above. The D-ID avatar SDK is the known instance; assume any new widget behaves the same.
- A `ResizeObserver` attached with `[]` deps against a conditionally rendered node is inert after the first unmount. It errors on nothing and reads as "still broken" after a genuine fix.
- A needle or filter that matches only a visible label will silently miss anything addressed by group, id, or route — an inert mechanism, not an empty result.
- Raising z-index to escape a mis-anchored overlay spreads the defect: the repo already carries six unrelated components raised to `z-200` for exactly this reason.
- `bodySlot` precedence hides parallel copilot state until the arrangement changes, so a "harmless" duplicate field can sit latent for weeks before surfacing as a stale wallet.
- A browser-extension content script runs once PER TAB. Any module-level state in it is per-tab by construction, so it can never describe a resource shared across tabs — and the failure is silent, because the tab's own view of that state is internally consistent.
- "Vitest cannot execute the extension's plain JS" was assumed, and left the extension guarded by structural greps only. It can: `node:vm` runs the shipped files against a fake `chrome`. A structural canary could never have caught MS-10, whose defect is in WHERE state lives rather than in what any line says.

## Operational evidence

- 2026-07-26 — the retired Companion bottom nav row and the wallet-remount fix shipped; the duplicate-navigation and stale-wallet symptoms stopped reproducing.
- 2026-07-27 — the ten-cycle geometry defect was diagnosed and fixed only after MS-4 was written down; the body stopped rendering underneath the menu bar.
- 2026-07-27 — the quick-link strip began changing with the selected surface once precedence was pinned surface-first (MS-5) and the inert `mycluster` needle was repaired (MS-7).
- 2026-07-27 — the shared observation record stopped going stale on tab return once the write-suppression moved to the single writer (MS-10); the Overlay and the quick-link strip both follow the active tab again.
- The canaries named against each invariant above run in the repo's vitest suite and pass on this commit.

## Commons publication record

| Field | Value |
|-------|-------|
| Proof class | constitutional |
| Claim scope | These eleven invariants, as governing the Companion menu system on this platform. NOT a claim that they generalise to menu systems at large — the recurrence shape (two owners, stale one wins) is a candidate for cross-capability promotion, which is a separate finding requiring its own evidence. |
| Evidence references | `tests/companion-1-1-navigation.test.ts`, `tests/companion-1-1-quicklinks.test.ts`, `tests/companion-observer.test.ts`, `tests/partner-workspace.test.ts`, `tests/capability-completion.test.ts` |
| Approval record | None — not yet submitted |
| Published | no |
| Lineage — capability | `companion-menu-system` |
| Lineage — artifact | `codexes/packs/agentiq/updates/2026-07-27_companion-menu-system-invariants.md` |
| Lineage — sources | `app/(embed)/triad/embed/companion/page.tsx`, `app/components/codex/CodexCopilotLayer.tsx`, `services/companion/companionNavigation.ts`, `services/companion/quickLinks.ts`, `extension/companion-observer/content.js`, `extension/companion-observer/background.js` |

## Applying these

Before changing anything in the menu system, name which invariant your change relies on. If a
change would violate one, that is the discussion — not the implementation. If a new defect turns
out to fit none of these eleven, it is a twelfth invariant: add it here with its defect and its canary
in the same change that fixes it.
