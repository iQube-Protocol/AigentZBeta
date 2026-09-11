# Commit Brief: `f08b700` — Reframe ACT: Bring Your Agent Into the Field, not just an ExperienceQube disposition

| Field | Value |
|-------|-------|
| SHA | [`f08b700`](https://github.com/iQube-Protocol/AigentZBeta/commit/f08b7009fc1fd35d2592089670719cdf2233d339) |
| Author | Claude |
| Date | 2026-08-10T17:52:46Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Reframe ACT: Bring Your Agent Into the Field, not just an ExperienceQube disposition

ACT now offers two sibling paths, neither of which is delegation:
(1) Connect an agent you already use -- deep-links to the real, already-
working metaMe Threshold MCP endpoint (OAuth 2.1 + PKCE + DCR crossing
that Claude Desktop/claude.ai's own connector flow speaks directly). A
base crossing grants only CONSTITUTIONAL_ROOT_CAPABILITIES (read/query),
never delegation, mandate, Standing, or transaction rights -- confirmed
by reading services/threshold/serviceRegistry.ts and the real authorize
page. Completing this path is a self-report ("I've connected --
continue"), same fidelity as ORIENT's and CHOOSE's demand signals, not a
verified crossing check.
(2) Meet aigentMe -- the existing disposition ceremony, unchanged, now
rendered inline as the second path.

Governing rule stated explicitly in copy and code: "Context may cross
before authority does." ACT's completion evidence becomes
agentRelationshipStarted, true when EITHER path is taken (an OR, not a
checklist) -- computed in the state route from a real disposition
receipt check or a real campaign_events read, never fabricated.

New ConstitutionalAgentFieldEntrySurface composes both paths; new
connect-agent route (GET read-back, POST self-report); journey/page copy
and journeySurfaceRegistry entry updated to match. Existing tests
updated for the renamed evidence field; new tests cover the connect-
agent route's auth gate and event shape.
```

## Body

ACT now offers two sibling paths, neither of which is delegation:
(1) Connect an agent you already use -- deep-links to the real, already-
working metaMe Threshold MCP endpoint (OAuth 2.1 + PKCE + DCR crossing
that Claude Desktop/claude.ai's own connector flow speaks directly). A
base crossing grants only CONSTITUTIONAL_ROOT_CAPABILITIES (read/query),
never delegation, mandate, Standing, or transaction rights -- confirmed
by reading services/threshold/serviceRegistry.ts and the real authorize
page. Completing this path is a self-report ("I've connected --
continue"), same fidelity as ORIENT's and CHOOSE's demand signals, not a
verified crossing check.
(2) Meet aigentMe -- the existing disposition ceremony, unchanged, now
rendered inline as the second path.

Governing rule stated explicitly in copy and code: "Context may cross
before authority does." ACT's completion evidence becomes
agentRelationshipStarted, true when EITHER path is taken (an OR, not a
checklist) -- computed in the state route from a real disposition
receipt check or a real campaign_events read, never fabricated.

New ConstitutionalAgentFieldEntrySurface composes both paths; new
connect-agent route (GET read-back, POST self-report); journey/page copy
and journeySurfaceRegistry entry updated to match. Existing tests
updated for the renamed evidence field; new tests cover the connect-
agent route's auth gate and event shape.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/journey/constitutional-internet-bridge/act/connect-agent/route.ts` |
| Modified | `app/api/journey/constitutional-internet-bridge/state/route.ts` |
| Modified | `app/bridge/constitutional-internet/page.tsx` |
| Added | `components/journey/ConstitutionalAgentFieldEntrySurface.tsx` |
| Modified | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Added | `tests/ci-bridge-connect-agent-route.test.ts` |
| Modified | `tests/constitutional-internet-bridge-journey.test.ts` |

## Stats

 9 files changed, 496 insertions(+), 35 deletions(-)
