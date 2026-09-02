# Commit Brief: `5d4ce61` — Decouple public-exposure from series='bridge' — require an explicit signal

| Field | Value |
|-------|-------|
| SHA | [`5d4ce61`](https://github.com/iQube-Protocol/AigentZBeta/commit/5d4ce615b5cda0a7bb18d72b6b3d0f2997a70562) |
| Author | Claude |
| Date | 2026-09-02T12:37:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Decouple public-exposure from series='bridge' — require an explicit signal

codexStorageRegisterHandler.ts's skipEncryption previously matched a bare
series==='bridge' string — series is caller-supplied with no allow-list,
so ANY admin caller of storage/register could skip encryption for ANY
upload just by naming that series, regardless of whether the asset was
actually meant for public display. Extracted the decision into an
exported, independently-tested shouldSkipEncryption(series, makePublic)
— now requires an explicit makePublic: true a caller sets deliberately
because IT knows the asset's real intent. qriptopian's pre-existing
bare-series exemption is untouched (a separate, already-working path
this change doesn't touch). The caller-side makePublic: true wiring
lands in the next commit alongside the infographic completion it's part
of.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

codexStorageRegisterHandler.ts's skipEncryption previously matched a bare
series==='bridge' string — series is caller-supplied with no allow-list,
so ANY admin caller of storage/register could skip encryption for ANY
upload just by naming that series, regardless of whether the asset was
actually meant for public display. Extracted the decision into an
exported, independently-tested shouldSkipEncryption(series, makePublic)
— now requires an explicit makePublic: true a caller sets deliberately
because IT knows the asset's real intent. qriptopian's pre-existing
bare-series exemption is untouched (a separate, already-working path
this change doesn't touch). The caller-side makePublic: true wiring
lands in the next commit alongside the infographic completion it's part
of.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/content/codexStorageRegisterHandler.ts` |
| Modified | `tests/bridge-asset-picker-completion.test.ts` |

## Stats

 2 files changed, 67 insertions(+), 9 deletions(-)
