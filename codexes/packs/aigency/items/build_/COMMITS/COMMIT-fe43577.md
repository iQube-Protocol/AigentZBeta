# Commit Brief: `fe43577` — Fix ask-agent's specialist allowlist to actually accept Factor/Aegis

| Field | Value |
|-------|-------|
| SHA | [`fe43577`](https://github.com/iQube-Protocol/AigentZBeta/commit/fe435774b10da34b0a428667a1bd0526610248c1) |
| Author | Claude |
| Date | 2026-09-05T06:09:46Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix ask-agent's specialist allowlist to actually accept Factor/Aegis

The Factor/Aegis invoke routes shipped this session pin specialistId and
delegate to ask-agent, but ask-agent's own VALID_SPECIALISTS array never
included 'factor' or 'aegis' — every real call through either invoke route
would have been rejected with invalid-specialist, despite both being fully
registered SpecialistIds in services/agents/specialistRouter.ts. Found by a
research pass mapping the MoneyPenny specialist UI surface; fixed
immediately since it made already-deployed routes non-functional.

Also widens SpecialistResponseCard's specialistId prop from a hand-copied
6-value union to the canonical SpecialistId type (services/agents/
specialistRouter.ts) — it was already missing moneypenny/metaye/researcher/
aletheon before today, on top of factor/aegis; deriving from the one real
union instead of a second hand-maintained list closes all of it at once.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

The Factor/Aegis invoke routes shipped this session pin specialistId and
delegate to ask-agent, but ask-agent's own VALID_SPECIALISTS array never
included 'factor' or 'aegis' — every real call through either invoke route
would have been rejected with invalid-specialist, despite both being fully
registered SpecialistIds in services/agents/specialistRouter.ts. Found by a
research pass mapping the MoneyPenny specialist UI surface; fixed
immediately since it made already-deployed routes non-functional.

Also widens SpecialistResponseCard's specialistId prop from a hand-copied
6-value union to the canonical SpecialistId type (services/agents/
specialistRouter.ts) — it was already missing moneypenny/metaye/researcher/
aletheon before today, on top of factor/aegis; deriving from the one real
union instead of a second hand-maintained list closes all of it at once.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Modified | `components/metame/cards/SpecialistResponseCard.tsx` |
| Added | `tests/ask-agent-factor-aegis-valid-specialists.test.ts` |

## Stats

 3 files changed, 41 insertions(+), 2 deletions(-)
