# Commit Brief: `98c0e12` — Financial-profile write paths never crash on a missing table [merge spec/moneypenny-mpy2-3]

| Field | Value |
|-------|-------|
| SHA | [`98c0e12`](https://github.com/iQube-Protocol/AigentZBeta/commit/98c0e1274f95e3def631d76a42632f54c4081a15) |
| Author | Claude |
| Date | 2026-09-02T06:07:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Financial-profile write paths never crash on a missing table [merge spec/moneypenny-mpy2-3]

Four squashed-for-deploy commits from spec/moneypenny-mpy2-3, regression-
tested together against current dev:

1. Correct fs-operate's breadcrumb label to bare "Operate" (was "Operate
   with MoneyPenny" — read poorly truncated in the stage stepper; the
   distinct stage id already prevents any routing/receipt collision) and
   navigate to MoneyPenny in the SAME frame (window.location.assign,
   never window.open/_blank — this stage renders inside the Journey
   Spine's own iframe).
2. Close two more upload-authorization gaps: POST /storage/sign (a
   signed Storage WRITE-capability grant, zero auth) and GET
   /assets-by-category (leaked internal asset metadata, zero auth).
3. A2 completion: PlacementSlot gains 'infographic' (bookkeeping only —
   no live editorial-config column exists for it, documented honestly).
   PlacementAssetsPanel gains real browse/upload via the now-gated
   assets-by-category + sign->PUT->register pipeline (series='bridge',
   existing asset kinds reused, kept genuinely unencrypted/public) —
   the paste-a-URL fallback stays.
4. Financial-profile compute/manual routes and bridge-placements assign
   now return a clean, named "not set up in this environment yet"
   response instead of an unhandled 500 when their table is missing.

Full detail in the four individual commit messages on
spec/moneypenny-mpy2-3 (28aa1576b, de8041574, ea936da36, 40a36b43e).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Four squashed-for-deploy commits from spec/moneypenny-mpy2-3, regression-
tested together against current dev:

1. Correct fs-operate's breadcrumb label to bare "Operate" (was "Operate
   with MoneyPenny" — read poorly truncated in the stage stepper; the
   distinct stage id already prevents any routing/receipt collision) and
   navigate to MoneyPenny in the SAME frame (window.location.assign,
   never window.open/_blank — this stage renders inside the Journey
   Spine's own iframe).
2. Close two more upload-authorization gaps: POST /storage/sign (a
   signed Storage WRITE-capability grant, zero auth) and GET
   /assets-by-category (leaked internal asset metadata, zero auth).
3. A2 completion: PlacementSlot gains 'infographic' (bookkeeping only —
   no live editorial-config column exists for it, documented honestly).
   PlacementAssetsPanel gains real browse/upload via the now-gated
   assets-by-category + sign->PUT->register pipeline (series='bridge',
   existing asset kinds reused, kept genuinely unencrypted/public) —
   the paste-a-URL fallback stays.
4. Financial-profile compute/manual routes and bridge-placements assign
   now return a clean, named "not set up in this environment yet"
   response instead of an unhandled 500 when their table is missing.

Full detail in the four individual commit messages on
spec/moneypenny-mpy2-3 (28aa1576b, de8041574, ea936da36, 40a36b43e).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/moneypenny/financial-profile/compute/route.ts` |
| Modified | `app/api/moneypenny/financial-profile/manual/route.ts` |
| Modified | `services/iqube/financialProfileQube.ts` |
| Modified | `tests/financial-profile-manual-entry.test.ts` |

## Stats

 5 files changed, 56 insertions(+), 3 deletions(-)
