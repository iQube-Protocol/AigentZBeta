# Lab tab restructure + Locker UX — operator ruling, 2026-07-28

**Scope:** the Venture Lab and Research Lab (IRL / IRL OS) cartridge navigation, plus the Polity
Passport Locker. Eight operator instructions, implemented on `claude/constitutional-ground-review-7yg8nb`.

**Governing constraint:** CLAUDE.md *Security — Access Gates (PARAMOUNT)*. Seven of the eight items
below either tighten a gate, move a surface without changing its gate, or change a label. **One item
deliberately widens a gate** (item 3, the Public Workspace's role restriction) and is documented in
full below, with the invariant it must not touch — cohort isolation — asserted from both sides.
**One item was explicitly investigated and NOT changed** (item 7, Steward), because widening a
ratified admin gate needs consent that does not exist.

---

## 1 — The Locker lands on credentials, collapsed, with Location last

`app/triad/components/codex/tabs/LockerTab.tsx`

- **Section order reversed at the ends.** *My Credentials & Relationships* is now the first section
  the holder sees; *Location Tracking*, which used to sit above it, is the last panel on the surface
  (below the items list, above the grant-confirm modal).
- **Every collapsible panel now defaults to COLLAPSED**: `passportCardCollapsed`, `qubeTalkCollapsed`,
  `uploadCollapsed`, `invitationCollapsed` flipped `false → true`; `peerExchangeCollapsed` was already
  `true`. Location Tracking gained a collapse state (`locationCollapsed`, default `true`) and the
  standard header-button + chevron affordance every other panel uses — the Track My Location button
  and the last-checkpoint row moved inside the collapsible body.
- **Two load-bearing safeguards preserved, and now canaried.** A collapsed-by-default surface is only
  safe because of them:
  1. A code-bearing deep link (`?x409=` / `?invite=`) still calls `setInvitationCollapsed(false)` —
     an invitee must land on a **visible** input.
  2. `uploadOpen = !uploadCollapsed || uploadBusy`, `invitationOpen = !invitationCollapsed ||
     x409ClaimBusy`, and the new `locationOpen = !locationCollapsed || locationBusy`. **A panel with
     work in flight forces itself open.** A collapsed panel hiding "Encrypting + publishing…" is a
     Terminal Outcome Observability violation — indistinguishable, from the holder's seat, from
     nothing happening.

## 2 — Workspace header renames, and what the mapping actually is

`app/triad/components/codex/tabs/PartnerProgrammesTab.tsx`

**Report first, because the operator's stated assumption did not match the tree.** The operator
assumed "the Collaborate tab is the partner/metaMe private workspace" and asked for clarity. What is
actually there:

> There is **one** venture workspace component (`PartnerProgrammesTab`) rendering **one** header
> (`{surfaceName} — {commandCenter}`), mounted by six Partner-group tabs that differ only by which
> sub-surface they pre-select. Collaborate is **not** a separate workspace — it is one *area* of the
> single workspace, alongside Overview / Operate / Evidence / Communicate / Administration. So there
> were not two workspace headers to rename; there was one, and the split had to be created.

The rename is therefore implemented as a **posture** on the one component:

| Posture | Header | Where it mounts |
|---|---|---|
| `private` (default) | **Partner Private Workspace — Pilot Command Center** | Partner group (Collaborate, Operate, Evidence, Communicate, Administration) |
| `public` | **Partner Public Workspace — Pilot Command Center** | Participate group → *Public Workspace* |

`KIND_COPY[kind].surfaceName` became `Record<WorkspaceVisibility, string>`. The Research Lab has no
such split (no ruling asked for one), so both of its entries are "Research Workspace" — stated
explicitly rather than defaulted, so a future research split is a deliberate edit.

## 3 — The Public Workspace moves from Partner into Participate (the structural change)

`data/codex-configs.ts`, `VENTURE_LAB_CODEX`

- The workspace **Overview** surface — the tab formerly labelled *Partner Workspace*
  (`id`/`slug` `partner-programmes`) — **moved from `group: 'partner'` to `group: 'participate'`**,
  relabelled **"Public Workspace"**. Partner-agnostic by instruction: it names no partner.
- **`participate` and `partner` swapped position**: `participate` 3.5, `partner` 3.7.
- The Partner group's remaining tabs renumbered 0–4 (Collaborate, Operate, Evidence, Communicate,
  Administration).
- **Horizen is not hardcoded, and must never be.** The qualifying workspace(s) resolve from the
  caller's own cohort grants (`scopesGrantedIn` over `PARTNER_WORKSPACES`) inside the component; the
  pilot selector chip is the mechanism that lets one partner-agnostic tab serve N partners. That
  today only Horizen qualifies falls out of the **data**, not out of a conditional.

### The one gate this ruling widens, stated plainly

`participationRoles: ['partner-operator', 'workspace-steward']` was **dropped** from the moved tab.
A plain `venture-participant` or `observer` scoped to a pilot can now reach the Public Workspace.
That is the operator's specification ("every user with Venture Lab access gets an iteration of it").

**What did NOT change, and is asserted from both sides:**

- `participationDomain: 'venture-lab'` is **kept** — a caller with no venture-lab grant still sees
  nothing.
- **Cohort isolation is untouched.** Workspace content is scope-filtered per caller
  (`satisfiesWorkspaceScope` / `scopesGrantedIn`, deny-by-default) and re-enforced server-side in
  `/api/venture/workspace/[workspaceId]`. The tab may be visible while it resolves to "no qualifying
  workspace"; one cohort seeing another's public workspace remains impossible.
- **A public-posture clamp** (`PUBLIC_SURFACES = ['overview']`) was added as defence in depth: the
  public entrance cannot open Collaborate / Operate / Evidence / Communicate / Administration even if
  a future config edit mis-set `initialSurface`.
- **Amendment G's role restriction still holds in full over the Partner group**, which is what it was
  written to protect.

### Partner is invisible, not merely empty

Every remaining Partner tab carries either `participationRoles` (Tier 2) or `adminOnly` (Tier 0), so
`CodexPanelDynamic`'s `visibleGroups` drops the group entirely for anyone else (MS-9 — a control that
cannot act must not render). No group-level `adminOnly` was added: that would also hide it from the
partner operators it exists for.

## 4 — Administer's admin check: **verified, no change required**

`administer` carries `adminOnly: true` at group level. Traced end to end:

- `CodexPanelDynamic` → `visibleGroups`: `if (g.adminOnly && !isAdmin) return false`, where
  `const isAdmin = isAdminProp === true` — the caller-supplied **platform** flag, fed from the
  server-resolved `cartridgeFlags.isAdmin`.
- `getEnabledTabs` → `if (tab.adminOnly && !isAdmin) return false`. The per-cartridge grant set
  travels in a **separate** argument (`cartridgeAdminGrants`) consulted **only** for
  `adminOfCartridge`.

**No `cartridgeFlags.adminCartridges` entry — partner or otherwise — can open the Administer group.**
No tightening was needed. The separation is now pinned by a canary so a future edit cannot fold the
two admin notions together. Every tab inside the group is *also* individually `adminOnly`, which
matters because the group gate lives only in `visibleGroups` — a direct `?tab=` deep link bypasses
the chip.

## 5 — AgentiQ OS α moves from Administer to Grow, and becomes public

`agentiq-os-vl`: `group: 'administer' → 'grow'`, `order: 0 → 2`, `adminOnly: true → false`. It is a
public builder-substrate dashboard; the gate was mis-scoping, not protection. Grow now holds Growth
Matrix (0, public), α Programme (1, adminOnly), AgentiQ OS α (2, public). The slug is unchanged, so
the Partner registry deep link that targets `agentiq-os-vl` still resolves.

## 6 — Passport Registry removed from both Labs

Deleted `irl-passport-registry` (`IRL_CARTRIDGE`) and `irl-os-passport-registry`
(`IRL_OS_CARTRIDGE`). The public record keeps four other homes: AgentiQ (`passport-registry`),
AgentiQ OS (`os-passport-registry`), the iQube registry (`passports`), and the Passport Bureau
(`registry`).

**One inbound deep link found and fixed:** `passportDeepLinks().registry` in
`services/constitutional/guidedOnboarding.ts` pointed at `irl-os?tab=irl-os-passport-registry` and now
points at `agentiq-os?tab=os-passport-registry` — the same open, public-facing edition IRL OS is. The
doc that mirrors that table (`codexes/packs/irl/foundation/CFS-043a_guided-onboarding-script.md`) was
updated to match. This matters because a dangling `?tab=` **does not error** — the embed silently
lands the principal on the cartridge's default tab.

## 7 — Steward: **investigated, deliberately not widened**

The operator asked that Steward "only be visible/rendered to parties who have authorized access.
Those without should not see it at all."

**Finding: it is already correct.** `venture-participate-steward` and `irl-passport-steward` (and
`irl-os-passport-steward`) are all `adminOnly: true`. `getEnabledTabs` drops an `adminOnly` tab for
any non-admin **before** any participation gate runs, so no grant of any kind can open it — including
a `workspace-steward` grant scoped to a real pilot. MS-9 suppresses it correctly, and does **not**
take the surrounding Participation group down with it: an ordinary participant still sees the other
five/six surfaces.

**No visibility bug was found, so nothing was changed.** Widening it to grant-holding stewards would
be a widening of a ratified admin gate held by two ratified canaries
(`tests/tier-surface-map.test.ts`, `tests/partner-workspace.test.ts`) plus the operator's own
2026-07-28 ruling "VL — Steward should be admin gated"; that needs explicit consent this session does
not have. **Neither ratified canary was touched.**

The delegated-steward capability the server already supports (`/api/steward/participation` derives a
tier from the caller's grants) is reached through a **different** surface — the Partner group's
Collaborate view, which mounts the same `StewardParticipationTab` on the venture domain. Two tiers,
two surfaces; widening this tab would have collapsed them back onto one.

## 8 — "Services" → "Service"; "Financial" → "Financial Services"

Tab-group labels are **verbs** (Operate, Connect, Service, Grow, Participate, Partner, Administer), so
the group label lost its plural. The sub-tab `vl-services-financial` became **"Financial Services"** —
the operator's word: *epistemically coherent*. The 2026-07-28 comment recording the superseded plural
ruling was **rewritten** to record the new one rather than left contradicting the code (a stale
comment beside changed code teaches the next agent to "fix" the code back).

---

## Canaries

| File | What it holds |
|---|---|
| `tests/venture-lab-cohort-isolation.test.ts` | **canary 10** — Partner is *invisible* (not empty) to a non-partner venture-lab member, and *visible* to a partner operator and to an admin, as exact literal slug sets through the real `getEnabledTabs` filter plus the verbatim MS-9 predicate. **canary 11** — the Public Workspace is reachable by a plain participant (tab gate *and* workspace picker, same caller), unreachable without a grant, and still cohort-isolated. |
| `tests/lab-tab-restructure-and-locker-ux.test.ts` (new) | Blocks A–G: the platform-vs-cartridge admin separation; AgentiQ OS α public in Grow; the Passport Registry removal *and* that the record still has a home *and* that every guided-onboarding deep link resolves; the Steward verification from both sides; Service/Financial Services; the public-posture clamp; the Locker order, defaults, deep-link expand, and busy-forces-open. |
| `tests/partner-workspace.test.ts` | **Re-pointed**, not loosened: the Partner group's tab list, the Participate↔Partner swap asserted from both sides, the seven-member Participate set, and a new assertion that no Partner tab may declare the public posture. |
| `tests/research-lab-workspace.test.ts` | **Re-pointed** canary R8: both venture expressions must name themselves, the public one must not name a partner, and the header must read the visibility-keyed entry. |

Suite: **178 files / 2813 tests green** (baseline 176 / 2759). `tsc --noEmit` clean apart from the two
pre-existing config errors.

### Mutation table

Every canary added or re-pointed was mutation-tested: apply the violation, confirm the canary FAILS,
restore, confirm it PASSES. **29 of 29 real mutations caught. One canary initially survived its own
mutation and was strengthened.**

| # | Mutation | Caught by |
|---|---|---|
| M1 | drop `participationRoles` from `partner-collaborate` | cohort-isolation c10 |
| M2 | make `partner-communicate` non-admin (ungated Tier-0 tab) | cohort-isolation c10 |
| M3 | admin-gate `partner-collaborate` (a Tier-2 view goes dark) | cohort-isolation c10 *(see note)* |
| M4 | restore `participationRoles` on the Public Workspace | cohort-isolation c11, R8 |
| M5 | drop `participationDomain` from the Public Workspace | c11, R8, partner-workspace |
| M6 | relabel Public Workspace back to "Partner Workspace" | c11, R8, partner-workspace |
| M7 | move the Public Workspace back into Partner | c11, R8, partner-workspace |
| M8 | let a cartridge-admin grant satisfy `adminOnly` | restructure A |
| M9 | un-gate `alpha-docs` inside the adminOnly Administer group | restructure A |
| M10 | re-gate AgentiQ OS α as `adminOnly` | restructure B |
| M11 | move AgentiQ OS α back to Administer | restructure B |
| M12 | re-add the removed `irl-passport-registry` tab | restructure C |
| M13 | point the onboarding registry link back at the removed tab | restructure C |
| M14 | un-gate the Venture Lab Steward tab | restructure D, partner-workspace |
| M15 | admin-gate the Participate *Apply* tab | restructure D, partner-workspace |
| M16 | revert the Service group label to the superseded plural | restructure E |
| M17 | revert the sub-tab label to "Financial" | restructure E |
| M18 | admit `collaborate` into the public surface allowlist | restructure F |
| M19 | stop applying the clamp to the opened surface | restructure F |
| M20 | default the Location panel to expanded | restructure G |
| M21 | drop the busy-forces-open guard on Location | restructure G |
| M22 | stop the invitation deep link expanding the panel | restructure G |
| M23 | re-expand the credentials panel by default | restructure G |
| M24 | disable the `partner-evidence` tab (a Tier-2 view vanishes) | c10, partner-workspace |
| M25 | add an **ungated** tab to the Partner group | cohort-isolation c10 |
| M26 | disable a Participate surface (Standing vanishes) | c11, restructure D, partner-workspace |
| M27 | hardcode the header to the private name | R8, restructure F |
| M28 | swap the group order back (Partner ahead of Participate) | partner-workspace |
| M29 | rename the public surface header string | R8 |
| M30 | *(negative control)* change a Locker **comment** only | correctly **not** caught — the order canary reads the rendered heading, not prose |

**M3 initially SURVIVED**, and is the lesson worth keeping. Canary 10's positive-reachability
assertion originally derived its expected set from the config with `!t.adminOnly` — the *same*
predicate the filter under test uses. Admin-gating a Tier-2 view removed it from the expected set and
the actual set together, so the canary stayed green while the surface went dark for the operator it
exists for. This is the **tautological comparison** failure mode. Fixed by writing the expected set
out as a literal slug list; the same fix was applied pre-emptively to the admin case and to canary
11's Participate set, and M24/M25/M26 were added to prove a tab vanishing, a tab being added, and a
tab being gated are each now visible to the suite.

---

## Files changed

| File | Item |
|---|---|
| `app/triad/components/codex/tabs/LockerTab.tsx` | 1 |
| `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` | 2, 3 |
| `data/codex-configs.ts` | 3, 4, 5, 6, 8 |
| `services/constitutional/guidedOnboarding.ts` | 6 |
| `codexes/packs/irl/foundation/CFS-043a_guided-onboarding-script.md` | 6 |
| `tests/venture-lab-cohort-isolation.test.ts` | canaries 10, 11 |
| `tests/lab-tab-restructure-and-locker-ux.test.ts` *(new)* | canaries A–G |
| `tests/partner-workspace.test.ts` | re-pointed |
| `tests/research-lab-workspace.test.ts` | re-pointed |

## Flagged rather than decided

- **Item 2's premise did not exist.** There was one workspace header, not two. The private/public
  split was created rather than renamed; the operator's assumption about Collaborate is recorded
  above with what is actually there.
- **Item 3 is a genuine widening**, not a pure move. It is the operator's explicit instruction and is
  implemented with the narrowest possible blast radius (domain gate kept, cohort isolation untouched,
  public surface set clamped to Overview), but it should be read as an access-model change and not as
  navigation tidying.
- **Item 7 was not implemented**, by design. If the operator does want delegated stewards to see the
  Steward tab, that is a separate, explicitly-consented change to a ratified gate — and it would also
  need the two ratified canaries re-pointed rather than deleted.
