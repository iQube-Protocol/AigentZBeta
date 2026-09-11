# Commit Brief: `31ff00c` — Close UI acceptance gap: genuine component tests for the duplicate-pair queue

| Field | Value |
|-------|-------|
| SHA | [`31ff00c`](https://github.com/iQube-Protocol/AigentZBeta/commit/31ff00c6ac2b2daf0aa7616991e5f603206a6392) |
| Author | Claude |
| Date | 2026-08-27T03:08:54Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Close UI acceptance gap: genuine component tests for the duplicate-pair queue

Adds React Testing Library + jsdom as dev-only test infrastructure (this
codebase had none previously — vitest ran node-only, .test.ts only) so the
Stage 9 duplicate-pair queue's operator-facing behavior can be proven by
rendering the real component, not inferred from route/service tests alone.

DuplicateInvariantQueue: statements are now the primary, prominent display
with ids as secondary muted metadata; exactly one candidate carries a single
visible "Recommended" badge; the recommendation's reasoning moved behind a
native <details>/<summary> disclosure (collapsed by default, genuinely
keyboard-operable, screen-reader-announced with no hand-rolled ARIA) instead
of always-visible dense diagnostic text; buttons read "Keep recommended
candidate" / "Keep alternative candidate"; a duplicate-click guard prevents
a second merge while one is in flight; a stale-pair 409 now triggers the
same authoritative onDone refresh a successful merge would, so a pair the
server no longer recognises never sits inert.

The panel's post-merge sequencing (read → conditionally advance → resync →
scroll) is extracted into services/research/track2DuplicateQueueSettle.ts,
a pure function with injected IO, so the exact call order and gating — read
called once, advance called only when the SAME reading confirms zero pairs,
resync strictly after advance, scroll using only the advance response's own
anchor — is unit-tested with no DOM involved. The component tests then cover
what only rendering can prove: full statements visible, the single
Recommended badge, the disclosure's collapsed/expanded DOM state, the
low-confidence tie's plain-language explanation, both choices always
available, the override reason wired end to end to the merge route body,
disabled-during-submission, and that a remount/rerender with a fresh pairs
prop displays exactly what the server returned — never a cached position.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Adds React Testing Library + jsdom as dev-only test infrastructure (this
codebase had none previously — vitest ran node-only, .test.ts only) so the
Stage 9 duplicate-pair queue's operator-facing behavior can be proven by
rendering the real component, not inferred from route/service tests alone.

DuplicateInvariantQueue: statements are now the primary, prominent display
with ids as secondary muted metadata; exactly one candidate carries a single
visible "Recommended" badge; the recommendation's reasoning moved behind a
native <details>/<summary> disclosure (collapsed by default, genuinely
keyboard-operable, screen-reader-announced with no hand-rolled ARIA) instead
of always-visible dense diagnostic text; buttons read "Keep recommended
candidate" / "Keep alternative candidate"; a duplicate-click guard prevents
a second merge while one is in flight; a stale-pair 409 now triggers the
same authoritative onDone refresh a successful merge would, so a pair the
server no longer recognises never sits inert.

The panel's post-merge sequencing (read → conditionally advance → resync →
scroll) is extracted into services/research/track2DuplicateQueueSettle.ts,
a pure function with injected IO, so the exact call order and gating — read
called once, advance called only when the SAME reading confirms zero pairs,
resync strictly after advance, scroll using only the advance response's own
anchor — is unit-tested with no DOM involved. The component tests then cover
what only rendering can prove: full statements visible, the single
Recommended badge, the disclosure's collapsed/expanded DOM state, the
low-confidence tie's plain-language explanation, both choices always
available, the override reason wired end to end to the merge route body,
disabled-during-submission, and that a remount/rerender with a fresh pairs
prop displays exactly what the server returned — never a cached position.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/research/Track2ProgrammePanel.tsx` |
| Modified | `package-lock.json` |
| Modified | `package.json` |
| Added | `services/research/track2DuplicateQueueSettle.ts` |
| Added | `tests/duplicate-invariant-queue.test.tsx` |
| Added | `tests/track2-duplicate-queue-settle-sequence.test.ts` |
| Modified | `vitest.config.mjs` |

## Stats

 7 files changed, 1348 insertions(+), 107 deletions(-)
