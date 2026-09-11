# Commit Brief: `726135f` — Upgrade Candidate Intake into a case-aware Factor/Aegis workspace

| Field | Value |
|-------|-------|
| SHA | [`726135f`](https://github.com/iQube-Protocol/AigentZBeta/commit/726135f44806772b5287332877f54b2a0d11c02c) |
| Author | Claude |
| Date | 2026-09-05T07:38:17Z |
| Branch | dev (direct push) |
| Type | `chore` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Upgrade Candidate Intake into a case-aware Factor/Aegis workspace

Converts the one-shot specialist consult panel into a stateful candidate
case workspace: evidence checklist, authority-chain status, Aegis
assessment + findings, case activity timeline, and a persistent
append-only conversation (Enter/Shift+Enter composer, retry, new
conversation). Every domain action (create case, evidence, pause/resume,
advance, request assessment, begin/review/fail, add finding, ratify,
MoneyPenny admission decision) calls the real existing REST routes
directly — no parallel case/assessment service.

Closes two real read-side gaps needed to make this honest: GET case now
also resolves the current Aegis assessment+findings (reusing
getCurrentAssessment/listFindings, mirroring admissionPacket.ts's own
resolution), and factor_case_events gets its first reader
(listCaseEvents + GET .../events).

Left-pane MoneyPenny copilot now shares one caseId with this panel via
MoneyPennyNavigationContext, and can delegate a question to Factor/Aegis
through a new sibling to the media-provider system
(services/smarttriad/specialistDelegation.ts) — deterministic, pre-LLM,
reuses askSpecialist(), never a second LLM-calling path.

Structural (not prompt-based) authority enforcement: Aegis's requester/
subject refs are always hardcoded/case-derived so self-assessment can't
collide by construction; Factor has no admission-write action at all, so
a direct ask renders a Refused card with a "Refer to MoneyPenny" action
client-side, with zero network call; only this panel (MoneyPenny's own
cartridge) renders the final admission decision, gated on
admission_pending.

Generic /api/assistant/ask-agent consultation is untouched; a new
case-context adapter (services/moneypenny/caseContextConsultation.ts)
prefixes questions with a bounded case block and every such reply is
tagged Advisory guidance, kept visually/structurally distinct from real
actions.

Real bug found and fixed while building this: the confirm-then-execute
flow was clearing its own confirm flag before the async action resolved,
which would have hidden a Refused/Blocked outcome badge before the
operator ever saw it — fixed to only dismiss on success.

14 new behavioral tests (testing-library + a fake REST backend, not
source-string canaries) cover ordered multi-turn threads, composer
clearing, case-context persistence across specialist switch, canonical
endpoint calls, both refusal paths, critical-finding blocking, state
restore on reopen, shared caseId across panes, absent (not merely
disabled) inert controls, and Enter/Shift+Enter. Fixed the one real
regression this pass caused (a quickPrompts wiring canary) rather than
weakening it. tsc: 680 errors before/after (unchanged baseline, zero new
errors in any touched file). Full vitest: the only file-level delta
across two full runs is the one canary just fixed; all other failing
files are unrelated pre-existing baseline (verified no import coupling).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Converts the one-shot specialist consult panel into a stateful candidate
case workspace: evidence checklist, authority-chain status, Aegis
assessment + findings, case activity timeline, and a persistent
append-only conversation (Enter/Shift+Enter composer, retry, new
conversation). Every domain action (create case, evidence, pause/resume,
advance, request assessment, begin/review/fail, add finding, ratify,
MoneyPenny admission decision) calls the real existing REST routes
directly — no parallel case/assessment service.

Closes two real read-side gaps needed to make this honest: GET case now
also resolves the current Aegis assessment+findings (reusing
getCurrentAssessment/listFindings, mirroring admissionPacket.ts's own
resolution), and factor_case_events gets its first reader
(listCaseEvents + GET .../events).

Left-pane MoneyPenny copilot now shares one caseId with this panel via
MoneyPennyNavigationContext, and can delegate a question to Factor/Aegis
through a new sibling to the media-provider system
(services/smarttriad/specialistDelegation.ts) — deterministic, pre-LLM,
reuses askSpecialist(), never a second LLM-calling path.

Structural (not prompt-based) authority enforcement: Aegis's requester/
subject refs are always hardcoded/case-derived so self-assessment can't
collide by construction; Factor has no admission-write action at all, so
a direct ask renders a Refused card with a "Refer to MoneyPenny" action
client-side, with zero network call; only this panel (MoneyPenny's own
cartridge) renders the final admission decision, gated on
admission_pending.

Generic /api/assistant/ask-agent consultation is untouched; a new
case-context adapter (services/moneypenny/caseContextConsultation.ts)
prefixes questions with a bounded case block and every such reply is
tagged Advisory guidance, kept visually/structurally distinct from real
actions.

Real bug found and fixed while building this: the confirm-then-execute
flow was clearing its own confirm flag before the async action resolved,
which would have hidden a Refused/Blocked outcome badge before the
operator ever saw it — fixed to only dismiss on success.

14 new behavioral tests (testing-library + a fake REST backend, not
source-string canaries) cover ordered multi-turn threads, composer
clearing, case-context persistence across specialist switch, canonical
endpoint calls, both refusal paths, critical-finding blocking, state
restore on reopen, shared caseId across panes, absent (not merely
disabled) inert controls, and Enter/Shift+Enter. Fixed the one real
regression this pass caused (a quickPrompts wiring canary) rather than
weakening it. tsc: 680 errors before/after (unchanged baseline, zero new
errors in any touched file). Full vitest: the only file-level delta
across two full runs is the one canary just fixed; all other failing
files are unrelated pre-existing baseline (verified no import coupling).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/moneypenny/components/CandidateIntakePanel.tsx` |
| Modified | `app/(shell)/moneypenny/components/MoneyPennyCopilotWorkspace.tsx` |
| Modified | `app/(shell)/moneypenny/components/moneyPennyNavigation.tsx` |
| Modified | `app/api/codex/chat/route.ts` |
| Added | `app/api/moneypenny/factor/cases/[caseId]/events/route.ts` |
| Modified | `app/api/moneypenny/factor/cases/[caseId]/route.ts` |
| Modified | `app/triad/components/codex/tabs/MoneyPennyPanelTab.tsx` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-09-05_candidate-intake-case-workspace-upgrade.md` |
| Modified | `services/factor/factorCaseService.ts` |
| Added | `services/moneypenny/caseContextConsultation.ts` |
| Added | `services/smarttriad/specialistDelegation.ts` |
| Added | `tests/moneypenny-candidate-intake-workspace.test.tsx` |
| Modified | `tests/moneypenny-copilot-workspace.test.ts` |

## Stats

 14 files changed, 2102 insertions(+), 109 deletions(-)
