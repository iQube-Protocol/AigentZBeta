# Commit Brief: `bbfa9d4` — Harden principal-only orientation: fail closed on the wrong acting persona

| Field | Value |
|-------|-------|
| SHA | [`bbfa9d4`](https://github.com/iQube-Protocol/AigentZBeta/commit/bbfa9d475bc5b4826aee8f49cca9139c8649367d) |
| Author | Claude |
| Date | 2026-08-29T14:42:50Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Harden principal-only orientation: fail closed on the wrong acting persona

app/api/journey/ian/orient/acknowledge/route.ts previously wrote
orientation_ritual_completed under whichever persona getActivePersona()
resolved, with no check that this persona could constitutionally be a
principal. This is exactly how Ian's real receipt ended up attributed to
his own bound aigentMe agent persona (personas.type='AigentMe') instead of
his human "Ian Andrew McCoy" persona (personas.type='PersonaQube') — the
Bug C finding from the prior investigation.

services/journey/ianJourneyState.ts adds resolveOrientationPrincipalGate,
checked before every write:
  1. wrong-principal — if this auth profile already has a persona bound as
     a party on a Reciprocal Artifact Exchange, that persona IS the
     canonical principal; any other persona (its own aigentMe included)
     is refused.
  2. not-principal-type — before any exchange exists to bind a specific
     principal, the acting persona's own type must be 'PersonaQube'; any
     agent-kind type (AigentMe, AgentDelegate, ...) is refused.

A refusal writes nothing at all — no receipt, no substitute principal, no
manufactured agentsInvoked provenance — and returns a message naming the
correct principal by display name when known. The route fails closed
(503) rather than open when the database is unavailable to verify identity.
IanOrientationPanel surfaces the server's message verbatim and points at
the existing ActivePersonaControl persona switcher already in every
Journey header — no new identity-selection mechanism.

12 new tests (tests/ian-orientation-principal-gate.test.ts): the gate at
unit level, and the route end-to-end proving Ian's own principal persona
succeeds, his aigentMe/an unrelated persona are refused with no receipt
written, and the route fails closed with no database connection.

Cherry-picked from review/irl-scoped-restoration-2026-08-27 (93aa78b04),
patch unaltered — this commit adds only the deploy trigger touch. Deployed
together with 4b1df6558's gated runtime session diagnostics (Bug B),
cherry-picked immediately prior in this same push.
```

## Body

app/api/journey/ian/orient/acknowledge/route.ts previously wrote
orientation_ritual_completed under whichever persona getActivePersona()
resolved, with no check that this persona could constitutionally be a
principal. This is exactly how Ian's real receipt ended up attributed to
his own bound aigentMe agent persona (personas.type='AigentMe') instead of
his human "Ian Andrew McCoy" persona (personas.type='PersonaQube') — the
Bug C finding from the prior investigation.

services/journey/ianJourneyState.ts adds resolveOrientationPrincipalGate,
checked before every write:
  1. wrong-principal — if this auth profile already has a persona bound as
     a party on a Reciprocal Artifact Exchange, that persona IS the
     canonical principal; any other persona (its own aigentMe included)
     is refused.
  2. not-principal-type — before any exchange exists to bind a specific
     principal, the acting persona's own type must be 'PersonaQube'; any
     agent-kind type (AigentMe, AgentDelegate, ...) is refused.

A refusal writes nothing at all — no receipt, no substitute principal, no
manufactured agentsInvoked provenance — and returns a message naming the
correct principal by display name when known. The route fails closed
(503) rather than open when the database is unavailable to verify identity.
IanOrientationPanel surfaces the server's message verbatim and points at
the existing ActivePersonaControl persona switcher already in every
Journey header — no new identity-selection mechanism.

12 new tests (tests/ian-orientation-principal-gate.test.ts): the gate at
unit level, and the route end-to-end proving Ian's own principal persona
succeeds, his aigentMe/an unrelated persona are refused with no receipt
written, and the route fails closed with no database connection.

Cherry-picked from review/irl-scoped-restoration-2026-08-27 (93aa78b04),
patch unaltered — this commit adds only the deploy trigger touch. Deployed
together with 4b1df6558's gated runtime session diagnostics (Bug B),
cherry-picked immediately prior in this same push.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/ian/orient/acknowledge/route.ts` |
| Modified | `components/journey/IanOrientationPanel.tsx` |
| Modified | `services/journey/ianJourneyState.ts` |
| Added | `tests/ian-orientation-principal-gate.test.ts` |

## Stats

 5 files changed, 436 insertions(+), 3 deletions(-)
