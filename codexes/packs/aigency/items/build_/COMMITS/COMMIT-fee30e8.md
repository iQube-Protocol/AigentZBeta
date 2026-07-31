# Commit Brief: `fee30e8` — admin-tab in activation: per-cartridge gating + KNYT Admin mirror in metaMe

| Field | Value |
|-------|-------|
| SHA | [`fee30e8`](https://github.com/iQube-Protocol/AigentZBeta/commit/fee30e88bce10907854907a0e33b746680af0c06) |
| Author | Claude |
| Date | 2026-05-26T03:44:02Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
admin-tab in activation: per-cartridge gating + KNYT Admin mirror in metaMe

Closes the chief-of-staff unlock for founder-operator personas. A
persona who admins cartridge Y now sees Y's Admin tab — with full
sub-nav — inside metaMe's corresponding Activation sub-surface, while
non-admins see nothing.

First wiring: KNYT Admin surfaced inside metaMe's Order of Metayé
group. Pattern is repeatable for any cartridge with an adminOnly: true
top-level tabGroup (Qriptopian, AgentiQ OS, future Venture Lab admin
tab). Protocol + backlog: codexes/packs/agentiq/updates/2026-05-26_admin-tab-in-activation-backlog.md.

Type extension
--------------
types/codex.ts — CodexTab gains an optional `adminOfCartridge?: string`
field. When set, the tab is visible ONLY when the active persona is
admin of the named cartridge (slug match against the grants returned
by /api/persona/cartridge-admin-grants). Independent of `adminOnly`.
A global uber/platform admin satisfies any adminOfCartridge gate.

Filter pipeline
---------------
app/hooks/useCodexConfig.ts — getEnabledTabs gains a fifth optional
arg `cartridgeAdminGrants: { isGlobalAdmin, cartridgeSlugs }`. Tabs
declaring adminOfCartridge are hidden unless the persona holds a
global role OR has the explicit grant. Default is the empty no-grants
posture (every adminOfCartridge tab hidden) — fail-closed.

Client hook
-----------
app/hooks/useCartridgeAdminGrants.ts — fetches the grant set from
the new route. Returns empty grants during loading / on error so the
mirrored admin tab stays hidden for non-admin personas during the
brief fetch window — fail-closed at the UI layer too.

Panel wiring
------------
app/triad/components/CodexPanelDynamic.tsx
- Wires the hook + threads grants into getEnabledTabs.
- Extends the activeSubTabs filter so subTabs honour the same
  adminOfCartridge gate. Defense in depth — a mis-configured parent
  tab cannot accidentally surface gated children.

KNYT Admin mirror in METAME_CODEX
---------------------------------
data/codex-configs.ts
- New knytAdminTabsForMetameOrder() helper clones the KNYT cartridge's
  admin tabs (KnytAlphaTab, KnytStoreAdminTab, KnytTreasuryAdminTab,
  KnytCommunityContentAdminTab, KnytTasksRewardsAdminTab,
  KnytCodexAdminTab, InvestorDirectoryTab, RelationshipBuilderTab,
  etc.) with:
    - `adminOnly` dropped — the global-admin gate is replaced by the
      per-cartridge gate so KNYT cartridge admins who aren't global
      admins still see the surface (the whole point of this unlock).
    - `adminOfCartridge: 'knyt-codex'` set on every cloned child.
    - `group: 'order'` reassigned.
    - `slug` prefixed with 'knyt-admin-' to avoid collisions inside
      metaMe's own tab namespace.
- New "KNYT Admin" tab added to METAME_CODEX's order group as a
  sibling to "Order of Metayé". Carries the same adminOfCartridge
  gate and `subTabs: knytAdminTabsForMetameOrder()`. The activation
  gate (order-of-metaye) still applies, so the tab also requires the
  Order of Metayé activation to be on.

Visibility outcomes
-------------------
- Non-admin persona: order group has 1 tab (Order of Metayé). Tier-3
  sub-tabs (knytOrderTabs) render via the single-tab-group inline
  path — unchanged behaviour.
- KNYT admin persona: order group has 2 tabs (Order of Metayé +
  KNYT Admin). Tier-2 sibling nav renders both; selecting KNYT
  Admin reveals the cloned admin sub-tabs as tier-3 (requires the
  prior commit's separate tier-3 row fix to render — both ship in
  this train).

Backlog (2026-05-26_admin-tab-in-activation-backlog.md)
-------------------------------------------------------
- Tenant ↔ cartridge slug mapping refinement (multi-tenant cartridges)
- aigentMe recommender data context extension (Q4 fast-follow)
- Admin tree alignment (uber / franchise / tenant ↔ cartridge spec)
- Server-side admin endpoint per-cartridge enforcement
- UI affordance for admin-tab visual treatment
```

## Body

Closes the chief-of-staff unlock for founder-operator personas. A
persona who admins cartridge Y now sees Y's Admin tab — with full
sub-nav — inside metaMe's corresponding Activation sub-surface, while
non-admins see nothing.

First wiring: KNYT Admin surfaced inside metaMe's Order of Metayé
group. Pattern is repeatable for any cartridge with an adminOnly: true
top-level tabGroup (Qriptopian, AgentiQ OS, future Venture Lab admin
tab). Protocol + backlog: codexes/packs/agentiq/updates/2026-05-26_admin-tab-in-activation-backlog.md.

Type extension
--------------
types/codex.ts — CodexTab gains an optional `adminOfCartridge?: string`
field. When set, the tab is visible ONLY when the active persona is
admin of the named cartridge (slug match against the grants returned
by /api/persona/cartridge-admin-grants). Independent of `adminOnly`.
A global uber/platform admin satisfies any adminOfCartridge gate.

Filter pipeline
---------------
app/hooks/useCodexConfig.ts — getEnabledTabs gains a fifth optional
arg `cartridgeAdminGrants: { isGlobalAdmin, cartridgeSlugs }`. Tabs
declaring adminOfCartridge are hidden unless the persona holds a
global role OR has the explicit grant. Default is the empty no-grants
posture (every adminOfCartridge tab hidden) — fail-closed.

Client hook
-----------
app/hooks/useCartridgeAdminGrants.ts — fetches the grant set from
the new route. Returns empty grants during loading / on error so the
mirrored admin tab stays hidden for non-admin personas during the
brief fetch window — fail-closed at the UI layer too.

Panel wiring
------------
app/triad/components/CodexPanelDynamic.tsx
- Wires the hook + threads grants into getEnabledTabs.
- Extends the activeSubTabs filter so subTabs honour the same
  adminOfCartridge gate. Defense in depth — a mis-configured parent
  tab cannot accidentally surface gated children.

KNYT Admin mirror in METAME_CODEX
---------------------------------
data/codex-configs.ts
- New knytAdminTabsForMetameOrder() helper clones the KNYT cartridge's
  admin tabs (KnytAlphaTab, KnytStoreAdminTab, KnytTreasuryAdminTab,
  KnytCommunityContentAdminTab, KnytTasksRewardsAdminTab,
  KnytCodexAdminTab, InvestorDirectoryTab, RelationshipBuilderTab,
  etc.) with:
    - `adminOnly` dropped — the global-admin gate is replaced by the
      per-cartridge gate so KNYT cartridge admins who aren't global
      admins still see the surface (the whole point of this unlock).
    - `adminOfCartridge: 'knyt-codex'` set on every cloned child.
    - `group: 'order'` reassigned.
    - `slug` prefixed with 'knyt-admin-' to avoid collisions inside
      metaMe's own tab namespace.
- New "KNYT Admin" tab added to METAME_CODEX's order group as a
  sibling to "Order of Metayé". Carries the same adminOfCartridge
  gate and `subTabs: knytAdminTabsForMetameOrder()`. The activation
  gate (order-of-metaye) still applies, so the tab also requires the
  Order of Metayé activation to be on.

Visibility outcomes
-------------------
- Non-admin persona: order group has 1 tab (Order of Metayé). Tier-3
  sub-tabs (knytOrderTabs) render via the single-tab-group inline
  path — unchanged behaviour.
- KNYT admin persona: order group has 2 tabs (Order of Metayé +
  KNYT Admin). Tier-2 sibling nav renders both; selecting KNYT
  Admin reveals the cloned admin sub-tabs as tier-3 (requires the
  prior commit's separate tier-3 row fix to render — both ship in
  this train).

Backlog (2026-05-26_admin-tab-in-activation-backlog.md)
-------------------------------------------------------
- Tenant ↔ cartridge slug mapping refinement (multi-tenant cartridges)
- aigentMe recommender data context extension (Q4 fast-follow)
- Admin tree alignment (uber / franchise / tenant ↔ cartridge spec)
- Server-side admin endpoint per-cartridge enforcement
- UI affordance for admin-tab visual treatment

## Files Changed

| Change | File |
|--------|------|
| Added | `app/hooks/useCartridgeAdminGrants.ts` |
| Modified | `app/hooks/useCodexConfig.ts` |
| Modified | `app/triad/components/CodexPanelDynamic.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-05-26_admin-tab-in-activation-backlog.md` |
| Modified | `data/codex-configs.ts` |
| Modified | `types/codex.ts` |

## Stats

 7 files changed, 285 insertions(+), 4 deletions(-)
