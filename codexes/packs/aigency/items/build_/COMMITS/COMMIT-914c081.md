# Commit Brief: `914c081` — polish step strip to rounded-rect boxes + surface world id upgrade on registry

| Field | Value |
|-------|-------|
| SHA | [`914c081`](https://github.com/iQube-Protocol/AigentZBeta/commit/914c08124f7996047bf0900c2e339a29742bec72) |
| Author | Claude |
| Date | 2026-06-13T20:35:04Z |
| Branch | dev (direct push) |
| Type | `chore` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
polish step strip to rounded-rect boxes + surface world id upgrade on registry

operator notes 2026-06-13:

1) the step pills (1.Class, 2.Account, 3.Identity, 4.Private Vault,
   5.Consents, 6.Submit) on the Apply tab were rounded-full pills that
   wrapped to two lines on 'Private Vault' — 'looks mickey mouse'.
   wanted: wider, more rectangular boxes with rounded corners, kept to
   one row, premium feel, container widened to use dead space.

2) post-claim path to World ID strong verification wasn't discoverable.
   the wallet drawer had it (sprint 2) but operator wants it surfaced
   in the Registry tab too so the loop 'apply → claim → verify' is
   visible end-to-end inside the cartridge.

PassportBureauApplyTab.tsx:

  - container width: max-w-2xl → max-w-4xl. uses the prior dead space
    on either side, gives the step strip room to breathe.
  - step strip: rounded-full → rounded-xl boxes. grid-cols-6 gap-2
    (equal width, one row). px-3 py-2.5. whitespace-nowrap +
    truncate as fallback. ring-1 instead of solid backgrounds,
    subtle shadow on the active state for a more premium feel.
    icon opacity bumps on hover. step number uses opacity-60 so the
    label reads first.

  result: 'Private Vault' fits in one row at max-w-4xl with the new
  grid layout. all 6 boxes equal width. no wrapping. polished feel.

PassportRegistryTab.tsx:

  - OwnPassport interface gains passportGrade field (already returned
    by /api/polity-passport/wallet — see app/api/polity-passport/wallet/
    route.ts:62).
  - new handleWorldIdUpgrade callback. same dev-worldid-orb pattern as
    SmartWalletDrawer.handleWorldIdUpgrade (sprint 2). server-side
    verifyWorldIdProof accepts the dev token when WORLD_ID_APP_ID is
    unset.
  - new render in the row controls: when own passport is claimed and
    citizen-class:
      - grade === 'verified_citizen' → sky badge 'World ID' (shieldcheck icon)
      - grade !== 'verified_citizen' → sky button 'Verify with World ID'
        with busy/disabled states, calls handleWorldIdUpgrade then
        loadOwn to refresh the grade flip.

  result: operator sees the verify-loop right next to the 'In Wallet'
  pill on the Registry row. no need to open the wallet drawer to
  discover it. once verified, the button flips to a static 'World ID'
  badge.

both fixes preserve existing flows — only the visual layout of the
step strip and the addition of a per-row world-id button on the
registry changed.
```

## Body

operator notes 2026-06-13:

1) the step pills (1.Class, 2.Account, 3.Identity, 4.Private Vault,
   5.Consents, 6.Submit) on the Apply tab were rounded-full pills that
   wrapped to two lines on 'Private Vault' — 'looks mickey mouse'.
   wanted: wider, more rectangular boxes with rounded corners, kept to
   one row, premium feel, container widened to use dead space.

2) post-claim path to World ID strong verification wasn't discoverable.
   the wallet drawer had it (sprint 2) but operator wants it surfaced
   in the Registry tab too so the loop 'apply → claim → verify' is
   visible end-to-end inside the cartridge.

PassportBureauApplyTab.tsx:

  - container width: max-w-2xl → max-w-4xl. uses the prior dead space
    on either side, gives the step strip room to breathe.
  - step strip: rounded-full → rounded-xl boxes. grid-cols-6 gap-2
    (equal width, one row). px-3 py-2.5. whitespace-nowrap +
    truncate as fallback. ring-1 instead of solid backgrounds,
    subtle shadow on the active state for a more premium feel.
    icon opacity bumps on hover. step number uses opacity-60 so the
    label reads first.

  result: 'Private Vault' fits in one row at max-w-4xl with the new
  grid layout. all 6 boxes equal width. no wrapping. polished feel.

PassportRegistryTab.tsx:

  - OwnPassport interface gains passportGrade field (already returned
    by /api/polity-passport/wallet — see app/api/polity-passport/wallet/
    route.ts:62).
  - new handleWorldIdUpgrade callback. same dev-worldid-orb pattern as
    SmartWalletDrawer.handleWorldIdUpgrade (sprint 2). server-side
    verifyWorldIdProof accepts the dev token when WORLD_ID_APP_ID is
    unset.
  - new render in the row controls: when own passport is claimed and
    citizen-class:
      - grade === 'verified_citizen' → sky badge 'World ID' (shieldcheck icon)
      - grade !== 'verified_citizen' → sky button 'Verify with World ID'
        with busy/disabled states, calls handleWorldIdUpgrade then
        loadOwn to refresh the grade flip.

  result: operator sees the verify-loop right next to the 'In Wallet'
  pill on the Registry row. no need to open the wallet drawer to
  discover it. once verified, the button flips to a static 'World ID'
  badge.

both fixes preserve existing flows — only the visual layout of the
step strip and the addition of a per-row world-id button on the
registry changed.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx` |
| Modified | `app/triad/components/codex/tabs/PassportRegistryTab.tsx` |

## Stats

 2 files changed, 78 insertions(+), 8 deletions(-)
