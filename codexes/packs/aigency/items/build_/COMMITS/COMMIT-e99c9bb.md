# Commit Brief: `e99c9bb` — Collapse MoneyPenny's left-pane role selector to a one-row Advisor/Architect/Runtime toggle

| Field | Value |
|-------|-------|
| SHA | [`e99c9bb`](https://github.com/iQube-Protocol/AigentZBeta/commit/e99c9bba1b2669feb5e3bcf5e6b1df85af9ff1e1) |
| Author | Claude |
| Date | 2026-09-03T11:58:16Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Collapse MoneyPenny's left-pane role selector to a one-row Advisor/Architect/Runtime toggle

Replaces the "Role: Advisor ▾" dropdown (button trigger + floating list
with per-option descriptions, up to four rows once opened) with three
always-visible inline buttons — no open/close state, no "Role:" label.
Same MoneyPennyProviderMode vocabulary, same onChange-only wiring (no
fetch, no identity/delegation call); only the presentation collapsed to
one row.

Verified with a throwaway dev-only preview route (mounted the real
component, screenshotted, deleted before commit — never shipped): all
three buttons render on the same y-position/height, and clicking swaps
the active highlight correctly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Replaces the "Role: Advisor ▾" dropdown (button trigger + floating list
with per-option descriptions, up to four rows once opened) with three
always-visible inline buttons — no open/close state, no "Role:" label.
Same MoneyPennyProviderMode vocabulary, same onChange-only wiring (no
fetch, no identity/delegation call); only the presentation collapsed to
one row.

Verified with a throwaway dev-only preview route (mounted the real
component, screenshotted, deleted before commit — never shipped): all
three buttons render on the same y-position/height, and clicking swaps
the active highlight correctly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/smarttriad/copilot/MoneyPennyRoleSelector.tsx` |
| Modified | `tests/moneypenny-experience-coherence-navigation.test.ts` |

## Stats

 3 files changed, 56 insertions(+), 66 deletions(-)
