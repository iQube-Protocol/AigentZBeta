# Commit Brief: `3258ad2` — Fix Qriptopian read_public_document defaulting to the wrong edition's text

| Field | Value |
|-------|-------|
| SHA | [`3258ad2`](https://github.com/iQube-Protocol/AigentZBeta/commit/3258ad2a7d5723875ed12b273a80ac4165c64a00) |
| Author | Claude |
| Date | 2026-09-03T06:04:32Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Qriptopian read_public_document defaulting to the wrong edition's text

Live-discovered against the hosted production endpoint: Threshold 006's
canonicalText.text field (modalities.read.text) holds the RESEARCH
edition's 67,050-char text even though defaultReadingEdition correctly
says "reading" (22,404 chars) — readingEditions.ts's own header explains
why (Research's source is canonical, not an inline text field), but
publicKnowledge.ts's readDocument() was falling back to canonicalText.text
whenever no edition was explicitly requested, silently returning the wrong
edition's text and hash for the default case.

Fixed to resolve defaultReadingEdition against the readingEditions array
first (matching what the app's own resolveReadingEdition() would pick),
falling back to canonicalText.text only when there is no editions array at
all. Added regression tests reproducing the exact real-world divergence.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Live-discovered against the hosted production endpoint: Threshold 006's
canonicalText.text field (modalities.read.text) holds the RESEARCH
edition's 67,050-char text even though defaultReadingEdition correctly
says "reading" (22,404 chars) — readingEditions.ts's own header explains
why (Research's source is canonical, not an inline text field), but
publicKnowledge.ts's readDocument() was falling back to canonicalText.text
whenever no edition was explicitly requested, silently returning the wrong
edition's text and hash for the default case.

Fixed to resolve defaultReadingEdition against the readingEditions array
first (matching what the app's own resolveReadingEdition() would pick),
falling back to canonicalText.text only when there is no editions array at
all. Added regression tests reproducing the exact real-world divergence.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/threshold/publicKnowledge.ts` |
| Modified | `tests/threshold-public-knowledge-bridge.test.ts` |

## Stats

 2 files changed, 77 insertions(+), 2 deletions(-)
