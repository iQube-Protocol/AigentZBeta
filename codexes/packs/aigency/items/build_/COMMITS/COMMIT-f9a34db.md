# Commit Brief: `f9a34db` — register TabRendererFallback component + add Admin under Marketa Partner

| Field | Value |
|-------|-------|
| SHA | [`f9a34db`](https://github.com/iQube-Protocol/AigentZBeta/commit/f9a34dbad05f7767c10c357a53959f39415c7355) |
| Author | Claude |
| Date | 2026-05-26T10:09:35Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
register TabRendererFallback component + add Admin under Marketa Partner

Two related fixes.

1) TabRendererFallback registered (was missing)
-----------------------------------------------
6 codex-config tabs reference component 'TabRendererFallback' as a
no-op parent for tabs that exist purely to hold subTabs (Order of
Metayé, the new KNYT order-admin, Marketa partner-admin, etc.). The
component was never registered in TabRenderer.componentRegistry, so
when an operator landed on one of those surfaces the panel rendered
the red "Component not found: TabRendererFallback" placeholder
instead of the sub-tab nav.

Adds a minimal TabRendererFallback component to the registry — when
a parent tab renders without a selected subTab, it shows "Select a
sub-tab to continue." In the normal flow, CodexPanelDynamic's
tier-3 nav auto-selects subTabs[0], so this fallback is just the
safety net for the (currently impossible) zero-subTab case.

Bug surfaced 2026-05-26 when the operator landed on KNYT's Order
group after the prior commit added 'order-admin' there. Pre-existing
references on other surfaces were silently broken too — they just
didn't fire because no one navigated there.

2) Marketa cartridge: Admin under Partner group
-----------------------------------------------
Same chief-of-staff pattern as KNYT cartridge's Order > Admin: new
'partner-admin' tab inside Marketa's Partner tabGroup, gated by
adminOfCartridge: 'marketa'. Lazy getter pulls the existing admin
group tabs (Dashboard, Campaign Ops, Launch Ops, Partners, Approval
Queue, Reports, Publish, QubeTalk) and clones each with adminOnly
dropped + adminOfCartridge applied + slug prefixed. Tier-3 nav
renders them as sub-sub-tabs.

Visibility outcomes
-------------------
- Persona admin of Marketa (cartridgeFlags.adminCartridges includes
  'marketa', OR cartridgeFlags.isAdmin true): sees Admin sub-tab in
  the Partner group with full admin sub-nav.
- Non-admin: Admin sub-tab silently hidden.
- Global uber/platform admins satisfy the gate too.

Same operator-stated rationale: founder operators with Marketa
admin access see the full admin surface through their natural
partner-facing navigation, not as a separate top-level group.
```

## Body

Two related fixes.

1) TabRendererFallback registered (was missing)
-----------------------------------------------
6 codex-config tabs reference component 'TabRendererFallback' as a
no-op parent for tabs that exist purely to hold subTabs (Order of
Metayé, the new KNYT order-admin, Marketa partner-admin, etc.). The
component was never registered in TabRenderer.componentRegistry, so
when an operator landed on one of those surfaces the panel rendered
the red "Component not found: TabRendererFallback" placeholder
instead of the sub-tab nav.

Adds a minimal TabRendererFallback component to the registry — when
a parent tab renders without a selected subTab, it shows "Select a
sub-tab to continue." In the normal flow, CodexPanelDynamic's
tier-3 nav auto-selects subTabs[0], so this fallback is just the
safety net for the (currently impossible) zero-subTab case.

Bug surfaced 2026-05-26 when the operator landed on KNYT's Order
group after the prior commit added 'order-admin' there. Pre-existing
references on other surfaces were silently broken too — they just
didn't fire because no one navigated there.

2) Marketa cartridge: Admin under Partner group
-----------------------------------------------
Same chief-of-staff pattern as KNYT cartridge's Order > Admin: new
'partner-admin' tab inside Marketa's Partner tabGroup, gated by
adminOfCartridge: 'marketa'. Lazy getter pulls the existing admin
group tabs (Dashboard, Campaign Ops, Launch Ops, Partners, Approval
Queue, Reports, Publish, QubeTalk) and clones each with adminOnly
dropped + adminOfCartridge applied + slug prefixed. Tier-3 nav
renders them as sub-sub-tabs.

Visibility outcomes
-------------------
- Persona admin of Marketa (cartridgeFlags.adminCartridges includes
  'marketa', OR cartridgeFlags.isAdmin true): sees Admin sub-tab in
  the Partner group with full admin sub-nav.
- Non-admin: Admin sub-tab silently hidden.
- Global uber/platform admins satisfy the gate too.

Same operator-stated rationale: founder operators with Marketa
admin access see the full admin surface through their natural
partner-facing navigation, not as a separate top-level group.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Modified | `data/codex-configs.ts` |

## Stats

 2 files changed, 57 insertions(+)
