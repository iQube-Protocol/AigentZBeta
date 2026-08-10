# Commit Brief: `d1ef756` — implement in-place iframe chrome toggle for guided journey embeds

| Field | Value |
|-------|-------|
| SHA | [`d1ef756`](https://github.com/iQube-Protocol/AigentZBeta/commit/d1ef7562b741a5be55f6887a63b2aa6e51d530a5) |
| Author | Claude |
| Date | 2026-08-10T20:03:05Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
implement in-place iframe chrome toggle for guided journey embeds

Replace external-link affordances with toggle buttons that switch between
Lite (focused, primary chrome suppressed) and Full (expanded, full chrome)
states without leaving the containing journey (/bridge/knyts).

- JourneyRunSurface.tsx: Add expandedEmbedIndices state + toggleEmbedExpansion
  handler. Compute shouldFocus based on isExpanded and descriptor.focused.
  Replace <a target='_blank'> with <button onClick> that shows 'Focus view'
  when expanded, 'Open [label] ↗' when focused. Reuse existing logic.

- KnytsBridgeRemixSurface.tsx: Add expanded state. Build src conditionally
  in useEffect with focused=!expanded. Replace external link with toggle
  button. Button text: 'Focus view' when expanded, 'Explore metaMe ↗' when
  focused. Preserve remix= and campaignTag= params on both paths.

Both implementations are generic and reusable for any journey/embedded surface.
Iframe reloads automatically when src changes (no manual reload needed).
Stage, route, and application state remain preserved on server side.
```

## Body

Replace external-link affordances with toggle buttons that switch between
Lite (focused, primary chrome suppressed) and Full (expanded, full chrome)
states without leaving the containing journey (/bridge/knyts).

- JourneyRunSurface.tsx: Add expandedEmbedIndices state + toggleEmbedExpansion
  handler. Compute shouldFocus based on isExpanded and descriptor.focused.
  Replace <a target='_blank'> with <button onClick> that shows 'Focus view'
  when expanded, 'Open [label] ↗' when focused. Reuse existing logic.

- KnytsBridgeRemixSurface.tsx: Add expanded state. Build src conditionally
  in useEffect with focused=!expanded. Replace external link with toggle
  button. Button text: 'Focus view' when expanded, 'Explore metaMe ↗' when
  focused. Preserve remix= and campaignTag= params on both paths.

Both implementations are generic and reusable for any journey/embedded surface.
Iframe reloads automatically when src changes (no manual reload needed).
Stage, route, and application state remain preserved on server side.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `components/journey/KnytsBridgeRemixSurface.tsx` |

## Stats

 2 files changed, 40 insertions(+), 36 deletions(-)
