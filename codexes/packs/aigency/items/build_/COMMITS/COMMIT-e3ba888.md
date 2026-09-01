# Commit Brief: `e3ba888` — Add MoneyPenny capability-led navigation rail and overview panel

| Field | Value |
|-------|-------|
| SHA | [`e3ba888`](https://github.com/iQube-Protocol/AigentZBeta/commit/e3ba888f7a5bafb71776f18d1652daf4524f44e8) |
| Author | Claude |
| Date | 2026-09-01T11:01:51Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add MoneyPenny capability-led navigation rail and overview panel

SPEC-MPY-002 MPY2-1 — introduces the Understand/Design/Markets/Operate/
Monitor user-facing capability axis (§2.1) as an additive layer over the
existing moneypenny-codex cartridge, without renaming or restructuring
MONEYPENNY_CARTRIDGE.tabGroups (deliberately left untouched — see the
MPY2-0 audit doc's discrepancy note).

- moneypennyCapabilities.ts: single source of truth for the six capability
  groups, each item pointing at a real existing tab or null ('coming soon',
  never a fake destination) — Advisor/Architect/Runtime mode carried only
  as a secondary badge per §2.2.
- MoneyPennyCapabilityRail.tsx: persistent left rail, mounted on every
  MoneyPenny panel via MoneyPennyShell. Navigates through the EXISTING
  tryOpenInMountedCartridge seam (services/cartridge/CartridgePresenceRegistry)
  — the same in-place tab-switch mechanism the wallet and Living Canon
  chips already use — no second router.
- MoneyPennyOverviewPanel.tsx + a new 'moneypenny-overview' tab
  (data/codex-configs.ts, order -1 in the existing 'operate' group): the
  capability-led landing hub.
- MoneyPennyPanelTab.tsx: adds the 'overview' panel key, threads
  activePanel down to MoneyPennyShell for rail highlighting.
- MoneyPennyShell.tsx: mounts the rail; also fixes the connection-status
  strip to derive all four rows from healthCheck.services instead of
  hardcoding X402/FIO to 'online' unconditionally and reading a nonexistent
  'redis' key for Quotes (both silently misreported status regardless of
  the underlying stub value).
- tests/moneypenny-capability-navigation.test.ts: validates the capability
  data against real tab slugs, the new tab's wiring, and regression-guards
  that tabGroups stays exactly operate/connect/service/administer.
```

## Body

SPEC-MPY-002 MPY2-1 — introduces the Understand/Design/Markets/Operate/
Monitor user-facing capability axis (§2.1) as an additive layer over the
existing moneypenny-codex cartridge, without renaming or restructuring
MONEYPENNY_CARTRIDGE.tabGroups (deliberately left untouched — see the
MPY2-0 audit doc's discrepancy note).

- moneypennyCapabilities.ts: single source of truth for the six capability
  groups, each item pointing at a real existing tab or null ('coming soon',
  never a fake destination) — Advisor/Architect/Runtime mode carried only
  as a secondary badge per §2.2.
- MoneyPennyCapabilityRail.tsx: persistent left rail, mounted on every
  MoneyPenny panel via MoneyPennyShell. Navigates through the EXISTING
  tryOpenInMountedCartridge seam (services/cartridge/CartridgePresenceRegistry)
  — the same in-place tab-switch mechanism the wallet and Living Canon
  chips already use — no second router.
- MoneyPennyOverviewPanel.tsx + a new 'moneypenny-overview' tab
  (data/codex-configs.ts, order -1 in the existing 'operate' group): the
  capability-led landing hub.
- MoneyPennyPanelTab.tsx: adds the 'overview' panel key, threads
  activePanel down to MoneyPennyShell for rail highlighting.
- MoneyPennyShell.tsx: mounts the rail; also fixes the connection-status
  strip to derive all four rows from healthCheck.services instead of
  hardcoding X402/FIO to 'online' unconditionally and reading a nonexistent
  'redis' key for Quotes (both silently misreported status regardless of
  the underlying stub value).
- tests/moneypenny-capability-navigation.test.ts: validates the capability
  data against real tab slugs, the new tab's wiring, and regression-guards
  that tabGroups stays exactly operate/connect/service/administer.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/moneypenny/components/MoneyPennyCapabilityRail.tsx` |
| Added | `app/(shell)/moneypenny/components/MoneyPennyOverviewPanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyShell.tsx` |
| Added | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `data/codex-configs.ts` |
| Added | `tests/moneypenny-capability-navigation.test.ts` |

## Stats

 7 files changed, 520 insertions(+), 14 deletions(-)
