# Commit Brief: `fc163cc` — Remove duplicate PILOT_AGENTS registry; stop constructing aigent-\${slug}

| Field | Value |
|-------|-------|
| SHA | [`fc163cc`](https://github.com/iQube-Protocol/AigentZBeta/commit/fc163cc1b03673b34c7ee6dec309246da9e8b0f9) |
| Author | Claude |
| Date | 2026-08-09T01:01:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Remove duplicate PILOT_AGENTS registry; stop constructing aigent-\${slug}

PILOT_AGENTS in RegisterAgentPanel.tsx was a hand-copied literal duplicating
slug/displayName/agentCardPath from services/horizen/registrableAgents.ts's
REGISTRABLE_AGENTS (inv.engineering.036/037). Now projected from the
canonical source via resolveRegistrableAgent, with only the display ORDER
(Nakamoto first, per the 2026-08-02 ruling) still asserted explicitly —
the fields themselves can no longer drift.

Every site that built an agentsInvoked/subjectAgentRef string via
`aigent-${slug}` template-literal coincidence now resolves the canonical
runtimeAgentId first (RegisterAgentPanel.tsx x4, PilotJourneyTab.tsx's
receiptsSubjectAgentRef), falling back to the coincidence only if resolution
genuinely fails — no behavior change for Nakamoto/MoneyPenny today, but a
future agent whose slug doesn't happen to match the `aigent-<slug>` pattern
now scopes correctly instead of silently mismatching.

Updated the two source-text canary tests (register-ceremony.test.ts,
register-stage-receipt-agent-isolation.test.ts) that asserted on the old
literal shapes to assert the same intent against the new code.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

PILOT_AGENTS in RegisterAgentPanel.tsx was a hand-copied literal duplicating
slug/displayName/agentCardPath from services/horizen/registrableAgents.ts's
REGISTRABLE_AGENTS (inv.engineering.036/037). Now projected from the
canonical source via resolveRegistrableAgent, with only the display ORDER
(Nakamoto first, per the 2026-08-02 ruling) still asserted explicitly —
the fields themselves can no longer drift.

Every site that built an agentsInvoked/subjectAgentRef string via
`aigent-${slug}` template-literal coincidence now resolves the canonical
runtimeAgentId first (RegisterAgentPanel.tsx x4, PilotJourneyTab.tsx's
receiptsSubjectAgentRef), falling back to the coincidence only if resolution
genuinely fails — no behavior change for Nakamoto/MoneyPenny today, but a
future agent whose slug doesn't happen to match the `aigent-<slug>` pattern
now scopes correctly instead of silently mismatching.

Updated the two source-text canary tests (register-ceremony.test.ts,
register-stage-receipt-agent-isolation.test.ts) that asserted on the old
literal shapes to assert the same intent against the new code.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/RegisterAgentPanel.tsx` |
| Modified | `tests/register-ceremony.test.ts` |
| Modified | `tests/register-stage-receipt-agent-isolation.test.ts` |

## Stats

 4 files changed, 53 insertions(+), 32 deletions(-)
