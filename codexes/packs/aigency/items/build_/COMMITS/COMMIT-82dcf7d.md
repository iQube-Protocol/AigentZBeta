# Commit Brief: `82dcf7d` — Fix exchange/orientation/delegation discovery to be merge-aware, like Passport

| Field | Value |
|-------|-------|
| SHA | [`82dcf7d`](https://github.com/iQube-Protocol/AigentZBeta/commit/82dcf7d8c6fdce892cbf8e2c4f6b7cb6982a0ef7) |
| Author | Claude |
| Date | 2026-08-30T21:16:07Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix exchange/orientation/delegation discovery to be merge-aware, like Passport

Root cause: Ian's Claude MCP session authenticated correctly (Passport
usable, OCSGA journey resolved) but get_navigator_state reported
hasActiveExchange:false and stuck at orient/orientationRitualCompleted,
while get_exchange_state said no exchange existed at all, despite Ian
already being bound as Party B with a registered artifact.

The MCP OAuth crossing (app/api/threshold/oauth/complete/route.ts) binds
session.principalPublicRef to whichever persona was active in the browser
at authorize time, which can differ from, but be multi-email-merged with
(crm_auth_profile_links), the persona actually bound to the exchange and
holding the orientation receipt. Passport resolution
(loadUsableCitizenPassportForAuthProfile -> listOwnedPersonaIds) already
walks merged-linked auth profiles for exactly this reason; three sibling
call sites never did:

- listMyExchanges (reciprocalExchange.ts) took a single personaId only,
  with no sibling widening at all.
- resolveExchangeActingPrincipal's fallback sibling lookup queried
  personas.auth_profile_id directly, missing a MERGED (not just
  same-profile) sibling.
- resolveOrientationPrincipalGate / resolveOrientationEvidence
  (ianJourneyState.ts) had the identical same-profile-only gap.

Fix: listMyExchanges now also accepts an array of persona ids; the three
call sites above (constitutionalNavigator.ts's hasActiveExchange,
mcpConstitutionalActs.ts's resolveActiveExchangeId /
resolveExchangeWriteAuthority, ianJourneyState.ts's exchange and
orientation discovery) resolve the merge-aware owned-persona-id roster
via the same listOwnedPersonaIds passportPrincipal.ts already exports,
then widen through it, never a second independently-derived notion of
the holder's personas. resolveExchangeWriteAuthority and
fetchIanAuthoritativePlatformState also now resolve the exact bound-party
personaId (resolveExchangeActingPrincipal) before calling getExchangeView,
since the exchange may be bound to a merged sibling rather than the
session's own resolved persona. delegationActive in the journey's own
evidence (ianJourneyState.ts) is likewise widened across owned personas;
constitutionalContext.ts's per-persona assignedAgents is deliberately
left untouched, a different, intentionally persona-scoped concept.

Fails closed exactly as before: an unrelated principal or one with no
merge link still gets refused with the same specific reasons.
```

## Body

Root cause: Ian's Claude MCP session authenticated correctly (Passport
usable, OCSGA journey resolved) but get_navigator_state reported
hasActiveExchange:false and stuck at orient/orientationRitualCompleted,
while get_exchange_state said no exchange existed at all, despite Ian
already being bound as Party B with a registered artifact.

The MCP OAuth crossing (app/api/threshold/oauth/complete/route.ts) binds
session.principalPublicRef to whichever persona was active in the browser
at authorize time, which can differ from, but be multi-email-merged with
(crm_auth_profile_links), the persona actually bound to the exchange and
holding the orientation receipt. Passport resolution
(loadUsableCitizenPassportForAuthProfile -> listOwnedPersonaIds) already
walks merged-linked auth profiles for exactly this reason; three sibling
call sites never did:

- listMyExchanges (reciprocalExchange.ts) took a single personaId only,
  with no sibling widening at all.
- resolveExchangeActingPrincipal's fallback sibling lookup queried
  personas.auth_profile_id directly, missing a MERGED (not just
  same-profile) sibling.
- resolveOrientationPrincipalGate / resolveOrientationEvidence
  (ianJourneyState.ts) had the identical same-profile-only gap.

Fix: listMyExchanges now also accepts an array of persona ids; the three
call sites above (constitutionalNavigator.ts's hasActiveExchange,
mcpConstitutionalActs.ts's resolveActiveExchangeId /
resolveExchangeWriteAuthority, ianJourneyState.ts's exchange and
orientation discovery) resolve the merge-aware owned-persona-id roster
via the same listOwnedPersonaIds passportPrincipal.ts already exports,
then widen through it, never a second independently-derived notion of
the holder's personas. resolveExchangeWriteAuthority and
fetchIanAuthoritativePlatformState also now resolve the exact bound-party
personaId (resolveExchangeActingPrincipal) before calling getExchangeView,
since the exchange may be bound to a merged sibling rather than the
session's own resolved persona. delegationActive in the journey's own
evidence (ianJourneyState.ts) is likewise widened across owned personas;
constitutionalContext.ts's per-persona assignedAgents is deliberately
left untouched, a different, intentionally persona-scoped concept.

Fails closed exactly as before: an unrelated principal or one with no
merge link still gets refused with the same specific reasons.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/journey/ianJourneyState.ts` |
| Modified | `services/research/reciprocalExchange.ts` |
| Modified | `services/threshold/constitutionalNavigator.ts` |
| Modified | `services/threshold/mcpConstitutionalActs.ts` |
| Modified | `tests/ian-orientation-principal-gate.test.ts` |
| Modified | `tests/ocsga-early-invitation-passport-routing.test.ts` |
| Modified | `tests/ocsga-exchange-principal-gate.test.ts` |
| Modified | `tests/threshold-constitutional-navigator.test.ts` |
| Modified | `tests/threshold-mcp-constitutional-rituals.test.ts` |

## Stats

 10 files changed, 397 insertions(+), 75 deletions(-)
