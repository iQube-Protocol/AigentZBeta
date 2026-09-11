# Commit Brief: `07334b2` — Fix inert MoneyPenny Market Research/Learn cards; log EXP-P1 stage 8 gap

| Field | Value |
|-------|-------|
| SHA | [`07334b2`](https://github.com/iQube-Protocol/AigentZBeta/commit/07334b2fad388ab2f02a3c05a5076c1db44c5573) |
| Author | Claude |
| Date | 2026-09-05T10:11:13Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix inert MoneyPenny Market Research/Learn cards; log EXP-P1 stage 8 gap

Home overview's two "ask MoneyPenny" cards navigated to the same
overview panel they were already on (silent no-op) — render them as a
hint instead and add matching quick-prompt chips in the conversation
pane as the real one-click path.

Also records this session's EXP-P1 Track 2 reconciliation: the Stage 8
assignment gap (53 already-eligible successor invariants were never
assigned, leaving readiness stuck reading 11 predecessor-only members)
and the follow-on architectural gap it exposed (invariant_contexts has
no crystal-generation column, so Stage 8's completion signal is
generation-blind). The 53-member assignment itself was performed
directly against Supabase (dry-run asserted, receipted, idempotent);
this commit is the code fix + the doc record, not the data write.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Home overview's two "ask MoneyPenny" cards navigated to the same
overview panel they were already on (silent no-op) — render them as a
hint instead and add matching quick-prompt chips in the conversation
pane as the real one-click path.

Also records this session's EXP-P1 Track 2 reconciliation: the Stage 8
assignment gap (53 already-eligible successor invariants were never
assigned, leaving readiness stuck reading 11 predecessor-only members)
and the follow-on architectural gap it exposed (invariant_contexts has
no crystal-generation column, so Stage 8's completion signal is
generation-blind). The 53-member assignment itself was performed
directly against Supabase (dry-run asserted, receipted, idempotent);
this commit is the code fix + the doc record, not the data write.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyOverviewPanel.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-05_exp-p1-stage8-successor-assignment-and-generation-gap.md` |

## Stats

 4 files changed, 98 insertions(+)
