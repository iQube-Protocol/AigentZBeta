# Commit Brief: `df68a8f` — Rename CI Bridge to /bridge/ci and redirect the old path

| Field | Value |
|-------|-------|
| SHA | [`df68a8f`](https://github.com/iQube-Protocol/AigentZBeta/commit/df68a8fdb837a1a0b4ec4d3d498bd557a1c26a53) |
| Author | Claude |
| Date | 2026-08-10T19:25:56Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Rename CI Bridge to /bridge/ci and redirect the old path

/bridge/constitutional-internet -> /bridge/ci (matches /bridge/knyts's
short naming pattern); a next.config.js redirect keeps the longer path
working for anyone who already has it. Updated the four internal
references (page header comment, journeySurfaceRegistry note, journey
definition header, and the Share-the-Bridge deep link) to match. The
campaign/journey id strings ('constitutional-internet-bridge') are
unchanged -- only the URL path moved.
```

## Body

/bridge/constitutional-internet -> /bridge/ci (matches /bridge/knyts's
short naming pattern); a next.config.js redirect keeps the longer path
working for anyone who already has it. Updated the four internal
references (page header comment, journeySurfaceRegistry note, journey
definition header, and the Share-the-Bridge deep link) to match. The
campaign/journey id strings ('constitutional-internet-bridge') are
unchanged -- only the URL path moved.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/bridge/ci/page.tsx` |
| Deleted | `app/bridge/constitutional-internet/page.tsx` |

## Stats

 2 files changed, 167 insertions(+), 167 deletions(-)
