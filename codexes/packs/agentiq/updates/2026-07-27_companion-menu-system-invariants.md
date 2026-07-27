# Companion Menu System — Invariants

**Operator-requested, 2026-07-27:** *"It may be worth defining what the invariants of this menu
system are so we don't have to keep playing this game of whack-a-mole where fixing one thing
breaks another persistently."*

This is that definition. Nine invariants, each with the defect that proved it and the canary that
enforces it. **Every one of them was learned from a live regression** — none is speculative.

Scope: the Companion shell (`app/(embed)/triad/embed/companion/page.tsx`), the copilot that hosts
it (`app/components/codex/CodexCopilotLayer.tsx`), the nav vocabulary
(`services/companion/companionNavigation.ts`), and quick links
(`services/companion/quickLinks.ts`).

## Why whack-a-mole kept happening

Six of the nine failures below are the SAME shape: **two things describing or owning one thing,
and the stale one winning.** Two wallets, two menus, two modes, two measurements, two labels, two
signals. Each fix was correct locally and invisible to the next defect, because nothing named the
rule being broken. Naming them turns "a fix broke something else" into "a canary failed."

The second recurring shape is a **mechanism that is present but inert** — a needle that matches
nothing, an observer watching a detached node. Nothing errors; the feature simply never fires,
and it reads as "still broken" after a fix that was genuinely applied.

---

## MS-1 — One navigation

The copilot's menu row is the only navigation. No surface may render a second control for a
concept the menu already owns.

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

- **Broke it:** twice. The copilot's wallet stayed mounted after the citizen navigated away
  (2026-07-26); then `launchWallet` set private `walletPanelOpen` *and* notified the host, so
  pressing Agent Me surfaced a stale wallet over the conversation (2026-07-27).
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — `hostOwnsWalletSurface` hands the
  launch over, `walletFillsSurface` is off in that arrangement, and exactly one opener exists.

## MS-3 — One state, two views

Mode (`chat` / `avatar`) is one value. Host and copilot stay in agreement in **both** directions,
and neither may keep its own idea of which surface is active.

- **Broke it:** entering avatar via the copilot toggle left the host's `activeNavItem` frozen, so
  every later nav click wrote state the avatar branch never rendered (2026-07-26). Then the chat
  echo returned the *current* item unless it was `avatar`, so from any bodySlot surface the Agent
  Me button looked dead (2026-07-27).
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — the bidirectional sync and the
  return-to-conversation echo.

## MS-4 — Measure what is mounted

Any geometry derived from a **conditionally rendered** node must re-measure when that node
changes. A zero measurement is a teardown artifact, **never** a layout value.

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

- **Broke it:** never shipped, but the first ranking design filtered instead of ranking, which
  would have let an unrecognised page empty a surface that works fine with no observation at all.
- **Enforced by:** `tests/companion-1-1-quicklinks.test.ts` — a surface needle cannot subtract or
  widen, compared against the *unlimited* permitted set.

## MS-7 — An inert mechanism is a defect

A signal that can never fire is a bug even though nothing errors. Ship no needle, filter, or
observer without evidence that it matches something real.

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

- **Broke it:** the avatar host took its position from the panel and its size from the frame. The
  repo carries the scar tissue: an earlier commit raised six unrelated components to `z-200` to
  escape this overlay.
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — the anchor reads the frame, and
  reading the panel rect again fails.

## MS-9 — A control that cannot act must not render

Every rendered control does something on this surface. A control whose only effect is on a
different deployment is a dead control and must be gated out, not left as decoration.

- **Broke it:** the copilot's close chevron in the Companion, where the Companion's own chrome
  closes the panel — and then the over-correction that removed it from the platform copilot, where
  it is the only way to dismiss the copilot.
- **Enforced by:** `tests/companion-1-1-navigation.test.ts` — the chevron is present by default
  and gated only by `hideCloseControl`.

---

## Third-party embeds — the standing caution

The D-ID avatar SDK renders **outside** the container it is given: it injects nodes at
`document.body` level and can write `document.body.style`. No amount of styling the host wrapper
reaches them. Any third-party widget embedded in this shell must be assumed to do the same, which
means: unmount it when it is not in use, sweep its artifacts on teardown, and restore any
document-level styles it may have taken.

## Applying these

Before changing anything in the menu system, name which invariant your change relies on. If a
change would violate one, that is the discussion — not the implementation. If a new defect turns
out to fit none of these nine, it is a tenth invariant: add it here with its defect and its canary
in the same change that fixes it.
