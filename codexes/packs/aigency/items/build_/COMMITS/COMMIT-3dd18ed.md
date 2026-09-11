# Commit Brief: `3dd18ed` — IframeTab: move Open-in-new-tab link out of iframe overlay into chrome strip

| Field | Value |
|-------|-------|
| SHA | [`3dd18ed`](https://github.com/iQube-Protocol/AigentZBeta/commit/3dd18edd85219013742d0bbfa5667a65efbc9298) |
| Author | Claude |
| Date | 2026-05-29T15:03:03Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
IframeTab: move Open-in-new-tab link out of iframe overlay into chrome strip

The Open button was absolute-positioned at top-2 right-2 inside the
iframe container, which put it on top of the embedded site's own
top-right UI (sign-in buttons on metame.com / qriptopia.com,
notification bells, etc.). Reflow IframeTab to a flex-col with a
thin chrome strip above the iframe — Open link sits right-aligned in
that strip, never overlapping the embedded page's content.

Single shared component, so the fix lands on both the metaMe (web ·
metame.com) and Qriptopian (web · qriptopia.com) cartridge tabs at
once. No config changes; both tabs already point at the same
IframeTab via componentRegistry.

Theme-aware: chrome strip border + bg pick light / dark variants
matching the cartridge theme prop the IframeTab already receives.
```

## Body

The Open button was absolute-positioned at top-2 right-2 inside the
iframe container, which put it on top of the embedded site's own
top-right UI (sign-in buttons on metame.com / qriptopia.com,
notification bells, etc.). Reflow IframeTab to a flex-col with a
thin chrome strip above the iframe — Open link sits right-aligned in
that strip, never overlapping the embedded page's content.

Single shared component, so the fix lands on both the metaMe (web ·
metame.com) and Qriptopian (web · qriptopia.com) cartridge tabs at
once. No config changes; both tabs already point at the same
IframeTab via componentRegistry.

Theme-aware: chrome strip border + bg pick light / dark variants
matching the cartridge theme prop the IframeTab already receives.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/IframeTab.tsx` |

## Stats

 1 file changed, 26 insertions(+), 12 deletions(-)
