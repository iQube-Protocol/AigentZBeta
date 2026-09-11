# Companion live-drive fixes — dead controls, and consent as its own destination

**Date:** 2026-07-26
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Source:** operator drive of the Companion side panel (five reports + one request)
**Status:** shipped to dev — one item needs ratification, one needs an operator ruling

---

## The shape the defects shared

Four of the five reports were the same failure in different places: **a control that
looks present and does nothing.** Dead search, dead wallet, vanished menu, dead chevron.
That failure mode is worse than a missing control, because the citizen blames themselves
before they blame the surface.

## 1. Search did nothing — a hook spliced into a helper

`components/companion/CompanionSearchPanel.tsx` had the `useEffect` that actually runs the
search **spliced into the body of `readErrorMessage`**, a module-level async helper, inside
an `if`. A botched edit, not a design error.

Consequence: submitting a query set `searchQuery` and *nothing else happened* — `runSearch`
had no caller. Had that helper ever been reached (a non-OK response), calling a hook outside
render would have thrown instead. The effect now lives in the component.

## 2. The avatar stranded the citizen

`navExtras` — the migrated Companion nav (Search / Workspace / Overlay / Activity /
Permissions) — rendered **only in the copilot's `chat` branch**. Entering avatar mode took
the whole menu with it, leaving no way back but the chat toggle.

The avatar is another renderer of the *same* session (SCOPE-MMC-004 D-8), not a separate
surface, so the navigation has to survive the mode change. It now renders in both branches.

## 3. The wallet was dead after visiting any other surface

Two sources of truth for "which surface is showing". The copilot's own wallet button set
only its internal `walletPanelOpen`; the Companion's `bodySlot` deliberately takes
precedence over the wallet (a fix from earlier the same day). So once the citizen had
visited Search — or any other surface — pressing Wallet changed state nothing could render.

Every wallet open in `CodexCopilotLayer` now routes through one `launchWallet()` helper,
which notifies an optional `onWalletLaunch` host callback. The Companion passes
`() => setActiveNavItem("wallet")`, so the copilot's wallet state and the host's chosen
surface move together. Hosts that don't pass it behave exactly as before.

Reported as a consequence of the failing search button; the causal link is the *surface
visit*, not the failure. Both are fixed regardless.

## 4. The dead chevron is gone, and Permissions took its slot

The chevron in the chat footer called `onClose`, which is a no-op where the copilot **is**
the shell. The avatar footer had already dropped it; the chat footer had not.

**Observer permissions is now its own nav item** (`permissions`, `ShieldCheck`, label
"Permissions") rather than a section rendered below the activity Timeline. Same
`ObserverGrantPanel`, same gate — only its home changed. The reason is not tidiness:
consent reached by scrolling past a feed of what was already observed is consent presented
as an appendix to its own consequences.

**⚠️ NEEDS RATIFICATION.** SCOPE-MMC-004 §4.3 ratified a **seven-item** vocabulary and
`COMPANION_NAV_ITEMS` is described in its own header as "a single frozen tuple". This adds
an eighth. The canary now pins the eight-item list and says so in its comment — please
ratify the extension or tell me to fold Permissions back under Activity.

## 5. Search relabelled — with a correction you should see

`COMPANION_NAV_LABEL.search` is now **"Search Registry"** as instructed.

**The label understates the surface.** `services/companion/searchFederation.ts` federates
over research, the iQube registry, registry assets, registry libraries, the capability
graph, mySoftware and MoneyPenny — seven sources, of which the registry is three. The
panel's own empty state still says "Search across research, the registry, and the
capability graph."

Kept as set, with the discrepancy recorded in a comment at the definition. If you want it
accurate, "Search" or "Search Platform" both match what it does; say the word and it changes.

## 6. Quick actions are now observer-driven

Quick links read the observed page's `shape` from `GET /api/companion/overlay` — the **same
observation the Overlay surface already renders**. No new observation, no new permission,
no new read (§6.1: a shipped signal informing a second surface).

Two properties make it safe, both canaried:

- **Context RANKS, never filters.** Matching links are offered first; the rest still fill
  the limit behind them. A filter would let an observation *subtract* the citizen's quick
  links, so landing on an unrecognised page would empty a surface that works fine with no
  observation at all — an observation making the citizen worse off. (Structurally the same
  base-vs-overlay error fixed in the constitutional-ground work earlier today.)
- **Context cannot widen.** Ranking runs after `quickLinkVisibility`, so an observation can
  never promote a surface the persona may not see. Gating is untouched.

The shape→needle table is small and explicit (`github-repo` → software, `financial-context`
→ wallet), mirroring `overlayMapping.ts`'s own discipline: an unmapped shape abstains
rather than guessing a topic.

This is deliberately the small version you asked for. A fuller treatment — ranking on the
observed page *title* and the active surface, not just the domain shape — is the obvious
next step and is not built.

## Canaries

12 new, in `tests/companion-1-1-navigation.test.ts` and `tests/companion-1-1-quicklinks.test.ts`.
The load-bearing one is negative: **an observation never changes how many quick links are
offered.** Also: the search effect is inside the component and not inside the error helper;
`navExtras` renders in ≥2 mode branches; exactly one `setWalletPanelOpen(true)` exists (the
one inside `launchWallet`); no `onClick={onClose}` chevron survives; the grant panel is not
inside the activity surface.

Full suite: 136 files / 1753 tests green.
