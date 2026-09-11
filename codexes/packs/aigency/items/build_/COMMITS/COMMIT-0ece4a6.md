# Commit Brief: `0ece4a6` — KNYT owns Admin under Order — metaMe inherits via existing mirror

| Field | Value |
|-------|-------|
| SHA | [`0ece4a6`](https://github.com/iQube-Protocol/AigentZBeta/commit/0ece4a625172abbbcd274f680b1e920fd517ea66) |
| Author | Claude |
| Date | 2026-05-26T08:55:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
KNYT owns Admin under Order — metaMe inherits via existing mirror

Per operator suggestion 2026-05-26 ("Maybe the thing to do is make
Admin tab visible as Order sub menu item in KNYT cartridge then it is
simply passed through with KNYT cartridge"). Moves the inclusion
logic for the chief-of-staff admin surface OUT of metaMe (where it
was a bespoke mirror) and INTO KNYT, where it's native.

Cleaner because:
- KNYT cartridge is the source-of-truth for its own admin surface.
  metaMe stays generic — it just mirrors KNYT's order-group via the
  existing knytOrderTabs() helper. No metaMe-side knowledge of KNYT's
  admin structure required.
- The same Admin sub-menu now appears in TWO places consistently:
  inside KNYT itself (Order > Admin) AND inside metaMe (Order of
  Metayé > Admin via the mirror). Single declaration, two surfaces.
- Future cartridges that want the same chief-of-staff surface just
  declare Admin natively under their analogous "main" group; if
  metaMe mirrors that group, the admin flows through for free.

Changes
-------
KNYT_CODEX (data/codex-configs.ts):
- New order-group tab `order-admin` ("Admin") with
  adminOfCartridge: 'knyt-codex'. The per-cartridge gate stays
  intact — tenant-admins of KNYT see it (via spine), uber-admins
  satisfy the gate too, non-admins never see it.
- subTabs uses a lazy getter that filters KNYT_CODEX.tabs by
  group === 'admin' && enabled and clones each with adminOnly
  dropped + adminOfCartridge set + slug prefixed. Defense in depth
  applies to children (activeSubTabs filter mirrors the gate).
  Lazy getter required because the const refers to itself; by the
  time CodexPanelDynamic reads `tab.subTabs` at render time,
  KNYT_CODEX is fully constructed.

METAME_CODEX:
- Removed the bespoke `order-knyt-admin` tab (with its
  `subTabs: knytAdminTabsForMetameOrder()`) — now redundant. The
  existing knytOrderTabs() mirror already includes the new
  order-admin tab from KNYT_CODEX.
- Removed the knytAdminTabsForMetameOrder() helper. Qripto + AIQ-OS
  + VL mirrors are untouched — those cartridges don't have an
  analogous "Order" sub-surface that metaMe mirrors directly, so
  the bespoke metaMe-side helpers remain the cleanest path for now.

No canary changes. All 33 admin-related canaries still pass
(spine-admin-cartridges 10/10 + cartridge-admin-grants 12/12 +
persona-broadcast-handshake 11/11). The per-cartridge gating contract
the spine canaries lock is unchanged — only the placement of the
gated tab moved from metaMe-side to KNYT-side.

Visibility outcomes
-------------------
- Persona admin of KNYT (via spine cartridgeFlags.adminCartridges
  containing 'knyt-codex'): sees the Admin sub-item under Order in
  BOTH the KNYT cartridge AND inside metaMe's Order of Metayé
  tier-3 nav. The KNYT admin sub-tabs render via the existing
  tier-3 mechanism.
- Global uber/platform admin: same as above (cartridgeFlags.isAdmin
  satisfies the gate).
- Non-admin: order-group renders without the Admin sub-item. No
  rendered placeholder, no flash, no leak. Same fail-closed posture.

If the admin tab still doesn't show after this lands: the spine
likely isn't returning adminCartridges containing 'knyt-codex' for
the persona. Hit /api/admin/diag/cartridge-admin-grants to see
exactly where the resolution chain fails — the hint field walks the
operator through the most likely root cause given the dumped data.
```

## Body

Per operator suggestion 2026-05-26 ("Maybe the thing to do is make
Admin tab visible as Order sub menu item in KNYT cartridge then it is
simply passed through with KNYT cartridge"). Moves the inclusion
logic for the chief-of-staff admin surface OUT of metaMe (where it
was a bespoke mirror) and INTO KNYT, where it's native.

Cleaner because:
- KNYT cartridge is the source-of-truth for its own admin surface.
  metaMe stays generic — it just mirrors KNYT's order-group via the
  existing knytOrderTabs() helper. No metaMe-side knowledge of KNYT's
  admin structure required.
- The same Admin sub-menu now appears in TWO places consistently:
  inside KNYT itself (Order > Admin) AND inside metaMe (Order of
  Metayé > Admin via the mirror). Single declaration, two surfaces.
- Future cartridges that want the same chief-of-staff surface just
  declare Admin natively under their analogous "main" group; if
  metaMe mirrors that group, the admin flows through for free.

Changes
-------
KNYT_CODEX (data/codex-configs.ts):
- New order-group tab `order-admin` ("Admin") with
  adminOfCartridge: 'knyt-codex'. The per-cartridge gate stays
  intact — tenant-admins of KNYT see it (via spine), uber-admins
  satisfy the gate too, non-admins never see it.
- subTabs uses a lazy getter that filters KNYT_CODEX.tabs by
  group === 'admin' && enabled and clones each with adminOnly
  dropped + adminOfCartridge set + slug prefixed. Defense in depth
  applies to children (activeSubTabs filter mirrors the gate).
  Lazy getter required because the const refers to itself; by the
  time CodexPanelDynamic reads `tab.subTabs` at render time,
  KNYT_CODEX is fully constructed.

METAME_CODEX:
- Removed the bespoke `order-knyt-admin` tab (with its
  `subTabs: knytAdminTabsForMetameOrder()`) — now redundant. The
  existing knytOrderTabs() mirror already includes the new
  order-admin tab from KNYT_CODEX.
- Removed the knytAdminTabsForMetameOrder() helper. Qripto + AIQ-OS
  + VL mirrors are untouched — those cartridges don't have an
  analogous "Order" sub-surface that metaMe mirrors directly, so
  the bespoke metaMe-side helpers remain the cleanest path for now.

No canary changes. All 33 admin-related canaries still pass
(spine-admin-cartridges 10/10 + cartridge-admin-grants 12/12 +
persona-broadcast-handshake 11/11). The per-cartridge gating contract
the spine canaries lock is unchanged — only the placement of the
gated tab moved from metaMe-side to KNYT-side.

Visibility outcomes
-------------------
- Persona admin of KNYT (via spine cartridgeFlags.adminCartridges
  containing 'knyt-codex'): sees the Admin sub-item under Order in
  BOTH the KNYT cartridge AND inside metaMe's Order of Metayé
  tier-3 nav. The KNYT admin sub-tabs render via the existing
  tier-3 mechanism.
- Global uber/platform admin: same as above (cartridgeFlags.isAdmin
  satisfies the gate).
- Non-admin: order-group renders without the Admin sub-item. No
  rendered placeholder, no flash, no leak. Same fail-closed posture.

If the admin tab still doesn't show after this lands: the spine
likely isn't returning adminCartridges containing 'knyt-codex' for
the persona. Hit /api/admin/diag/cartridge-admin-grants to see
exactly where the resolution chain fails — the hint field walks the
operator through the most likely root cause given the dumped data.

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |

## Stats

 1 file changed, 55 insertions(+), 50 deletions(-)
