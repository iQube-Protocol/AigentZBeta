# Commit Brief: `4cde62c` — Begin MoneyPenny specialist UI for Factor/Aegis: Candidate Intake panel

| Field | Value |
|-------|-------|
| SHA | [`4cde62c`](https://github.com/iQube-Protocol/AigentZBeta/commit/4cde62c99c5377a8927974793a39f226c8c87570) |
| Author | Claude |
| Date | 2026-09-05T06:15:35Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Begin MoneyPenny specialist UI for Factor/Aegis: Candidate Intake panel

Adds the first operator-facing UI for Factor/Aegis consultation
(operator directive 2026-09-05). Both were already fully registered
specialists (services/agents/specialistRouter.ts) with governed invoke
routes, but no UI existed to reach either — CandidateIntakePanel.tsx is
deliberately thin: it calls the same /api/assistant/ask-agent path every
other specialist consultation uses (via personaFetch, never a raw fetch
against this spine endpoint) and renders with the same
SpecialistResponseCard every other specialist response renders with. No
new card shape, no second "ask Factor" implementation.

Wired as a new "candidate-intake" MoneyPennyPanelKey, alongside Service
Orchestration in the Operate capability group (candidate agents awaiting
admission vs. already-admitted agents), landing in the Activity area.

Advisory-only, matching Factor/Aegis's real backend contract: this panel
never mutates a candidate case or an assessment; the actual case/assessment
REST surfaces (app/api/moneypenny/factor/cases, .../aegis/assessments)
still have no dedicated UI — out of scope for this first slice.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Adds the first operator-facing UI for Factor/Aegis consultation
(operator directive 2026-09-05). Both were already fully registered
specialists (services/agents/specialistRouter.ts) with governed invoke
routes, but no UI existed to reach either — CandidateIntakePanel.tsx is
deliberately thin: it calls the same /api/assistant/ask-agent path every
other specialist consultation uses (via personaFetch, never a raw fetch
against this spine endpoint) and renders with the same
SpecialistResponseCard every other specialist response renders with. No
new card shape, no second "ask Factor" implementation.

Wired as a new "candidate-intake" MoneyPennyPanelKey, alongside Service
Orchestration in the Operate capability group (candidate agents awaiting
admission vs. already-admitted agents), landing in the Activity area.

Advisory-only, matching Factor/Aegis's real backend contract: this panel
never mutates a candidate case or an assessment; the actual case/assessment
REST surfaces (app/api/moneypenny/factor/cases, .../aegis/assessments)
still have no dedicated UI — out of scope for this first slice.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/(shell)/moneypenny/components/CandidateIntakePanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneypennyCapabilities.ts` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Added | `tests/moneypenny-candidate-intake-panel.test.ts` |

## Stats

 4 files changed, 229 insertions(+)
