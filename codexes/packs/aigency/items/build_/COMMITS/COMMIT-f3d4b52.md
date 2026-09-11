# Commit Brief: `f3d4b52` — Give the CCRL research surface a fence-enforcement retry (promise-without-fence fix)

| Field | Value |
|-------|-------|
| SHA | [`f3d4b52`](https://github.com/iQube-Protocol/AigentZBeta/commit/f3d4b52bff612baf8c2f93e40597c20855b32126) |
| Author | Claude |
| Date | 2026-07-07T17:32:55Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Give the CCRL research surface a fence-enforcement retry (promise-without-fence fix)

The CCRL copilot would say "I'll draft a structured experiment proposal in the
right pane" and emit no ```research_data fence, so onStageProposals received
nothing and no pending card appeared (operator field report, 2026-07-07). The
tab's render path (onStageProposals → pending cards → Approve → commit/persist)
was correct; the failure was upstream — the dev loop's server-side fence-
enforcement retry was scoped to dev-command-center only, so the research surface
had no recovery when a promised fence went missing.

Add a research-surface retry mirroring the dev one: keyed on the ccrl-research
surface (no stage), it fires ONLY when the reply promised a proposal
(looksLikeUnfulfilledProposalPromise) and zero were extracted, then makes one
follow-up call demanding a ```research_data fence (the model picks the matching
schema of the four). Pure narration / status / run answers never promise a card,
so they never trigger it — consistent with the conditional fence contract.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The CCRL copilot would say "I'll draft a structured experiment proposal in the
right pane" and emit no ```research_data fence, so onStageProposals received
nothing and no pending card appeared (operator field report, 2026-07-07). The
tab's render path (onStageProposals → pending cards → Approve → commit/persist)
was correct; the failure was upstream — the dev loop's server-side fence-
enforcement retry was scoped to dev-command-center only, so the research surface
had no recovery when a promised fence went missing.

Add a research-surface retry mirroring the dev one: keyed on the ccrl-research
surface (no stage), it fires ONLY when the reply promised a proposal
(looksLikeUnfulfilledProposalPromise) and zero were extracted, then makes one
follow-up call demanding a ```research_data fence (the model picks the matching
schema of the four). Pure narration / status / run answers never promise a card,
so they never trigger it — consistent with the conditional fence contract.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/codex/chat/route.ts` |

## Stats

 1 file changed, 59 insertions(+)
