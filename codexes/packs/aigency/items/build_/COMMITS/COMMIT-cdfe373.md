# Commit Brief: `cdfe373` — add polity passport bureau doctrine, ens, and being tabs

| Field | Value |
|-------|-------|
| SHA | [`cdfe373`](https://github.com/iQube-Protocol/AigentZBeta/commit/cdfe3730dd7c8c9c04c3d7638da5e926489bc8b3) |
| Author | Claude |
| Date | 2026-06-13T21:01:10Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add polity passport bureau doctrine, ens, and being tabs

Three new tab surfaces for the Passport Bureau cartridge:
- PassportDoctrineTab: constitutional framework, passport types, identity
  model, self-custody vault, privacy tiers, status model, review policy,
  and machine-readable surfaces (PRD §4.1)
- PassportEnsTab: ENS subname mint/resolve UI for Sprint 7 (gasless L2
  subnames via Namestone under polity.eth)
- PassportBeingTab: Human Mobility Services stub (PRD §15) with refugee
  demonstration scenario and privacy guarantees
- Register all three in TabRenderer component map
- Add doctrine, ens, being tab groups to POLITY_PASSPORT_BUREAU_CARTRIDGE

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

Three new tab surfaces for the Passport Bureau cartridge:
- PassportDoctrineTab: constitutional framework, passport types, identity
  model, self-custody vault, privacy tiers, status model, review policy,
  and machine-readable surfaces (PRD §4.1)
- PassportEnsTab: ENS subname mint/resolve UI for Sprint 7 (gasless L2
  subnames via Namestone under polity.eth)
- PassportBeingTab: Human Mobility Services stub (PRD §15) with refugee
  demonstration scenario and privacy guarantees
- Register all three in TabRenderer component map
- Add doctrine, ens, being tab groups to POLITY_PASSPORT_BUREAU_CARTRIDGE

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/tabs/PassportBeingTab.tsx` |
| Added | `app/triad/components/codex/tabs/PassportDoctrineTab.tsx` |
| Added | `app/triad/components/codex/tabs/PassportEnsTab.tsx` |
| Modified | `data/codex-configs.ts` |

## Stats

 5 files changed, 948 insertions(+), 5 deletions(-)
